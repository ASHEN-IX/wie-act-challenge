import type {
  CollaborationStyle,
  ExplanationLanguage,
  LearningFormat,
  LearningGoal,
  SelfReportedLevel,
  StudyTime,
} from "@noveris/shared/ednova/learningProfile";

export const GOAL_OPTIONS: ReadonlyArray<{ value: LearningGoal; label: string }> = [
  { value: "understand_concepts", label: "Understand difficult concepts" },
  { value: "exam_prep", label: "Prepare for exams" },
  { value: "learn_new_subject", label: "Learn a new subject" },
  { value: "practice_regularly", label: "Practice regularly" },
  { value: "study_with_peers", label: "Study with classmates" },
];

export const LEVEL_OPTIONS: ReadonlyArray<{ value: SelfReportedLevel; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "not_sure", label: "Not sure" },
];

export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: ExplanationLanguage; label: string }> = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

export const FORMAT_OPTIONS: ReadonlyArray<{ value: LearningFormat; label: string }> = [
  { value: "step_by_step", label: "Step-by-step explanations" },
  { value: "examples", label: "Practical examples" },
  { value: "visual", label: "Visual explanations" },
  { value: "practice", label: "Practice exercises" },
  { value: "peer_discussion", label: "Discussion with peers" },
];

export const STUDY_TIME_OPTIONS: ReadonlyArray<{ value: StudyTime; label: string }> = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

export const COLLABORATION_OPTIONS: ReadonlyArray<{ value: CollaborationStyle; label: string }> = [
  { value: "individual", label: "On my own" },
  { value: "mixed", label: "A mix of both" },
  { value: "collaborative", label: "With others" },
];

export const SESSION_LENGTH_OPTIONS = [25, 45, 60] as const;

/** Only same-origin relative paths; anything else falls back to the dashboard. */
export function safeNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.length > 500
  )
    return "/dashboard";
  return value;
}
