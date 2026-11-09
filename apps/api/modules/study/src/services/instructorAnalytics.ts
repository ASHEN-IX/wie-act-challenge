/** Aggregate-only instructor projection. No response contains learner or attempt IDs.
 * Configuration enables a provisional threshold; it is not policy approval.
 */
import {
  Course,
  CourseEnrollment,
  CourseRevision,
  InstitutionMembership,
  LearningEvidence,
  StudentAttempt
} from '../models';
import { canAuthorCourse } from './resourceAccess';

export class AnalyticsAccessError extends Error {
  readonly status = 403;
  constructor() {
    super('Instructor course insight access denied');
  }
}

export function analyticsThreshold(): number | null {
  const value = process.env.EDNOVA_ANALYTICS_MIN_COHORT;
  if (!value || !/^\d+$/.test(value)) return null;
  const threshold = Number(value);
  return Number.isSafeInteger(threshold) && threshold >= 5 && threshold <= 1000 ? threshold : null;
}

async function authorizedCourse(actor: string, courseId: string) {
  if (!(await canAuthorCourse(actor, courseId))) throw new AnalyticsAccessError();
  const course = await Course.findById(courseId).select(
    'title scope institutionId activeRevisionId'
  );
  if (course?.scope !== 'institutional' || !course.institutionId) throw new AnalyticsAccessError();
  return course;
}

/** No global role or institution administrator grants educator insight access. */
export async function instructorAnalyticsCourses(actor: string) {
  const candidates = await Course.find({ scope: 'institutional', assignedInstructorIds: actor })
    .select('id title')
    .sort({ title: 1, id: 1 })
    .limit(200);
  const courses = [];
  for (const course of candidates) {
    if (await canAuthorCourse(actor, String(course.id)))
      courses.push({ courseId: String(course.id), title: course.title });
  }
  // Listing can also be delayed by the database: re-check at delivery.
  const visible = [];
  for (const course of courses)
    if (await canAuthorCourse(actor, course.courseId)) visible.push(course);
  return { courses: visible };
}

async function currentCohort(courseId: string, institutionId: unknown) {
  const members = await InstitutionMembership.find({
    institutionId,
    status: 'active',
    role: 'university_student'
  }).select('userId');
  const enrolled = await CourseEnrollment.find({
    courseId,
    institutionId,
    status: 'active',
    userId: { $in: members.map((member) => member.userId) }
  }).select('userId');
  return [...new Set(enrolled.map((row) => row.userId))].sort();
}

/** ISO week token (`%G-W%V`) in UTC, matching the old `$dateToString`. */
function isoWeek(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

interface AggregateRow {
  userId: string;
  activityType: 'InteractiveQuiz' | 'GuidedProblem';
  mastered: boolean;
  week: string;
}

function supportedCount(count: number, cohort: number, threshold: number) {
  // Complementary suppression prevents subtraction or uniform-cell disclosure.
  return count >= threshold && cohort - count >= threshold ? count : null;
}

/** Fixed current revision and fixed completed UTC weeks; arbitrary filters and
 * drill-down are deliberately absent. Counts cap each learner to one per cell.
 */
export async function instructorCourseAnalytics(actor: string, courseId: string) {
  const course = await authorizedCourse(actor, courseId);
  const threshold = analyticsThreshold();
  const base = {
    course: { courseId, title: course.title, revisionId: course.activeRevisionId || null },
    policy: { minimumCohort: threshold, status: 'provisional' as const },
    suppressed: true,
    suppressionReason: 'policy_pending' as string | null,
    summary: null as {
      enrolledLearners: number;
      practicedLearners: number | null;
      masteredLearners: number | null;
    } | null,
    activityBreakdown: [] as Array<{ activityType: string; practicedLearners: number | null }>,
    trends: [] as Array<{ week: string; practicedLearners: number | null }>
  };
  const observed: { cohort?: string[] } = {};
  const deliver = async () => {
    const current = await authorizedCourse(actor, courseId);
    if (current.activeRevisionId !== course.activeRevisionId)
      throw Object.assign(new Error('Published revision changed; reload insights'), {
        status: 409
      });
    if (analyticsThreshold() !== threshold)
      throw Object.assign(new Error('Insight policy changed; reload insights'), { status: 409 });
    if (
      observed.cohort &&
      JSON.stringify(await currentCohort(courseId, current.institutionId)) !==
        JSON.stringify(observed.cohort)
    )
      throw Object.assign(new Error('Course cohort changed; reload insights'), { status: 409 });
    if (
      base.summary &&
      !(await CourseRevision.exists({
        courseId,
        revisionTag: course.activeRevisionId,
        status: 'published',
        activationState: 'committed',
        isInstructorReviewed: true,
        revokedAt: { $exists: false }
      }))
    )
      throw Object.assign(new Error('Published revision changed; reload insights'), {
        status: 409
      });
    return base;
  };
  if (threshold === null) return deliver();
  // Membership must still be active; a stale enrollment is not cohort authority.
  const users = await currentCohort(courseId, course.institutionId);
  observed.cohort = users;
  if (users.length < threshold) {
    base.suppressionReason = 'small_cohort';
    return deliver();
  }
  const revision = course.activeRevisionId
    ? await CourseRevision.findOne({
        courseId,
        revisionTag: course.activeRevisionId,
        status: 'published',
        activationState: 'committed',
        isInstructorReviewed: true,
        revokedAt: { $exists: false }
      }).select('contentHash approvedActivities')
    : null;
  if (!revision) {
    base.suppressionReason = 'published_evidence_unavailable';
    return deliver();
  }
  const approved = (revision.approvedActivities || []) as Array<{
    activityId: string;
    activityRevision: string;
    definitionHash: string;
    evaluationHash: string;
  }>;
  const hash = 'sha256:' + revision.contentHash.replace(/^sha256:/, '');
  /**
   * The Mongo pipeline joined accepted evidence to its graded attempt receipt
   * and grouped one cell per (learner, activity type, ISO week).
   *
   * Both sides are keyed by a unique natural identity — evidence by
   * (userId, attemptId) and attempts by (userId, attemptId) — so the join is
   * done here over a bounded cohort. Only identity/status fields are read: no
   * private answer, rubric, transcript, source filename or response text.
   */
  const rows: AggregateRow[] = [];
  if (approved.length) {
    const approvedKey = (activityId: string, activityRevision: string) =>
      activityId + '\u0000' + activityRevision;
    const approvedSet = new Set(
      approved.map((activity) => approvedKey(activity.activityId, activity.activityRevision))
    );
    const evidenceRows = await LearningEvidence.find({
      userId: { $in: users },
      status: 'accepted',
      evidenceVersion: '1.0.0'
    });
    const candidates = evidenceRows.filter((evidence) => {
      const activity = evidence.activity;
      const evaluator = evidence.evaluator;
      if (!activity || !evaluator) return false;
      if (activity.courseId !== courseId) return false;
      if (activity.revisionId !== course.activeRevisionId) return false;
      if (activity.contentHash !== hash) return false;
      if (!['REAL_APPROVED', 'DETERMINISTIC_FALLBACK'].includes(evaluator.executionMode))
        return false;
      return approvedSet.has(approvedKey(activity.activityId, activity.activityRevision));
    });
    if (candidates.length) {
      const attemptIds = [...new Set(candidates.map((evidence) => evidence.attemptId))];
      const receipts = await StudentAttempt.find({
        userId: { $in: users },
        attemptId: { $in: attemptIds },
        courseId,
        revisionId: course.activeRevisionId,
        contentHash: hash,
        status: 'graded',
        processingState: 'completed'
      });
      const receiptByReceiptKey = new Map(
        receipts.map((receipt) => [
          [receipt.userId, receipt.attemptId, receipt.evidenceId ?? ''].join('\u0000'),
          receipt
        ])
      );
      const cells = new Map<
        string,
        {
          userId: string;
          activityType: 'InteractiveQuiz' | 'GuidedProblem';
          week: string;
          mastered: boolean;
        }
      >();
      for (const evidence of candidates) {
        const activity = evidence.activity;
        const receipt = receiptByReceiptKey.get(
          [evidence.userId, evidence.attemptId, evidence.evidenceId].join('\u0000')
        );
        if (!receipt) continue;
        if (
          receipt.activityId !== activity.activityId ||
          receipt.activityRevision !== activity.activityRevision ||
          receipt.activityType !== activity.activityType
        )
          continue;
        const week = isoWeek(evidence.timestamp);
        const key = [evidence.userId, activity.activityType, week].join('\u0000');
        const mastered = Boolean(evidence.masteryAchieved);
        const existing = cells.get(key);
        if (existing) existing.mastered = existing.mastered || mastered;
        else
          cells.set(key, {
            userId: evidence.userId,
            activityType: activity.activityType as 'InteractiveQuiz' | 'GuidedProblem',
            week,
            mastered
          });
      }
      rows.push(...cells.values());
    }
  }
  const practiced = new Set(rows.map((row) => row.userId));
  const mastered = new Set(rows.filter((row) => row.mastered).map((row) => row.userId));
  base.suppressed = false;
  base.suppressionReason = null;
  base.summary = {
    enrolledLearners: users.length,
    practicedLearners: supportedCount(practiced.size, users.length, threshold),
    masteredLearners: supportedCount(mastered.size, users.length, threshold)
  };
  base.activityBreakdown = ['InteractiveQuiz', 'GuidedProblem'].map((activityType) => ({
    activityType,
    practicedLearners: supportedCount(
      new Set(rows.filter((row) => row.activityType === activityType).map((row) => row.userId))
        .size,
      users.length,
      threshold
    )
  }));
  // Only complete calendar weeks appear; no learner-specified ranges or current
  // day changes. Per-cell thresholding also applies to every trend point.
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  for (let offset = 8; offset >= 1; offset--) {
    const start = new Date(monday.getTime() - offset * 7 * 86400000);
    const thursday = new Date(start.getTime() + 3 * 86400000);
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const week = `${thursday.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    base.trends.push({
      week,
      practicedLearners: supportedCount(
        new Set(rows.filter((row) => row.week === week).map((row) => row.userId)).size,
        users.length,
        threshold
      )
    });
  }
  return deliver();
}
