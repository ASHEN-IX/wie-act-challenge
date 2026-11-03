import type { PublicVisualLab } from "./contracts";

/** Small pure helper for labels that must stay honest about grounding. */
export function summarizeLab(lab: PublicVisualLab) {
  return {
    engine: lab.engine,
    source:
      lab.sourceContext.mode === "course"
        ? `Grounded in published revision ${lab.sourceContext.revisionId ?? ""}`.trim()
        : "Topic example, not course material",
    planned: lab.generationMode === "AI_PLANNED",
  };
}
