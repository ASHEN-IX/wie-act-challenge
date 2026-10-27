/** Aggregate-only instructor projection. No response contains learner or attempt IDs.
 * Configuration enables a provisional threshold; it is not policy approval.
 */
import {
  Course,
  CourseEnrollment,
  CourseRevision,
  InstitutionMembership,
  LearningEvidence
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
  const course = await Course.findById(courseId)
    .select('title scope institutionId activeRevisionId')
    .lean();
  if (course?.scope !== 'institutional' || !course.institutionId) throw new AnalyticsAccessError();
  return course;
}

/** No global role or institution administrator grants educator insight access. */
export async function instructorAnalyticsCourses(actor: string) {
  const candidates = await Course.find({ scope: 'institutional', assignedInstructorIds: actor })
    .select('_id title')
    .sort({ title: 1, _id: 1 })
    .limit(200)
    .lean();
  const courses = [];
  for (const course of candidates) {
    if (await canAuthorCourse(actor, String(course._id)))
      courses.push({ courseId: String(course._id), title: course.title });
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
  })
    .select('userId')
    .lean();
  const enrolled = await CourseEnrollment.find({
    courseId,
    institutionId,
    status: 'active',
    userId: { $in: members.map((member) => member.userId) }
  })
    .select('userId')
    .lean();
  return [...new Set(enrolled.map((row) => row.userId))].sort();
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
      })
        .select('contentHash approvedActivities')
        .lean()
    : null;
  if (!revision) {
    base.suppressionReason = 'published_evidence_unavailable';
    return deliver();
  }
  const approved = revision.approvedActivities || [];
  const hash = 'sha256:' + revision.contentHash.replace(/^sha256:/, '');
  // Join receipts inside Mongo using only identity/status fields. No private
  // answer, rubric, transcript, source filename or response text is projected.
  const rows = approved.length
    ? await LearningEvidence.aggregate<AggregateRow>([
        {
          $match: {
            userId: { $in: users },
            status: 'accepted',
            evidenceVersion: '1.0.0',
            'activity.courseId': courseId,
            'activity.revisionId': course.activeRevisionId,
            'activity.contentHash': hash,
            'evaluator.executionMode': { $in: ['REAL_APPROVED', 'DETERMINISTIC_FALLBACK'] },
            $or: approved.map((activity) => ({
              'activity.activityId': activity.activityId,
              'activity.activityRevision': activity.activityRevision
            }))
          }
        },
        {
          $lookup: {
            from: 'student_attempts',
            let: {
              actor: '$userId',
              attempt: '$attemptId',
              evidence: '$evidenceId',
              activityId: '$activity.activityId',
              activityRevision: '$activity.activityRevision',
              activityType: '$activity.activityType'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$actor'] },
                      { $eq: ['$attemptId', '$$attempt'] },
                      { $eq: ['$evidenceId', '$$evidence'] },
                      { $eq: ['$activityId', '$$activityId'] },
                      { $eq: ['$activityRevision', '$$activityRevision'] },
                      { $eq: ['$activityType', '$$activityType'] },
                      { $eq: ['$status', 'graded'] },
                      { $eq: ['$processingState', 'completed'] },
                      { $eq: ['$courseId', courseId] },
                      { $eq: ['$revisionId', course.activeRevisionId] },
                      { $eq: ['$contentHash', hash] }
                    ]
                  }
                }
              },
              { $project: { _id: 0, status: 1 } }
            ],
            as: 'receipt'
          }
        },
        { $match: { 'receipt.0': { $exists: true } } },
        {
          $project: {
            _id: 0,
            userId: 1,
            activityType: '$activity.activityType',
            mastered: '$masteryAchieved',
            week: {
              $dateToString: {
                date: '$timestamp',
                format: '%G-W%V',
                timezone: 'UTC'
              }
            }
          }
        },
        {
          $group: {
            _id: { userId: '$userId', activityType: '$activityType', week: '$week' },
            mastered: { $max: '$mastered' }
          }
        },
        {
          $project: {
            _id: 0,
            userId: '$_id.userId',
            activityType: '$_id.activityType',
            week: '$_id.week',
            mastered: 1
          }
        }
      ])
        .option({ maxTimeMS: 5000 })
        .exec()
    : [];
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
