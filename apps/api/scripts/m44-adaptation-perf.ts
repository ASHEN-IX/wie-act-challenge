/** M4.4 adaptation performance measurement.
 *
 * Measures the deterministic parts only: the policy, the fingerprint, and the
 * record parse. Database latency is measured separately against real MongoDB,
 * because a synthetic number for it would be a guess.
 */
import { performance } from 'node:perf_hooks';
import {
  DEFAULT_PREFERENCES,
  parseLearningAdaptation,
  type AdaptationEvidence,
} from '../shared/ednova/learningAdaptation';
import {
  adaptationFingerprint,
  evaluateAdaptation,
  type PolicyInput,
} from '../shared/ednova/adaptationPolicy';
import type { LearningMode } from '../shared/ednova/learningModes';

const courseId = '0123456789abcdef01234567';
const revisionId = 'rev_m44';
const lessonId = 'lesson-1';
const allModes: LearningMode[] = ['read', 'guided', 'explore', 'practice', 'deep_dive'];

function evidence(count: number): AdaptationEvidence[] {
  return Array.from({ length: count }, (_, index) => ({
    evidenceClass: 'accepted_assessment' as const,
    courseId,
    revisionId,
    objectiveId: `obj_${index}`,
    mastered: index % 2 === 0,
    evaluatorVersion: '1.0.0',
  }));
}

function policyInput(count: number): PolicyInput {
  return {
    courseId,
    revisionId,
    lessonId,
    currentMode: 'read',
    preferences: { ...DEFAULT_PREFERENCES },
    evidence: evidence(count),
    support: {
      availableModes: allModes,
      hasEligibleAsset: true,
      hasProofMaterial: true,
      hasWorkedExamples: true,
    },
    evidenceFingerprint: 'fnv1a64:0123456789abcdef',
    now: new Date('2026-11-07T10:00:00.000Z'),
  };
}

function time(label: string, iterations: number, run: () => void) {
  for (let index = 0; index < Math.min(iterations, 200); index += 1) run();
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
  console.log(
    `${label.padEnd(42)} mean=${mean.toFixed(4)}ms  ` +
      `p95=${samples[Math.floor(iterations * 0.95)].toFixed(4)}ms  ` +
      `max=${samples[samples.length - 1].toFixed(4)}ms`,
  );
}

for (const count of [0, 10, 50, 200]) {
  const input = policyInput(count);
  const objectives = Array.from({ length: Math.min(count, 32) }, (_, i) => `obj_${i}`);
  console.log(`\n--- ${count} eligible evidence rows ---`);
  time('policy evaluation', 2000, () => evaluateAdaptation(input, objectives));
  time('input fingerprint', 2000, () =>
    adaptationFingerprint({
      courseId,
      revisionId,
      lessonId,
      preferences: input.preferences,
      evidence: input.evidence,
      availableModes: allModes,
    }),
  );
  const record = evaluateAdaptation(input, objectives);
  time('record parse', 2000, () =>
    parseLearningAdaptation(record, { courseId, revisionId, lessonId }),
  );
}

console.log('\n--- bounds ---');
console.log('evidence query limit   200');
console.log('objective ids accepted 32');
console.log('dismissals retained    50');
console.log('recommendation TTL     900000 ms');
