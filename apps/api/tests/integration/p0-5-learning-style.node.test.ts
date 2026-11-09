/**
 * P0-5 — private, provisional learning-style profile against real PostgreSQL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import {
  getLearningStyle,
  learningStyleCue,
  saveLearningStyle
} from '../../modules/study/src/services/learningStyle';
import {
  LEARNING_STYLE_PROBE,
  LearningStyleValidationError,
  STYLE_CUES
} from '../../modules/study/src/services/learningStyleProbe';

const answersWith = (optionId: string) =>
  Object.fromEntries(LEARNING_STYLE_PROBE.map((q) => [q.id, optionId]));

test('P0-5 learning style: private provisional profile saved, read and used for hint cues', async (t) => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  await connectDatabase();
  t.after(async () => {
    try {
      await prisma.learningStyleProfile.deleteMany({
        where: { userId: { startsWith: 'style_learner' } }
      });
    } finally {
      await disconnectDatabase().catch(() => {});
    }
  });

  const learner = 'style_learner';
  assert.equal(await getLearningStyle(learner), null);
  assert.equal(await learningStyleCue(learner), null);

  // All 'a' options: visual 2, example 2, repetition 1, step_by_step 1. Visual wins the tie by style order.
  const first = await saveLearningStyle(learner, answersWith('a'));
  assert.equal(first.provisional, true);
  assert.equal(first.primary, 'visual');
  assert.equal((await getLearningStyle(learner))?.primary, 'visual');
  assert.equal(await learningStyleCue(learner), STYLE_CUES.visual);

  // A different learner sees nothing about this profile.
  assert.equal(await getLearningStyle('another_learner'), null);

  // Retaking the probe replaces the profile: all 'b' options give analogy 3.
  const retake = await saveLearningStyle(learner, answersWith('b'));
  assert.equal(retake.primary, 'analogy');
  assert.equal(await learningStyleCue(learner), STYLE_CUES.analogy);
  const documents = await prisma.learningStyleProfile.count({
    where: { userId: learner }
  });
  assert.equal(documents, 1);

  // Incomplete or unknown answers never create or change a profile.
  await assert.rejects(() => saveLearningStyle(learner, { q1: 'a' }), LearningStyleValidationError);
  assert.equal((await getLearningStyle(learner))?.primary, 'analogy');
});
