/**
 * Learner preferences collected at onboarding and editable from settings.
 *
 * These are *stated preferences*, not verified competency. `selfReportedLevel`
 * is a starting point only; nothing here is an ability estimate or a
 * learning-style classification. Assessment evidence stays in the evidence
 * records and is never copied into this profile.
 *
 * One store: `UserProfile.learningProfile`. The sign-up `onboardingDraft` on the
 * auth user is a one-time capture and is not read after onboarding.
 */

export const LEARNING_GOALS = [
  'understand_concepts',
  'exam_prep',
  'learn_new_subject',
  'practice_regularly',
  'study_with_peers'
] as const;
export const SELF_REPORTED_LEVELS = ['beginner', 'intermediate', 'advanced', 'not_sure'] as const;
export const EXPLANATION_LANGUAGES = ['en', 'fr', 'ar'] as const;
export const LEARNING_FORMATS = [
  'step_by_step',
  'examples',
  'visual',
  'practice',
  'peer_discussion'
] as const;
export const STUDY_TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
export const COLLABORATION_STYLES = ['individual', 'collaborative', 'mixed'] as const;
export const ONBOARDING_STATUSES = ['pending', 'skipped', 'completed'] as const;

export type LearningGoal = (typeof LEARNING_GOALS)[number];
export type SelfReportedLevel = (typeof SELF_REPORTED_LEVELS)[number];
export type ExplanationLanguage = (typeof EXPLANATION_LANGUAGES)[number];
export type LearningFormat = (typeof LEARNING_FORMATS)[number];
export type StudyTime = (typeof STUDY_TIMES)[number];
export type CollaborationStyle = (typeof COLLABORATION_STYLES)[number];
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export interface LearningProfile {
  onboardingStatus: OnboardingStatus;
  goals: LearningGoal[];
  /** Free text, trimmed, short. */
  subjects: string[];
  selfReportedLevel: SelfReportedLevel;
  /** Ordered: the first entry is the primary explanation language. */
  languages: ExplanationLanguage[];
  formats: LearningFormat[];
  /** Typical session length in minutes, null when not stated. */
  sessionMinutes: number | null;
  studyTime: StudyTime | null;
  collaboration: CollaborationStyle | null;
  reduceMotion: boolean;
  largeText: boolean;
}

export const FOCUS_PRESETS = [25, 45, 60] as const;
export const MAX_SESSION_MINUTES = 180;

export function defaultLearningProfile(): LearningProfile {
  return {
    onboardingStatus: 'pending',
    goals: [],
    subjects: [],
    selfReportedLevel: 'not_sure',
    languages: ['en'],
    formats: [],
    sessionMinutes: null,
    studyTime: null,
    collaboration: null,
    reduceMotion: false,
    largeText: false
  };
}

function pickAll<T extends string>(value: unknown, allowed: readonly T[], limit: number): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (
      typeof item === 'string' &&
      (allowed as readonly string[]).includes(item) &&
      !out.includes(item as T)
    ) {
      out.push(item as T);
    }
    if (out.length >= limit) break;
  }
  return out;
}

function pickOne<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Strictly normalise untrusted input over a base profile. Unknown keys are
 * dropped, enums are checked, lists are bounded. Fields absent from `input`
 * keep the base value, so a partial save cannot erase other preferences.
 */
export function normalizeLearningProfile(
  input: unknown,
  base: LearningProfile = defaultLearningProfile()
): LearningProfile {
  const raw: Record<string, unknown> =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const next: LearningProfile = { ...base };
  if ('onboardingStatus' in raw) {
    next.onboardingStatus =
      pickOne(raw.onboardingStatus, ONBOARDING_STATUSES) ?? base.onboardingStatus;
  }
  if ('goals' in raw) next.goals = pickAll(raw.goals, LEARNING_GOALS, LEARNING_GOALS.length);
  if ('subjects' in raw) {
    next.subjects = Array.isArray(raw.subjects)
      ? [
          ...new Set(
            raw.subjects
              .filter((s): s is string => typeof s === 'string')
              .map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 60))
              .filter(Boolean)
          )
        ].slice(0, 10)
      : [];
  }
  if ('selfReportedLevel' in raw) {
    next.selfReportedLevel =
      pickOne(raw.selfReportedLevel, SELF_REPORTED_LEVELS) ?? base.selfReportedLevel;
  }
  if ('languages' in raw) {
    const languages = pickAll(raw.languages, EXPLANATION_LANGUAGES, EXPLANATION_LANGUAGES.length);
    next.languages = languages.length ? languages : base.languages;
  }
  if ('formats' in raw)
    next.formats = pickAll(raw.formats, LEARNING_FORMATS, LEARNING_FORMATS.length);
  if ('sessionMinutes' in raw) {
    const minutes = raw.sessionMinutes;
    next.sessionMinutes =
      typeof minutes === 'number' &&
      Number.isInteger(minutes) &&
      minutes >= 5 &&
      minutes <= MAX_SESSION_MINUTES
        ? minutes
        : null;
  }
  if ('studyTime' in raw) next.studyTime = pickOne(raw.studyTime, STUDY_TIMES);
  if ('collaboration' in raw) next.collaboration = pickOne(raw.collaboration, COLLABORATION_STYLES);
  if ('reduceMotion' in raw) next.reduceMotion = raw.reduceMotion === true;
  if ('largeText' in raw) next.largeText = raw.largeText === true;
  return next;
}

/** Nearest preset to a stated session length; custom lengths are kept as-is. */
export function suggestFocusMinutes(
  profile: Pick<LearningProfile, 'sessionMinutes'> | null
): number {
  const stated = profile?.sessionMinutes;
  if (!stated) return FOCUS_PRESETS[0];
  return Math.min(MAX_SESSION_MINUTES, Math.max(5, stated));
}

export type HomeAction = 'courses' | 'study_together' | 'visual_lab';

/**
 * Deterministic ordering of the home quick actions from stated preferences.
 * No model call: this only reorders existing destinations and never hides one.
 */
export function orderHomeActions(profile: LearningProfile | null): HomeAction[] {
  const base: HomeAction[] = ['courses', 'study_together', 'visual_lab'];
  if (!profile) return base;
  const wantsPeers =
    profile.collaboration === 'collaborative' ||
    profile.goals.includes('study_with_peers') ||
    profile.formats.includes('peer_discussion');
  const wantsVisual = profile.formats.includes('visual');
  const score = (action: HomeAction): number => {
    if (action === 'study_together')
      return wantsPeers ? 2 : profile.collaboration === 'individual' ? -1 : 0;
    if (action === 'visual_lab') return wantsVisual ? 1 : 0;
    return 1.5;
  };
  return [...base].sort((a, b) => score(b) - score(a));
}

/** The only fields the AI tutor needs; deliberately excludes goals and subjects. */
export function tutorPreferenceHints(profile: LearningProfile | null): {
  language: ExplanationLanguage;
  stepByStep: boolean;
  examples: boolean;
  guidedQuestions: boolean;
} | null {
  if (!profile || profile.onboardingStatus === 'pending') return null;
  return {
    language: profile.languages[0] ?? 'en',
    stepByStep: profile.formats.includes('step_by_step'),
    examples: profile.formats.includes('examples'),
    guidedQuestions: profile.formats.includes('practice')
  };
}
