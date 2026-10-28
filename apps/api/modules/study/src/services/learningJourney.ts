import { ActivityRecord, CourseRevision, LearningEvidence, StudentAttempt } from '../models';
import { getPublishedCourseContext, PublicationForbiddenError } from './coursePublication';
import { canAuthorCourse, canReadCourse } from './resourceAccess';
import { resolveStoredActivity, ActivityBoundaryError } from './activityResolution';
import { getAttemptResult } from './activityAttempt';
import { adaptiveRecommendation } from './adaptiveLearning';
import { getCourseDraft } from './courseDraft';
import { verifyRevisionArtifact, type SourcePassage } from './revisionSources';

export async function publishedActivities(actor: string, courseId: string, revisionId?: string) {
  const context = await getPublishedCourseContext(actor, courseId, revisionId);
  const records = await ActivityRecord.find({ courseId, revisionId: context.revisionId })
    .sort({ activityId: 1 })
    .limit(200)
    .lean();
  const activities = [];
  for (const record of records) {
    const resolved = await resolveStoredActivity(
      actor,
      record.activityId,
      courseId,
      context.revisionId
    );
    activities.push(resolved.definition);
  }
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  return { context, activities };
}
export async function learnerProgress(actor: string, courseId: string, revisionId?: string) {
  const { context, activities } = await publishedActivities(actor, courseId, revisionId);
  const evidence = await LearningEvidence.find({
    userId: actor,
    'activity.courseId': courseId,
    'activity.revisionId': context.revisionId,
    status: 'accepted',
    masteryAchieved: true
  }).lean();
  const mastered = [
    ...new Set(
      evidence
        .filter((e) =>
          activities.some(
            (a) =>
              a.activityId === e.activity.activityId &&
              a.activityRevision === e.activity.activityRevision &&
              a.contentHash === e.activity.contentHash
          )
        )
        .map((e) => e.objectiveId)
    )
  ];
  const objectives = context.topics.flatMap((topic) => topic.objectives);
  const next = objectives.find((o) => !mastered.includes(o.objectiveId));
  const receipts = await StudentAttempt.find({
    userId: actor,
    courseId,
    revisionId: context.revisionId
  })
    .sort({ submittedAt: -1 })
    .limit(50)
    .lean();
  const history = [];
  for (const receipt of receipts) {
    const result = await getAttemptResult(actor, receipt.attemptId, receipt.activityId);
    history.push({
      attemptId: receipt.attemptId,
      activityId: receipt.activityId,
      submittedAt: receipt.submittedAt.toISOString(),
      result
    });
  }
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  return {
    pin: { courseId, revisionId: context.revisionId, contentHash: context.contentHash },
    masteredObjectiveIds: mastered,
    history,
    recommendation: next
      ? {
          objectiveId: next.objectiveId,
          reason: 'No accepted mastery evidence for this objective in this revision.'
        }
      : null,
    policy: 'Reviewed evidence by objective; no inferred ability level or submission-count mastery.'
  };
}
export async function selectLearningActivity(
  actor: string,
  courseId: string,
  input: Record<string, unknown>
) {
  if (input.revisionId !== undefined && typeof input.revisionId !== 'string')
    throw new ActivityBoundaryError(400, 'INVALID_INPUT', 'Revision must be an exact tag');
  if (
    Object.keys(input).some(
      (k) => !['revisionId', 'objectiveId', 'activityType', 'intent'].includes(k)
    )
  )
    throw new ActivityBoundaryError(400, 'INVALID_INPUT', 'Unsupported selection field');
  if (
    input.activityType !== undefined &&
    (typeof input.activityType !== 'string' ||
      !['InteractiveQuiz', 'GuidedProblem'].includes(input.activityType))
  )
    throw new ActivityBoundaryError(400, 'UNSUPPORTED_TYPE', 'Unsupported activity type');
  if (
    input.intent !== undefined &&
    (typeof input.intent !== 'string' || !['practice', 'check', 'explain'].includes(input.intent))
  )
    throw new ActivityBoundaryError(400, 'INVALID_INPUT', 'Unsupported intent');
  const { context, activities } = await publishedActivities(
    actor,
    courseId,
    typeof input.revisionId === 'string' ? input.revisionId : undefined
  );
  if (!context.topics.some((t) => t.objectives.some((o) => o.objectiveId === input.objectiveId)))
    throw new ActivityBoundaryError(
      404,
      'OBJECTIVE_NOT_FOUND',
      'Objective not in the published revision'
    );
  if (input.intent === 'explain')
    return {
      kind: 'tutor',
      activity: null,
      reason: 'Ask a source-grounded question about this objective.',
      assessmentState: 'not_applicable',
      targetDemand: null,
      acceptedEvidenceCount: 0,
      policyVersion: 'reviewed-structure-evidence-v1',
      limitation: 'Source explanation does not assess ability.',
      adaptive: false
    };
  const eligible = activities.filter(
    (a) =>
      a.objectiveId === input.objectiveId &&
      (!input.activityType || a.activityType === input.activityType)
  );
  const recommendation = await adaptiveRecommendation(
    actor,
    courseId,
    context.revisionId,
    String(input.objectiveId),
    eligible
  );
  return {
    ...recommendation,
    kind: recommendation.activity ? 'activity' : 'unavailable',
    reason: recommendation.activity
      ? recommendation.reason
      : 'No eligible reviewed activity exists for this objective and type.'
  };
}
export async function diagnosticChecks(actor: string, courseId: string, revisionId?: string) {
  const { context, activities } = await publishedActivities(actor, courseId, revisionId);
  const progress = await learnerProgress(actor, courseId, context.revisionId);
  const checks = activities.slice(0, 4);
  return {
    status: checks.length >= 2 ? 'available' : 'unavailable',
    checks: checks.length >= 2 ? checks : [],
    progress,
    policy:
      'Provisional 2–4 reviewed checks. Exact accepted evidence supports reproducible practice progression; untested work remains unassessed and incorrect/unavailable results never certify mastery or ability.'
  };
}
export async function studioContext(actor: string, courseId: string, revisionId?: string) {
  if (!(await canAuthorCourse(actor, courseId))) throw new PublicationForbiddenError();
  const draft = await getCourseDraft(actor, courseId);
  if (revisionId && revisionId !== draft.revisionTag)
    throw new ActivityBoundaryError(409, 'STALE_REVISION', 'Draft changed; reload');
  const revision = await CourseRevision.findOne({
    courseId,
    revisionTag: draft.revisionTag,
    status: 'draft'
  }).lean();
  if (!revision) throw new ActivityBoundaryError(409, 'STALE_REVISION', 'Draft changed; reload');
  let sources: SourcePassage[] = [],
    ready = false;
  try {
    const artifact = await verifyRevisionArtifact(revision);
    sources = artifact.passages;
    ready = true;
  } catch {
    /* preparation is an explicit author action */
  }
  const records = await ActivityRecord.find({ courseId, revisionId: draft.revisionTag }).lean();
  if (!(await canAuthorCourse(actor, courseId))) throw new PublicationForbiddenError();
  return {
    draft,
    ready,
    sources,
    activities: records.map((r) => ({
      activityId: r.activityId,
      title: (r.publicDefinition as { title?: string }).title,
      activityType: r.activityType
    })),
    readiness: ready
      ? 'Ready originals and exact index'
      : 'Sources/index unavailable; prepare this exact draft revision.'
  };
}
