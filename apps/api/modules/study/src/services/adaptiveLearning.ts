/** Explainable local policy over immutable reviewed activities and exact evidence.
 * Structural demand is a routing heuristic, never an estimate of learner ability.
 */
import type { ActivityDefinition } from '../../../../shared/ednova/contracts';
import { LearningEvidence, StudentAttempt } from '../models';
import { canReadCourse } from './resourceAccess';
import { PublicationForbiddenError } from './coursePublication';

export function activityDemand(activity: ActivityDefinition): 1 | 2 | 3 {
  const size =
    activity.activityType === 'InteractiveQuiz'
      ? activity.presentationData.options.length
      : activity.presentationData.steps.length;
  return activity.activityType === 'InteractiveQuiz'
    ? size <= 3
      ? 1
      : size <= 5
        ? 2
        : 3
    : size === 1
      ? 1
      : size === 2
        ? 2
        : 3;
}
export async function adaptiveRecommendation(
  actor: string,
  courseId: string,
  revisionId: string,
  objectiveId: string,
  activities: ActivityDefinition[]
) {
  const eligible = activities.filter((a) => a.objectiveId === objectiveId);
  const byId = new Map(eligible.map((a) => [a.activityId, a]));
  const candidates = await LearningEvidence.find({
    userId: actor,
    'activity.courseId': courseId,
    'activity.revisionId': revisionId,
    objectiveId,
    status: 'accepted',
    masteryAchieved: true
  }).lean();
  const receipts = await StudentAttempt.find({
    userId: actor,
    courseId,
    revisionId,
    attemptId: { $in: candidates.map((e) => e.attemptId) },
    processingState: 'completed',
    protocolVersion: 1,
    status: 'graded'
  }).lean();
  const accepted = candidates.filter((e) => {
    const receipt = receipts.find(
      (r) => r.attemptId === e.attemptId && r.evidenceId === e.evidenceId
    );
    if (
      !receipt ||
      receipt.assessmentResult?.status !== 'graded' ||
      receipt.assessmentResult.isCorrect !== true ||
      receipt.assessmentResult.evidenceId !== e.evidenceId
    )
      return false;
    const activity = byId.get(e.activity.activityId);
    return (
      activity &&
      e.activity.activityRevision === activity.activityRevision &&
      e.activity.contentHash === activity.contentHash &&
      (e.evaluator.type === 'deterministic_rubric' || e.evaluator.executionMode === 'REAL_APPROVED')
    );
  });
  const latest = await StudentAttempt.findOne({
    userId: actor,
    courseId,
    revisionId,
    activityId: { $in: eligible.map((a) => a.activityId) },
    protocolVersion: 1,
    processingState: 'completed',
    status: 'graded'
  })
    .sort({ submittedAt: -1, _id: -1 })
    .lean();
  const latestActivity = latest && byId.get(latest.activityId);
  const needsSupport = !!(
    latest &&
    latestActivity &&
    latest.activityRevision === latestActivity.activityRevision &&
    latest.contentHash === latestActivity.contentHash &&
    latest.assessmentResult?.status === 'graded' &&
    latest.assessmentResult.isCorrect === false
  );
  const highest = accepted.reduce(
    (level, e) => Math.max(level, activityDemand(byId.get(e.activity.activityId)!)),
    0
  );
  const target = needsSupport ? 1 : Math.min(3, Math.max(1, highest + 1));
  const completed = new Set(accepted.map((e) => e.activity.activityId));
  const ranked = [...eligible].sort(
    (a, b) =>
      Math.abs(activityDemand(a) - target) - Math.abs(activityDemand(b) - target) ||
      Number(completed.has(a.activityId)) - Number(completed.has(b.activityId)) ||
      a.activityId.localeCompare(b.activityId)
  );
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  return {
    activity: ranked[0] || null,
    adaptive: true,
    policyVersion: 'reviewed-structure-evidence-v1',
    assessmentState: needsSupport
      ? 'needs_support'
      : accepted.length
        ? 'evidence_available'
        : 'unassessed',
    targetDemand: target,
    acceptedEvidenceCount: accepted.length,
    reason: needsSupport
      ? 'Your latest completed check did not meet its reviewed definition. Start with introductory practice and a source-backed hint.'
      : accepted.length
        ? 'Exact accepted evidence supports trying the next structural demand, bounded by available reviewed activities.'
        : 'No accepted evidence for this objective and revision. Start with introductory reviewed practice; ability remains unassessed.',
    limitation:
      'Structural demand uses reviewed choice/step counts. It is a reproducible practice heuristic, not calibrated difficulty or an ability/mastery estimate.'
  };
}
