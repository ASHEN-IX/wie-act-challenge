/**
 * P0-5 — provisional learning-style probe. Self-report only: it chooses how a
 * private explanation is phrased. It never grades, changes mastery, or is shown
 * to anyone but the learner. Pure module: no I/O, safe to unit test.
 */

export const LEARNING_STYLES = [
  'visual',
  'analogy',
  'step_by_step',
  'example',
  'repetition',
  'problem_solving'
] as const;

export type LearningStyle = (typeof LEARNING_STYLES)[number];

interface ProbeOption {
  id: string;
  label: string;
  style: LearningStyle;
}

interface ProbeQuestion {
  id: string;
  prompt: string;
  options: ProbeOption[];
}

// Three options per question, one per style where possible; each style appears
// three times overall, so no style is favoured by construction.
export const LEARNING_STYLE_PROBE: readonly ProbeQuestion[] = [
  {
    id: 'q1',
    prompt: 'When a new concept is hard, what helps you most at first?',
    options: [
      { id: 'a', label: 'Seeing a diagram or chart', style: 'visual' },
      { id: 'b', label: 'Relating it to something I already know', style: 'analogy' },
      { id: 'c', label: 'Following numbered steps', style: 'step_by_step' }
    ]
  },
  {
    id: 'q2',
    prompt: 'Which kind of practice do you prefer?',
    options: [
      { id: 'a', label: 'Working through one concrete example', style: 'example' },
      { id: 'b', label: 'Repeating the rule until it sticks', style: 'repetition' },
      { id: 'c', label: 'Being given a problem to crack', style: 'problem_solving' }
    ]
  },
  {
    id: 'q3',
    prompt: 'When you read a definition, you usually...',
    options: [
      { id: 'a', label: 'Sketch its parts', style: 'visual' },
      { id: 'b', label: 'Look for a comparison', style: 'analogy' },
      { id: 'c', label: 'Check each condition in order', style: 'step_by_step' }
    ]
  },
  {
    id: 'q4',
    prompt: 'To remember a rule, you...',
    options: [
      { id: 'a', label: 'Say it again in your own words', style: 'repetition' },
      { id: 'b', label: 'Try it on a case', style: 'example' },
      { id: 'c', label: 'Start from what you need to find', style: 'problem_solving' }
    ]
  },
  {
    id: 'q5',
    prompt: 'A study session works best when...',
    options: [
      { id: 'a', label: 'Each step is clear', style: 'step_by_step' },
      { id: 'b', label: 'Each idea links to something I know', style: 'analogy' },
      { id: 'c', label: 'I can see the structure on a page', style: 'visual' }
    ]
  },
  {
    id: 'q6',
    prompt: 'When you get stuck, you...',
    options: [
      { id: 'a', label: 'Look for a similar worked case', style: 'example' },
      { id: 'b', label: 'Reread the rule slowly', style: 'repetition' },
      { id: 'c', label: 'Work backwards from the goal', style: 'problem_solving' }
    ]
  }
];

// Wording for private hints. Short, neutral, and never a substitute for the source.
export const STYLE_CUES: Record<LearningStyle, string> = {
  visual: 'Sketch the parts and how they connect before you check the passage.',
  analogy: 'Compare this with a familiar situation you already understand.',
  step_by_step: 'Work through one condition at a time and name the rule you apply.',
  example: 'Test the idea on one concrete case before you generalize.',
  repetition: 'Restate the rule in your own words, then check it once more.',
  problem_solving: 'Start from what you need to find and work backwards to the rule.'
};

export interface LearningStyleResult {
  primary: LearningStyle;
  ranking: Array<{ style: LearningStyle; count: number }>;
  provisional: true;
}

export class LearningStyleValidationError extends Error {
  readonly status = 400;
}

/** Every question must have exactly one known option. Unknown keys are rejected. */
export function validateProbeAnswers(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new LearningStyleValidationError('Answers must be an object keyed by question id');
  const answers = input as Record<string, unknown>;
  const questionIds = new Set(LEARNING_STYLE_PROBE.map((q) => q.id));
  for (const key of Object.keys(answers))
    if (!questionIds.has(key)) throw new LearningStyleValidationError(`Unknown question: ${key}`);
  const clean: Record<string, string> = {};
  for (const question of LEARNING_STYLE_PROBE) {
    const choice = answers[question.id];
    if (typeof choice !== 'string' || !question.options.some((o) => o.id === choice))
      throw new LearningStyleValidationError(`Answer required for ${question.id}`);
    clean[question.id] = choice;
  }
  return clean;
}

/**
 * Score a complete, validated set of answers. Ties keep the order of
 * LEARNING_STYLES, so the same answers always give the same profile.
 */
export function scoreLearningStyleProbe(answers: Record<string, string>): LearningStyleResult {
  const counts = new Map<LearningStyle, number>(LEARNING_STYLES.map((s) => [s, 0]));
  for (const question of LEARNING_STYLE_PROBE) {
    const option = question.options.find((o) => o.id === answers[question.id]);
    if (option) counts.set(option.style, (counts.get(option.style) ?? 0) + 1);
  }
  const ranking = LEARNING_STYLES.map((style) => ({ style, count: counts.get(style) ?? 0 })).sort(
    (a, b) => b.count - a.count
  );
  return { primary: ranking[0].style, ranking, provisional: true };
}
