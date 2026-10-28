/** Versioned offline-safe motivational rewards. No reward is academic mastery.
 * The existing Gamification document atomically stores balance + application
 * markers. The separate immutable-identity ledger is a recoverable audit mirror;
 * its existence alone never suppresses an unapplied balance update.
 */
import crypto from 'node:crypto';
import Gamification, { type IGamification } from '../models/Gamification';
import { LearningRewardLedger } from '../models/LearningRewardLedger';
import { LearningEvidence, StudentAttempt } from '../../../study/src/models';
import { resolveStoredActivity } from '../../../study/src/services/activityResolution';
import { canReadCourse } from '../../../study/src/services/resourceAccess';

const POLICY = 'learning-v1';
const XP = 20;
const DAILY_TOPIC_CAP = 300;
const MAX_MARKERS = 10000;
export class LearningRewardError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code === 'FORBIDDEN' ? 'Learning evidence unavailable' : 'Learning reward unavailable');
  }
}
type Marker = NonNullable<IGamification['evidenceAwards']>[number];
const hash = (value: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const duplicate = (e: unknown) => (e as { code?: number }).code === 11000;
const badgeDefinitions = [
  {
    id: 'learning_first_check',
    name: 'First verified check',
    description: 'Complete one verified personal learning check.',
    icon: '✓'
  },
  {
    id: 'learning_five_checks',
    name: 'Five verified checks',
    description: 'Complete five distinct verified learning activities.',
    icon: '★'
  },
  {
    id: 'learning_group_check',
    name: 'Learning together',
    description: 'Complete your own verified check in a study room.',
    icon: '◎'
  }
];
async function ready() {
  await Promise.all([Gamification.init(), LearningRewardLedger.init()]);
}
async function eligible(actor: string, evidenceId: string) {
  const evidence = await LearningEvidence.findOne({
    userId: actor,
    evidenceId,
    status: 'accepted'
  }).lean();
  if (!evidence) throw new LearningRewardError(404, 'FORBIDDEN');
  if (
    !evidence.masteryAchieved ||
    evidence.score < 0.8 ||
    evidence.evaluator.executionMode === 'MOCK_TEST' ||
    (evidence.evaluator.type === 'llm_evaluation' &&
      evidence.evaluator.executionMode !== 'REAL_APPROVED')
  )
    throw new LearningRewardError(409, 'EVIDENCE_NOT_REWARDABLE');
  const attempt = await StudentAttempt.findOne({
    userId: actor,
    attemptId: evidence.attemptId,
    evidenceId,
    status: 'graded',
    processingState: 'completed'
  }).lean();
  if (
    !attempt ||
    attempt.assessmentResult?.status !== 'graded' ||
    attempt.assessmentResult.evidenceId !== evidenceId ||
    attempt.assessmentResult.isCorrect !== true ||
    attempt.assessmentResult.score !== evidence.score
  )
    throw new LearningRewardError(409, 'EVIDENCE_NOT_REWARDABLE');
  const { definition, record, revision } = await resolveStoredActivity(
    actor,
    evidence.activity.activityId,
    evidence.activity.courseId,
    evidence.activity.revisionId
  );
  for (const key of [
    'courseId',
    'revisionId',
    'contentHash',
    'activityId',
    'activityRevision',
    'activityType'
  ] as const)
    if (evidence.activity[key] !== definition[key] || attempt[key] !== definition[key])
      throw new LearningRewardError(409, 'EVIDENCE_PIN_MISMATCH');
  if (
    evidence.objectiveId !== definition.objectiveId ||
    evidence.evaluator.type !== record.serverEvaluation.evaluatorType ||
    evidence.evaluator.validationVersion !== record.serverEvaluation.rubricVersion
  )
    throw new LearningRewardError(409, 'EVIDENCE_PIN_MISMATCH');
  const topic = (
    revision.topics as Array<{
      id?: string;
      objectives?: Array<{ id?: string; objectiveId?: string }>;
      subtopics?: Array<{ learning_objectives?: Array<{ id?: string; objectiveId?: string }> }>;
    }>
  ).find((row) =>
    [
      ...(row.objectives || []),
      ...(row.subtopics || []).flatMap((s) => s.learning_objectives || [])
    ].some((objective) => (objective.id || objective.objectiveId) === evidence.objectiveId)
  );
  if (!topic?.id) throw new LearningRewardError(409, 'EVIDENCE_TOPIC_UNAVAILABLE');
  return { evidence, topicId: topic.id, group: Boolean(attempt.roomId) };
}

/** Only a server-created accepted evidence identity is input; caller never supplies XP. */
export async function awardAcceptedLearningEvidence(
  actor: string,
  evidenceId: string,
  fault?: (point: 'afterClaim' | 'afterApply') => Promise<void>
) {
  await ready();
  const { evidence, group, topicId } = await eligible(actor, evidenceId);
  const completionKey = hash([
    actor,
    evidence.activity.courseId,
    evidence.activity.revisionId,
    evidence.activity.contentHash,
    evidence.activity.activityId,
    evidence.activity.activityRevision,
    evidence.objectiveId
  ]);
  const awardId = 'award_' + hash([actor, completionKey]).slice(0, 40);
  try {
    await LearningRewardLedger.updateOne(
      { userId: actor, completionKey },
      {
        $setOnInsert: {
          userId: actor,
          completionKey,
          awardId,
          evidenceId,
          policyVersion: POLICY,
          status: 'pending'
        }
      },
      { upsert: true }
    );
  } catch (e) {
    if (!duplicate(e)) throw e;
  }
  await fault?.('afterClaim');
  try {
    await Gamification.updateOne(
      { userId: actor },
      { $setOnInsert: { userId: actor } },
      { upsert: true }
    );
  } catch (e) {
    if (!duplicate(e)) throw e;
  }
  let applied: Marker | undefined;
  for (let retry = 0; retry < 100; retry++) {
    const profile = await Gamification.findOne({ userId: actor }).lean();
    if (!profile) throw new LearningRewardError(503, 'PERSISTENCE_UNAVAILABLE');
    const markers = profile.evidenceAwards || [];
    applied = markers.find((m) => m.completionKey === completionKey);
    if (applied) break;
    if (markers.length >= MAX_MARKERS)
      throw new LearningRewardError(503, 'REWARD_STORAGE_CAPACITY');
    const day = new Date(evidence.timestamp).toISOString().slice(0, 10);
    const topicKey = hash([evidence.activity.courseId, topicId]);
    const daily = markers
      .filter((m) => m.day === day && m.topicKey === topicKey)
      .reduce((s, m) => s + m.xp, 0);
    const xp = Math.max(0, Math.min(XP, DAILY_TOPIC_CAP - daily));
    const marker: Marker = {
      awardId,
      completionKey,
      evidenceId,
      policyVersion: POLICY,
      xp,
      reason:
        xp === 0
          ? 'Daily topic learning reward cap reached'
          : group
            ? 'Verified personal check in a study room'
            : 'Verified individual learning check',
      day,
      topicKey,
      group,
      timestamp: new Date(evidence.timestamp)
    };
    const all = [...markers, marker];
    const eligibleBadges = badgeDefinitions.filter((b, i) =>
      i === 0 ? all.length >= 1 : i === 1 ? all.length >= 5 : all.some((m) => m.group)
    );
    const achievements = [...profile.achievements];
    for (const badge of eligibleBadges)
      if (!achievements.some((b) => b.id === badge.id))
        achievements.push({ ...badge, unlockedAt: new Date() });
    if (!(await canReadCourse(actor, evidence.activity.courseId)))
      throw new LearningRewardError(403, 'FORBIDDEN');
    const totalXp = profile.totalXp + xp;
    const version = (profile as unknown as { __v?: number }).__v;
    const updated = await Gamification.collection.updateOne(
      {
        _id: profile._id,
        ...(version === undefined ? { __v: { $exists: false } } : { __v: version })
      },
      {
        $set: {
          totalXp,
          level: Math.floor(totalXp / 100) + 1,
          evidenceAwards: all,
          achievements,
          updatedAt: new Date()
        },
        $inc: { __v: 1 }
      }
    );
    if (updated.modifiedCount) {
      applied = marker;
      break;
    }
  }
  if (!applied) throw new LearningRewardError(503, 'REWARD_BUSY');
  await fault?.('afterApply');
  await LearningRewardLedger.updateOne(
    { userId: actor, completionKey },
    {
      $set: { status: 'applied', xp: applied.xp, reason: applied.reason, appliedAt: new Date() }
    }
  );
  await LearningEvidence.updateOne(
    { userId: actor, evidenceId },
    {
      $set: {
        'rewardReference.finalAwardId': applied.awardId,
        'rewardReference.policyVersion': POLICY
      }
    }
  );
  if (!(await canReadCourse(actor, evidence.activity.courseId)))
    throw new LearningRewardError(403, 'FORBIDDEN');
  return {
    awardId: applied.awardId,
    xp: applied.xp,
    reason: applied.reason,
    status: 'applied' as const,
    policyVersion: POLICY
  };
}

/** Pure read: refreshing never creates an award or repeats a notification. */
export async function learningRewardSummary(actor: string) {
  const profile = await Gamification.findOne({ userId: actor }).lean();
  const awards = profile?.evidenceAwards || [];
  const totalXp = profile?.totalXp || 0;
  const pending = await LearningRewardLedger.countDocuments({ userId: actor, status: 'pending' });
  const pendingAwards = await LearningRewardLedger.find({ userId: actor, status: 'pending' })
    .limit(20)
    .lean();
  return {
    totalXp,
    level: Math.floor(totalXp / 100) + 1,
    levelProgress: totalXp % 100,
    nextLevelXp: 100,
    learningXp: awards.reduce((s, a) => s + a.xp, 0),
    legacyXp: totalXp - awards.reduce((s, a) => s + a.xp, 0),
    pending,
    pendingAwards: pendingAwards.map((a) => ({
      awardId: String(a.awardId),
      evidenceId: String(a.evidenceId)
    })),
    policyVersion: POLICY,
    policy: {
      xpPerCompletion: XP,
      maxDailyTopicXp: DAILY_TOPIC_CAP,
      repeatRule:
        'One reward per learner and exact reviewed activity revision; UTC-day cap per course topic.'
    },
    meaning: 'Motivation only; XP and level are not academic mastery.',
    achievements: (profile?.achievements || [])
      .filter((b) => b.id.startsWith('learning_'))
      .map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        unlockedAt: b.unlockedAt
      })),
    awards: [...awards]
      .reverse()
      .slice(0, 50)
      .map((a) => ({
        awardId: a.awardId,
        xp: a.xp,
        reason: a.reason,
        policyVersion: a.policyVersion,
        timestamp: a.timestamp,
        group: a.group
      }))
  };
}
