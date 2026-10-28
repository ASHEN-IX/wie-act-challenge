import type {
  ActivityDefinition,
  AttemptSubmission,
  Contract
} from '../../../../shared/ednova/contracts';

export type ActivityEvaluation =
  | { status: 'graded'; score: number; isCorrect: boolean; feedback: string }
  | { status: 'unavailable'; code: 'UNAVAILABLE'; retryable: true };

/** Pure trusted-code evaluation. No answer-presence heuristic, executable rubric,
 * model calls, or generated fallback text can certify correctness.
 * exact-answer-v1 is a provisional local rubric policy, not a new wire schema:
 * answerKey[i] is the exact NFC/trimmed answer for public steps[i].
 * Existing ambiguous free-text rubrics and all model evaluations fail closed.
 */
export function evaluateActivity(
  definition: ActivityDefinition,
  evaluation: Contract<'ServerEvaluationDefinition'>,
  submission: AttemptSubmission
): ActivityEvaluation {
  const unavailable = { status: 'unavailable', code: 'UNAVAILABLE', retryable: true } as const;
  if (evaluation.evaluatorType !== 'deterministic_rubric') return unavailable;
  let isCorrect: boolean;
  if (definition.activityType === 'InteractiveQuiz' && 'selectedOptionIds' in submission.answers) {
    if (
      !['v1', 'exact-options-v1'].includes(evaluation.rubricVersion) ||
      !evaluation.answerKey.length ||
      new Set(evaluation.answerKey).size !== evaluation.answerKey.length ||
      evaluation.answerKey.some(
        (id) => !definition.presentationData.options.some((o) => o.id === id)
      ) ||
      (!definition.presentationData.isMultiSelect && evaluation.answerKey.length !== 1)
    )
      return unavailable;
    isCorrect =
      submission.answers.selectedOptionIds.length === evaluation.answerKey.length &&
      submission.answers.selectedOptionIds.every((id) => evaluation.answerKey.includes(id));
  } else if (definition.activityType === 'GuidedProblem' && 'steps' in submission.answers) {
    if (
      evaluation.rubricVersion !== 'exact-answer-v1' ||
      evaluation.answerKey.length !== definition.presentationData.steps.length
    )
      return unavailable;
    const answers = submission.answers.steps;
    isCorrect =
      answers.length === definition.presentationData.steps.length &&
      definition.presentationData.steps.every((s, i) => {
        const answer = answers.find((a) => a.stepId === s.stepId)?.answer;
        return (
          typeof answer === 'string' &&
          answer.normalize('NFC').trim() === evaluation.answerKey[i].normalize('NFC').trim()
        );
      });
  } else return unavailable;
  return {
    status: 'graded',
    score: isCorrect ? 1 : 0,
    isCorrect,
    feedback: isCorrect
      ? 'Your answer matches the reviewed assessment definition.'
      : 'Your answer does not meet the reviewed assessment definition. Review the material and try again.'
  };
}
