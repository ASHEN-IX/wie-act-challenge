/**
 * Tentative learner-confusion signals. Suggestions only: they never grade, never
 * change mastery or evidence, and only route the next step to peer-first help.
 */

export const REPEATED_ERRORS_THRESHOLD = 2;
export const HINT_ESCALATION_LEVEL = 2;

// Explicit help requests in English, French, Moroccan Darija (Latin script) and
// Arabic. Matching is case-insensitive substring matching on the learner's words.
export const HELP_REQUEST_PHRASES = [
  "i'm lost",
  'i am lost',
  "i don't understand",
  'i do not understand',
  "i'm confused",
  'i am confused',
  'im confused',
  'je ne comprends pas',
  'je suis perdu',
  'ma fhemtch',
  'ma fhamtch',
  'ما فهمت',
  'مش فاهم'
] as const;

export type ConfusionReason = 'repeated_errors' | 'hint_escalation' | 'help_requested';

export interface ConfusionEvidence {
  wrongAttempts?: number;
  hintLevel?: number;
  transcriptText?: string;
}

export interface ConfusionAssessment {
  tentative: boolean;
  reasons: ConfusionReason[];
}

export function helpRequestedIn(text: string): boolean {
  const lower = text.toLowerCase();
  return HELP_REQUEST_PHRASES.some((phrase) => lower.includes(phrase));
}

export function assessConfusion(evidence: ConfusionEvidence): ConfusionAssessment {
  const reasons: ConfusionReason[] = [];
  if ((evidence.wrongAttempts ?? 0) >= REPEATED_ERRORS_THRESHOLD) reasons.push('repeated_errors');
  if ((evidence.hintLevel ?? 0) >= HINT_ESCALATION_LEVEL) reasons.push('hint_escalation');
  if (evidence.transcriptText && helpRequestedIn(evidence.transcriptText)) {
    reasons.push('help_requested');
  }
  return { tentative: reasons.length > 0, reasons };
}
