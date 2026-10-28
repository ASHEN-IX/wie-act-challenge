import { verifyRevisionArtifact } from './revisionSources';
import { Course, CourseRevision, ActivityRecord } from '../models';
import { activityDigest } from './activityIdentity';
import { canPublishCourse, canReadCourse } from './resourceAccess';

interface TopicObjectiveRecord {
  id?: string;
  objectiveId?: string;
  statement?: string;
  text?: string;
  bloomLevel?: string;
}

interface TopicSubtopicRecord {
  id?: string;
  title?: string;
  learning_objectives?: TopicObjectiveRecord[];
}

interface TopicRecord {
  id?: string;
  title?: string;
  subtopics?: TopicSubtopicRecord[];
}

export class PublicationForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'Publication or access forbidden') {
    super(message);
    this.name = 'PublicationForbiddenError';
  }
}

export class PublicationNotFoundError extends Error {
  readonly status = 404;
  constructor(message = 'Course or revision not found') {
    super(message);
    this.name = 'PublicationNotFoundError';
  }
}

export class UnpublishedCourseError extends Error {
  readonly status = 404;
  readonly code = 'UNPUBLISHED';
  constructor(message = 'Course has no published revision') {
    super(message);
    this.name = 'UnpublishedCourseError';
  }
}

export class PublicationConflictError extends Error {
  readonly status = 409;
  readonly code = 'STALE_REVISION';
  constructor(message = 'Draft revision has been modified. Please reload before publishing.') {
    super(message);
    this.name = 'PublicationConflictError';
  }
}

export class PublicationReviewRequiredError extends Error {
  readonly status = 400;
  readonly code = 'REVIEW_REQUIRED';
  constructor(
    message = 'Course draft must be reviewed and approved by instructor before publication'
  ) {
    super(message);
    this.name = 'PublicationReviewRequiredError';
  }
}

export class PublicationValidationError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_CURRICULUM';
  constructor(message: string) {
    super(message);
    this.name = 'PublicationValidationError';
  }
}

/**
 * Approve and publish a reviewed course draft revision (ED-05).
 * Updates the immutable published revision and conditionally repoints course.activeRevisionId.
 */
export async function publishCourseRevision(
  actorUserId: string,
  courseId: string,
  expectedRevisionTag?: string
) {
  if (
    expectedRevisionTag !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(expectedRevisionTag)
  )
    throw new PublicationConflictError('Invalid explicit revision');
  const allowed = await canPublishCourse(actorUserId, courseId);
  if (!allowed) {
    throw new PublicationForbiddenError(
      'Publication restricted to course owner or assigned instructor'
    );
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new PublicationNotFoundError('Course not found');
  }

  const draft = await CourseRevision.findOne({
    courseId,
    ...(expectedRevisionTag ? { revisionTag: expectedRevisionTag } : { status: 'draft' })
  }).sort({ createdAt: -1 });
  if (!draft) throw new PublicationConflictError('Exact draft not found');
  if (draft.revokedAt) throw new PublicationConflictError('Revision revoked');
  if (draft.activationState === 'committed') {
    return {
      success: true,
      courseId,
      publishedRevisionTag: draft.revisionTag,
      contentHash: draft.contentHash,
      publishedAt: draft.publishedAt!.toISOString()
    };
  }
  if (draft.status !== 'draft') throw new PublicationConflictError();
  if (!draft.isInstructorReviewed) throw new PublicationReviewRequiredError();
  if (!draft.topics?.length) throw new PublicationValidationError('Reviewed objectives required');
  const artifact = await verifyRevisionArtifact(draft);
  const activities = await ActivityRecord.find({ courseId, revisionId: draft.revisionTag }).lean();
  const approvedActivities = activities.map((a) => ({
    activityId: a.activityId,
    activityRevision: a.activityRevision,
    definitionHash: activityDigest(a.publicDefinition),
    evaluationHash: activityDigest(a.serverEvaluation)
  }));
  if (!draft.activationState) {
    const prepared = await CourseRevision.findOneAndUpdate(
      {
        _id: draft._id,
        status: 'draft',
        revisionTag: draft.revisionTag,
        __v: draft.__v,
        activationState: { $exists: false }
      },
      {
        $set: {
          activationState: 'prepared',
          expectedActiveRevisionId: course.activeRevisionId || null,
          approvedActivities,
          indexHash: artifact.metadata.indexHash,
          artifactHash: artifact.artifactHash,
          publishedByUserId: actorUserId,
          publishedAt: new Date()
        },
        $inc: { __v: 1 }
      },
      { new: true }
    );
    if (!prepared)
      throw new PublicationConflictError('Concurrent review/publication; retry exact command');
    draft.set(prepared.toObject());
  }
  // Receipt-first activation: immutable prepared revision, one CAS pointer,
  // then completion. A crash at either write is repaired by the same command.
  if (!(await canPublishCourse(actorUserId, courseId))) throw new PublicationForbiddenError();
  const active = await Course.findOneAndUpdate(
    {
      _id: courseId,
      $or: [
        { activeRevisionId: draft.expectedActiveRevisionId || null },
        { activeRevisionId: draft.revisionTag }
      ]
    },
    { $set: { activeRevisionId: draft.revisionTag } },
    { new: true }
  );
  if (!active) throw new PublicationConflictError('Another revision won activation');
  await CourseRevision.updateOne(
    { _id: draft._id, activationState: 'prepared', status: 'draft' },
    { $set: { activationState: 'committed', status: 'published' } }
  );
  if (draft.expectedActiveRevisionId)
    await CourseRevision.updateOne(
      {
        courseId,
        revisionTag: draft.expectedActiveRevisionId,
        status: 'published',
        activationState: 'committed',
        revokedAt: { $exists: false }
      },
      { $set: { status: 'deprecated' } }
    );
  return {
    success: true,
    courseId,
    publishedRevisionTag: draft.revisionTag,
    contentHash: draft.contentHash,
    publishedAt: draft.publishedAt!.toISOString()
  };
}

/**
 * Retrieve the Contract 03 PublishedContext projection for authorized learners/instructors.
 */
export async function getPublishedCourseContext(
  actorUserId: string,
  courseId: string,
  requestedRevisionTag?: string
) {
  if (
    requestedRevisionTag !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(requestedRevisionTag)
  )
    throw new UnpublishedCourseError('Invalid explicit revision');
  const allowed = await canReadCourse(actorUserId, courseId);
  if (!allowed) {
    throw new PublicationForbiddenError('Unauthorized to view course published context');
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw new PublicationNotFoundError('Course not found');
  }

  const pubRev =
    requestedRevisionTag || course.activeRevisionId
      ? await CourseRevision.findOne({
          courseId: course._id,
          revisionTag: requestedRevisionTag || course.activeRevisionId,
          status: { $in: ['published', 'deprecated'] },
          activationState: 'committed',
          revokedAt: { $exists: false }
        })
      : null;

  if (!pubRev) {
    throw new UnpublishedCourseError();
  }

  const artifact = await verifyRevisionArtifact(pubRev);
  const sources = artifact.metadata.documents.map((d) => ({
    documentId: d.documentId,
    contentHash: d.contentHash,
    provenance: 'extracted' as const,
    pageNumber: null,
    locationKnown: false
  }));
  if (!(await canReadCourse(actorUserId, courseId))) throw new PublicationForbiddenError();

  const authorizedDocumentIds = sources.map((s) => s.documentId);

  const topics = ((pubRev.topics || []) as unknown as TopicRecord[]).map(
    (t: TopicRecord, tIdx: number) => {
      const topicId = t.id || `top_${tIdx + 1}`;
      const objectives: Array<{ objectiveId: string; statement: string; bloomLevel: string }> = [];

      if (Array.isArray(t.subtopics)) {
        for (const s of t.subtopics) {
          if (Array.isArray(s.learning_objectives)) {
            for (const o of s.learning_objectives) {
              objectives.push({
                objectiveId: o.id || o.objectiveId || `obj_${objectives.length + 1}`,
                statement: o.statement || o.text || '',
                bloomLevel: o.bloomLevel || 'understand'
              });
            }
          }
        }
      }

      return {
        topicId,
        title: t.title || 'Untitled Topic',
        objectives
      };
    }
  );

  const rawContentHash = (pubRev.contentHash || '').replace(/^sha256:/, '');
  const formattedHash = `sha256:${rawContentHash.length === 64 ? rawContentHash : '0'.repeat(64)}`;

  return {
    schemaVersion: '1.0.0',
    visibility: 'authorized_learner',
    courseId: course._id.toString(),
    revisionId: pubRev.revisionTag,
    contentHash: formattedHash,
    title: course.title,
    isPublished: true,
    publishedAt: (pubRev.publishedAt || pubRev.updatedAt).toISOString(),
    authorizedDocumentIds,
    sources,
    topics
  };
}

/**
 * Server-only projection providing SourceResolution with vectorIndexRef and AccessDecision.
 */
export async function resolveCourseSource(
  actorUserId: string,
  courseId: string,
  requestedRevisionTag?: string
) {
  if (
    requestedRevisionTag !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(requestedRevisionTag)
  )
    throw new UnpublishedCourseError('Invalid explicit revision');
  const allowed = await canReadCourse(actorUserId, courseId);
  const checkedAt = new Date().toISOString();

  if (!allowed) {
    return {
      schemaVersion: '1.0.0',
      visibility: 'server_only',
      access: {
        schemaVersion: '1.0.0',
        decision: 'denied',
        code: 'UNAUTHORIZED',
        retryable: false
      }
    };
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return {
      schemaVersion: '1.0.0',
      visibility: 'server_only',
      access: {
        schemaVersion: '1.0.0',
        decision: 'denied',
        code: 'UNAVAILABLE',
        retryable: false
      }
    };
  }

  const pubRev =
    requestedRevisionTag || course.activeRevisionId
      ? await CourseRevision.findOne({
          courseId: course._id,
          revisionTag: requestedRevisionTag || course.activeRevisionId,
          status: { $in: ['published', 'deprecated'] },
          activationState: 'committed',
          revokedAt: { $exists: false }
        })
      : null;

  if (!pubRev) {
    return {
      schemaVersion: '1.0.0',
      visibility: 'server_only',
      access: {
        schemaVersion: '1.0.0',
        decision: 'denied',
        code: 'UNPUBLISHED',
        retryable: false
      }
    };
  }

  const rawContentHash = (pubRev.contentHash || '').replace(/^sha256:/, '');
  const formattedHash = `sha256:${rawContentHash.length === 64 ? rawContentHash : '0'.repeat(64)}`;

  const pin = {
    courseId: course._id.toString(),
    revisionId: pubRev.revisionTag,
    contentHash: formattedHash
  };

  const isOwner = course.userId === actorUserId || course.ownerUserId === actorUserId;
  const isInstructor =
    Array.isArray(course.assignedInstructorIds) &&
    course.assignedInstructorIds.includes(actorUserId);
  const grant = isOwner
    ? 'personal_owner'
    : isInstructor
      ? 'assigned_instructor'
      : 'active_enrollment';

  const artifact = await verifyRevisionArtifact(pubRev);
  const sources = artifact.metadata.documents.map((d) => ({
    documentId: d.documentId,
    contentHash: d.contentHash,
    provenance: 'extracted' as const,
    pageNumber: null,
    locationKnown: false
  }));
  if (!(await canReadCourse(actorUserId, courseId))) throw new PublicationForbiddenError();

  return {
    schemaVersion: '1.0.0',
    visibility: 'server_only',
    pin,
    access: {
      schemaVersion: '1.0.0',
      decision: 'allowed',
      userId: actorUserId,
      pin,
      grant,
      checkedAt
    },
    sources,
    vectorIndexRef:
      pubRev.vectorIndexRef || `faiss/${course._id.toString()}/${pubRev.revisionTag}.faiss`
  };
}
