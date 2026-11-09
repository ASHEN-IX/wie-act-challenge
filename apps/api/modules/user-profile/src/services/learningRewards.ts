/** Versioned offline-safe motivational rewards. No reward is academic mastery.
 * The existing Gamification document atomically stores balance + application
 * markers. The separate immutable-identity ledger is a recoverable audit mirror;
 * its existence alone never suppresses an unapplied balance update.
 */
import crypto from 'node:crypto';
import Gamification, { type GamificationEvidenceAward } from '../models/Gamification';
import { LearningRewardLedger } from '../models/LearningRewardLedger';
import { Prisma } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
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
type Marker = GamificationEvidenceAward;
const hash = (value: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Prisma reports a unique violation as `P2002`; the driver used `11000`. The
// migration preserves the driver code, so accept either.
const duplicate = (e: unknown) =>
  (e as { code?: number | string }).code === 11000 || (e as { code?: string }).code === 'P2002';
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
  // Indexes are created by Prisma migrations; nothing to warm up at runtime.
}
async function eligible(actor: string, evidenceId: string) {
  const evidence = await LearningEvidence.findOne({
    userId: actor,
    evidenceId,
    status: 'accepted'
  });
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
    await prisma.learningRewardLedger.upsert({
      where: { userId_completionKey: { userId: actor, completionKey } },
      update: {},
      create: {
        id: newId(),
        userId: actor,
        completionKey,
        awardId,
        evidenceId,
        policyVersion: POLICY,
        status: 'pending'
      }
    });
  } catch (e) {
    if (!duplicate(e)) throw e;
  }
  await fault?.('afterClaim');
  try {
    await prisma.gamification.upsert({
      where: { userId: actor },
      update: {},
      create: {
        id: newId(),
        userId: actor,
        stats: {
          coursesUploaded: 0,
          tasksCompleted: 0,
          perfectSessions: 0,
          currentStreak: 0,
          longestStreak: 0,
          friendsAdded: 0,
          teamSessions: 0,
          groupSessions: 0,
          challengesCompleted: 0
        }
      }
    });
  } catch (e) {
    if (!duplicate(e)) throw e;
  }
  let applied: Marker | undefined;
  for (let retry = 0; retry < 100; retry++) {
    const profile = await Gamification.findOne({ userId: actor });
    if (!profile) throw new LearningRewardError(503, 'PERSISTENCE_UNAVAILABLE');
    const markers = profile.evidenceAwards || [];
    applied = markers.find((m: Marker) => m.completionKey === completionKey);
    if (applied) break;
    if (markers.length >= MAX_MARKERS)
      throw new LearningRewardError(503, 'REWARD_STORAGE_CAPACITY');
    const day = new Date(evidence.timestamp).toISOString().slice(0, 10);
    const topicKey = hash([evidence.activity.courseId, topicId]);
    const daily = markers
      .filter((m: Marker) => m.day === day && m.topicKey === topicKey)
      .reduce((sum: number, m: Marker) => sum + m.xp, 0);
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
      i === 0 ? all.length >= 1 : i === 1 ? all.length >= 5 : all.some((m: Marker) => m.group)
    );
    const achievements = [...profile.achievements];
    for (const badge of eligibleBadges)
      if (!achievements.some((b: { id: string }) => b.id === badge.id))
        achievements.push({ ...badge, unlockedAt: new Date() });
    if (!(await canReadCourse(actor, evidence.activity.courseId)))
      throw new LearningRewardError(403, 'FORBIDDEN');
    const totalXp = profile.totalXp + xp;
    // The `__v` guard is now a conditional update on the row version, so a
    // concurrent writer that already applied a marker makes this write a no-op.
    const updated = await prisma.gamification.updateMany({
      where: { id: profile.id, updatedAt: profile.updatedAt },
      data: {
        totalXp,
        level: Math.floor(totalXp / 100) + 1,
        evidenceAwards: all as unknown as Prisma.InputJsonValue,
        achievements: achievements as unknown as Prisma.InputJsonValue
      }
    });
    if (updated.count) {
      applied = marker;
      break;
    }
  }
  if (!applied) throw new LearningRewardError(503, 'REWARD_BUSY');
  await fault?.('afterApply');
  await LearningRewardLedger.updateOne(
    { userId: actor, completionKey },
    { status: 'applied', xp: applied.xp, reason: applied.reason, appliedAt: new Date() }
  );
  const evidenceRow = await LearningEvidence.findOne({ userId: actor, evidenceId });
  if (evidenceRow) {
    await LearningEvidence.updateOne(
      { id: evidenceRow.id },
      {
        rewardReference: {
          ...(evidenceRow.rewardReference ?? {}),
          finalAwardId: applied.awardId,
          policyVersion: POLICY
        } as unknown as Prisma.InputJsonValue
      }
    );
  }
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
  const profile = await Gamification.findOne({ userId: actor });
  const awards = profile?.evidenceAwards || [];
  const totalXp = profile?.totalXp || 0;
  const pending = (await LearningRewardLedger.findMany({ userId: actor, status: 'pending' }))
    .length;
  const pendingAwards = (
    await LearningRewardLedger.findMany({ userId: actor, status: 'pending' })
  ).slice(0, 20);
  return {
    totalXp,
    level: Math.floor(totalXp / 100) + 1,
    levelProgress: totalXp % 100,
    nextLevelXp: 100,
    learningXp: awards.reduce((sum: number, a: Marker) => sum + a.xp, 0),
    legacyXp: totalXp - awards.reduce((sum: number, a: Marker) => sum + a.xp, 0),
    pending,
    pendingAwards: pendingAwards.map((a: { awardId: string; evidenceId: string }) => ({
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
