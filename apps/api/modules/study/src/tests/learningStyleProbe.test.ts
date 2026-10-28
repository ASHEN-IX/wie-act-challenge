/**
 * P0-5 — provisional learning-style probe: validation, scoring and balance.
 */

import {
  LEARNING_STYLE_PROBE,
  LEARNING_STYLES,
  LearningStyleValidationError,
  STYLE_CUES,
  scoreLearningStyleProbe,
  validateProbeAnswers
} from '../services/learningStyleProbe';

const allAnswers = (optionId: string) =>
  Object.fromEntries(LEARNING_STYLE_PROBE.map((q) => [q.id, optionId]));

describe('learning style probe balance', () => {
  it('gives every style exactly three options across the probe', () => {
    const counts = new Map<string, number>(LEARNING_STYLES.map((s) => [s, 0]));
    for (const question of LEARNING_STYLE_PROBE)
      for (const option of question.options) counts.set(option.style, (counts.get(option.style) ?? 0) + 1);
    for (const style of LEARNING_STYLES) expect(counts.get(style)).toBe(3);
  });

  it('has a non-empty cue for every style', () => {
    for (const style of LEARNING_STYLES) expect(STYLE_CUES[style].length).toBeGreaterThan(10);
  });
});

describe('validateProbeAnswers', () => {
  it('accepts one known option per question', () => {
    expect(validateProbeAnswers(allAnswers('a'))).toEqual(allAnswers('a'));
  });

  it.each([
    ['a missing question', { q1: 'a' }],
    ['an unknown option', { ...allAnswers('a'), q1: 'z' }],
    ['an unknown question', { ...allAnswers('a'), q9: 'a' }],
    ['a non-object body', ['a', 'b']],
    ['a null body', null]
  ])('rejects %s', (_label, input) => {
    expect(() => validateProbeAnswers(input)).toThrow(LearningStyleValidationError);
  });
});

describe('scoreLearningStyleProbe', () => {
  it('returns a provisional profile with the highest count as primary', () => {
    // q1-a visual, q2-c problem_solving, q3-a visual, q4-a repetition, q5-c visual, q6-a example
    const result = scoreLearningStyleProbe({
      q1: 'a',
      q2: 'c',
      q3: 'a',
      q4: 'a',
      q5: 'c',
      q6: 'a'
    });
    expect(result.provisional).toBe(true);
    expect(result.primary).toBe('visual');
    expect(result.ranking[0]).toEqual({ style: 'visual', count: 3 });
    expect(result.ranking.reduce((sum, r) => sum + r.count, 0)).toBe(LEARNING_STYLE_PROBE.length);
  });

  it('breaks ties in a fixed order so identical answers always give the same profile', () => {
    // One vote per style: q1-a visual, q2-a example, q3-b analogy, q4-c problem_solving,
    // q5-a step_by_step, q6-b repetition. Every count is 1, so order follows LEARNING_STYLES.
    const tied = { q1: 'a', q2: 'a', q3: 'b', q4: 'c', q5: 'a', q6: 'b' };
    const first = scoreLearningStyleProbe(tied);
    const second = scoreLearningStyleProbe(tied);
    expect(first).toEqual(second);
    expect(first.ranking.map((r) => r.count)).toEqual(LEARNING_STYLES.map(() => 1));
    expect(first.ranking.map((r) => r.style)).toEqual([...LEARNING_STYLES]);
    expect(first.primary).toBe('visual');
  });
});
