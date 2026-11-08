import { getPublishedCourseContext, UnpublishedCourseError } from './coursePublication';
import { resolveStoredActivity, ActivityBoundaryError } from './activityResolution';
import { activityDigest } from './activityIdentity';
import type { IStudyRoom } from '../models/StudyRoom';
export function activityPin(a: {
  courseId: string;
  revisionId: string;
  contentHash: string;
  activityId: string;
  activityRevision: string;
  activityType: string;
}) {
  return {
    courseId: a.courseId,
    revisionId: a.revisionId,
    contentHash: a.contentHash,
    activityId: a.activityId,
    activityRevision: a.activityRevision,
    activityType: a.activityType
  };
}
export async function resolveRoomActivity(
  actor: string,
  room: Pick<IStudyRoom, 'courseId' | 'revisionId'>,
  activityId: string
) {
  if (!room.courseId) {
    // Preserve not-found behavior without turning source-free rooms into grants.
    await resolveStoredActivity(actor, activityId);
    throw new ActivityBoundaryError(403, 'UNAUTHORIZED', 'A source-backed room is required');
  }
  const context = await getPublishedCourseContext(actor, room.courseId, room.revisionId);
  const resolved = await resolveStoredActivity(
    actor,
    activityId,
    room.courseId,
    context.revisionId
  );
  return { ...resolved, pin: activityPin(resolved.definition) };
}
export async function validateRoomRevision(
  actor: string,
  room: Pick<IStudyRoom, 'courseId' | 'revisionId'>
) {
  if (room.revisionId) {
    if (!room.courseId)
      throw new ActivityBoundaryError(403, 'UNAUTHORIZED', 'Missing course scope');
    return getPublishedCourseContext(actor, room.courseId, room.revisionId);
  }
  return null;
}

/** Resolve an explicit pin or use the currently published course revision. */
export async function resolveRoomSourceRevision(
  actor: string,
  room: Pick<IStudyRoom, 'courseId' | 'revisionId'>
) {
  if (room.revisionId) return (await validateRoomRevision(actor, room))?.revisionId;
  if (!room.courseId) return undefined;
  try {
    return (await getPublishedCourseContext(actor, room.courseId)).revisionId;
  } catch (error) {
    // Older API clients may still create discussion rooms for unpublished courses.
    if (error instanceof UnpublishedCourseError) return undefined;
    throw error;
  }
}
export function sameActivityPin(a: unknown, b: unknown) {
  return activityDigest(a) === activityDigest(b);
}
