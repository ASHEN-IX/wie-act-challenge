/**
 * Browser-side decoders for the lab's public payload.
 *
 * They are strict about the *shape* the UI renders and deliberately ignore any
 * extra key the server might add. They are not authorization: every request is
 * authorized by the API.
 */
import type {
  LabDefinition,
  LabGuidance,
  LabSourceContext,
  PublicVisualLab,
} from "@study-partner/shared/visualLab/types";
import { parseWeightedGraphScenario } from "@study-partner/shared/visualLab/graph";
import { parseParameterScenario } from "@study-partner/shared/visualLab/parameter-models";
import { parseFunctionScenario } from "@study-partner/shared/visualLab/function-models";
import { parseSpatialScenario } from "@study-partner/shared/visualLab/spatial-models";

export type { PublicVisualLab };

export class LabContractError extends Error {}

function fail(): never {
  throw new LabContractError("This lab could not be displayed.");
}

function str(value: unknown, max = 2000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail();
  return value;
}

function decodeDefinition(value: unknown): LabDefinition {
  if (!value || typeof value !== "object") fail();
  const raw = value as Record<string, unknown>;
  // Engine validators throw their own typed errors; the browser boundary reports
  // one recoverable message rather than leaking internal validator text.
  try {
    if (raw.engine === "weighted_graph")
      return {
        engine: "weighted_graph",
        scenario: parseWeightedGraphScenario(raw.scenario),
      };
    if (raw.engine === "parameter_model")
      return {
        engine: "parameter_model",
        scenario: parseParameterScenario(raw.scenario),
      };
    if (raw.engine === "function_plot")
      return {
        engine: "function_plot",
        scenario: parseFunctionScenario(raw.scenario),
      };
    if (raw.engine === "spatial_3d")
      return {
        engine: "spatial_3d",
        scenario: parseSpatialScenario(raw.scenario),
      };
  } catch {
    fail();
  }
  return fail();
}

function decodeSourceContext(value: unknown): LabSourceContext {
  if (!value || typeof value !== "object") fail();
  const raw = value as Record<string, unknown>;
  if (raw.mode !== "course" && raw.mode !== "topic") fail();
  const optional = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return {
    mode: raw.mode,
    courseId: optional(raw.courseId),
    revisionId: optional(raw.revisionId),
    topicId: optional(raw.topicId),
    passageIds: Array.isArray(raw.passageIds)
      ? raw.passageIds.filter((id): id is string => typeof id === "string")
      : undefined,
    topic: optional(raw.topic),
  };
}

function decodeGuidance(value: unknown): LabGuidance {
  if (!value || typeof value !== "object") fail();
  const raw = value as Record<string, unknown>;
  return {
    instructions: str(raw.instructions),
    predictionPrompt: str(raw.predictionPrompt),
    hint: str(raw.hint),
    observationPrompt: str(raw.observationPrompt),
  };
}

export function decodeVisualLab(value: unknown): PublicVisualLab {
  if (!value || typeof value !== "object") fail();
  const wrapper = value as Record<string, unknown>;
  const lab = (wrapper.lab ?? wrapper) as Record<string, unknown>;
  if (lab.schemaVersion !== 1) fail();
  if (
    lab.generationMode !== "AI_PLANNED" &&
    lab.generationMode !== "DETERMINISTIC_FALLBACK"
  )
    fail();
  const check = lab.check as Record<string, unknown> | undefined;
  if (!check || !Array.isArray(check.options)) fail();
  const options = check.options.map((option) => {
    if (!option || typeof option !== "object") fail();
    const entry = option as Record<string, unknown>;
    return { id: str(entry.id, 64), label: str(entry.label, 400) };
  });
  if (options.length < 2) fail();
  return {
    labId: str(lab.labId, 64),
    schemaVersion: 1,
    engine:
      lab.engine === "weighted_graph" ||
      lab.engine === "spatial_3d" ||
      lab.engine === "function_plot"
        ? lab.engine
        : "parameter_model",
    title: str(lab.title, 200),
    concept: str(lab.concept, 200),
    learningObjective: str(lab.learningObjective, 600),
    sourceContext: decodeSourceContext(lab.sourceContext),
    definition: decodeDefinition(lab.definition),
    guidance: decodeGuidance(lab.guidance),
    check: { prompt: str(check.prompt, 600), options },
    generationMode: lab.generationMode,
    createdAt: str(lab.createdAt, 40),
  };
}

export function decodeVisualLabPlan(value: unknown) {
  if (!value || typeof value !== "object") fail();
  const lab = (value as { lab?: unknown }).lab;
  return decodeVisualLab(lab);
}

export interface GuideReply {
  status: "guided" | "fallback";
  text: string;
  executionMode: string;
}

export function decodeGuideResponse(value: unknown): GuideReply {
  if (!value || typeof value !== "object") fail();
  const raw = value as Record<string, unknown>;
  if (raw.status !== "guided" && raw.status !== "fallback") fail();
  return {
    status: raw.status,
    text: str(raw.text, 4000),
    executionMode: str(raw.executionMode, 40),
  };
}

export interface CheckResult {
  correct: boolean;
  correctOptionId: string;
  explanation: string;
  recordedAsEvidence: false;
  policy: string;
}

export function decodeCheckResult(value: unknown): CheckResult {
  if (!value || typeof value !== "object") fail();
  const raw = value as Record<string, unknown>;
  if (typeof raw.correct !== "boolean" || raw.recordedAsEvidence !== false)
    fail();
  return {
    correct: raw.correct,
    correctOptionId: str(raw.correctOptionId, 64),
    explanation: str(raw.explanation, 1200),
    recordedAsEvidence: false,
    policy: str(raw.policy, 80),
  };
}
