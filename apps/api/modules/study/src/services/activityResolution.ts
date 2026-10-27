import { CourseRevision, ActivityRecord, StudyRoom } from '../models';
import { ICourseFile } from '../models';
import { parseContract, type ActivityDefinition } from '../../../../shared/ednova/contracts';
import { canReadCourse, canAuthorCourse } from './resourceAccess';
import { PublicationForbiddenError } from './coursePublication';
import { verifyRevisionArtifact } from './revisionSources';
import { activityDigest } from './activityIdentity';

export class ActivityBoundaryError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ActivityBoundaryError';
  }
}

/** Called only by trusted upload/draft services. Never accept a manifest from a client. */
export function captureActivitySources(files: ICourseFile[]) {
  if (!files.length) return undefined;
  const sources = new Map<
    string,
    { documentId: string; filename: string; contentHash: string; provenance: 'extracted' }
  >();
  for (const file of files) {
    const hash = (file.fileHash || '').replace(/^sha256:/, '');
    if (!/^[a-f0-9]{64}$/.test(hash) || !file.filename) return undefined;
    const documentId = 'doc_' + hash.slice(0, 16);
    const previous = sources.get(documentId);
    if (previous && previous.contentHash !== 'sha256:' + hash) return undefined;
    sources.set(documentId, {
      documentId,
      filename: file.filename,
      contentHash: 'sha256:' + hash,
      provenance: 'extracted'
    });
  }
  return [...sources.values()];
}

export async function resolveActivityRevision(
  actor: string,
  courseId: string,
  revisionId: string,
  authoring = false
) {
  const allowed = authoring
    ? await canAuthorCourse(actor, courseId)
    : await canReadCourse(actor, courseId);
  if (!allowed) throw new PublicationForbiddenError();
  const revision = await CourseRevision.findOne({ courseId, revisionTag: revisionId }).lean();
  if (
    !revision ||
    revision.revokedAt ||
    (!authoring && !['published', 'deprecated'].includes(revision.status))
  ) {
    throw new ActivityBoundaryError(
      409,
      'STALE_REVISION',
      'Exact published revision not available'
    );
  }
  await verifyRevisionArtifact(revision);
  return revision;
}

export function validateActivityRevision(
  activity: ActivityDefinition,
  revision: Awaited<ReturnType<typeof resolveActivityRevision>>
) {
  if (
    activity.revisionId !== revision.revisionTag ||
    activity.courseId !== revision.courseId.toString() ||
    activity.contentHash !== 'sha256:' + revision.contentHash.replace(/^sha256:/, '')
  ) {
    throw new ActivityBoundaryError(409, 'STALE_REVISION', 'Activity source pin mismatch');
  }
  if (
    activity.sourceRefs.some(
      (s) =>
        !revision.sourceManifest?.some(
          (r) => r.documentId === s.documentId && r.contentHash === s.contentHash
        ) ||
        (s.pageNumber !== null && (!s.locationKnown || s.pageNumber < 1))
    )
  ) {
    throw new ActivityBoundaryError(
      400,
      'INVALID_SOURCE',
      'Source identity or unverified page claim'
    );
  }
  const topics = (revision.topics as Array<Record<string, unknown>>) || [];
  const objectives = topics.flatMap((topic) => [
    ...(Array.isArray(topic.objectives) ? topic.objectives : []),
    ...(Array.isArray(topic.subtopics)
      ? topic.subtopics.flatMap((s: Record<string, unknown>) =>
          Array.isArray(s.learning_objectives) ? s.learning_objectives : []
        )
      : [])
  ]) as Array<Record<string, unknown>>;
  const objective = objectives.find((o) => (o.id || o.objectiveId) === activity.objectiveId);
  if (!objective)
    throw new ActivityBoundaryError(400, 'INVALID_OBJECTIVE', 'Objective is not in this revision');
  return objective;
}

export async function resolveStoredActivity(
  actor: string,
  activityId: string,
  courseId?: string,
  revisionId?: string
) {
  if (revisionId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(revisionId))
    throw new ActivityBoundaryError(409, 'STALE_REVISION', 'Invalid exact revision');
  const records = await ActivityRecord.find({
    activityId,
    ...(courseId ? { courseId } : {}),
    ...(revisionId ? { revisionId } : {})
  })
    .limit(2)
    .lean();
  if (!records.length)
    throw new ActivityBoundaryError(404, 'ACTIVITY_NOT_FOUND', 'Activity not found');
  if (records.length !== 1)
    throw new ActivityBoundaryError(
      409,
      'AMBIGUOUS_ACTIVITY',
      'Course and revision are required for this activity'
    );
  const record = records[0];
  const revision = await resolveActivityRevision(actor, record.courseId, record.revisionId);
  const definition = parseContract('ActivityDefinition', record.publicDefinition);
  validateActivityRevision(definition, revision);
  if (
    !revision.approvedActivities?.some(
      (a) =>
        a.activityId === definition.activityId &&
        a.activityRevision === definition.activityRevision &&
        a.definitionHash === activityDigest(definition) &&
        a.evaluationHash === activityDigest(record.serverEvaluation)
    )
  ) {
    throw new ActivityBoundaryError(
      503,
      'ACTIVITY_INTEGRITY_UNAVAILABLE',
      'Activity is not in the approved revision snapshot'
    );
  }
  if (!(await canReadCourse(actor, record.courseId))) throw new PublicationForbiddenError();
  return { record, revision, definition };
}

export async function validateActivityRoom(
  actor: string,
  roomId: string | null,
  definition: ActivityDefinition
) {
  if (!roomId) return;
  const room = await StudyRoom.findOne({
    roomId,
    status: 'active',
    participants: {
      $elemMatch: { userId: actor, leftAt: { $exists: false } }
    }
  }).lean();
  if (
    !room ||
    room.courseId !== definition.courseId ||
    room.activeActivityId !== definition.activityId ||
    (room.activePin &&
      (room.activePin.activityRevision !== definition.activityRevision ||
        room.activePin.contentHash !== definition.contentHash)) ||
    (room.revisionId && room.revisionId !== definition.revisionId)
  ) {
    throw new PublicationForbiddenError('Room membership or active activity context mismatch');
  }
}
