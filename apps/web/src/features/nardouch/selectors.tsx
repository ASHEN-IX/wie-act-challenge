import type {
  LanguagePreference,
  LearningMode,
} from "@noveris/shared/ednova/nardouch";
const control =
  "mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm";
export function LearningModeSelector({
  value,
  onChange,
  disabled,
}: {
  value: LearningMode;
  onChange: (mode: LearningMode) => void;
  disabled: boolean;
}) {
  return (
    <label className="text-xs font-medium">
      Learning mode
      <select
        aria-label="Learning mode"
        className={control}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as LearningMode)}
      >
        <option value="explain">Explain a concept</option>
        <option value="socratic">Guide me with hints</option>
        <option value="practice">Practice together</option>
        <option value="peer">Prepare a peer discussion</option>
      </select>
    </label>
  );
}
export function LanguageSelector({
  value,
  onChange,
  disabled,
}: {
  value: LanguagePreference;
  onChange: (preference: LanguagePreference) => void;
  disabled: boolean;
}) {
  return (
    <>
      <label className="text-xs font-medium">
        Response language
        <select
          aria-label="Response language"
          className={control}
          value={value.language}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...value,
              language: e.target.value as LanguagePreference["language"],
            })
          }
        >
          <option value="auto">Match my language</option>
          <option value="darija">Tunisian Darija</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="mixed">Darija / français / English</option>
        </select>
      </label>
      <label className="text-xs font-medium">
        Darija writing
        <select
          aria-label="Darija writing"
          className={control}
          value={value.script}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...value,
              script: e.target.value as LanguagePreference["script"],
            })
          }
        >
          <option value="auto">Match my writing</option>
          <option value="arabizi">Arabizi · 3arbi bel latin</option>
          <option value="arabic">Arabic · العربية</option>
        </select>
      </label>
    </>
  );
}
