/**
 * Visual Learning Lab — bounded, versioned definitions.
 *
 * The AI proposes a structured candidate; this module owns the accepted shape.
 * Nothing here executes model-generated code: engines are registered, tested
 * functions and every AI value is checked against the registry.
 */

export const VISUAL_LAB_SCHEMA_VERSION = 1 as const;
export const VISUAL_LAB_LIMITS = {
  nodes: { min: 2, max: 10 },
  edges: { min: 1, max: 20 },
  weight: { min: 1, max: 99 },
  title: 120,
  concept: 160,
  objective: 400,
  guidance: 600,
  optionLabel: 160,
  checkExplanation: 800
} as const;

export type VisualLabEngine = 'weighted_graph' | 'parameter_model' | 'spatial_3d' | 'function_plot';

export interface VisualLabError extends Error {
  readonly code: string;
}
export function visualLabError(code: string, message: string): VisualLabError {
  return Object.assign(new Error(message), { code });
}

export interface GraphNode {
  id: string;
  label: string;
}
export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}
export interface WeightedGraphScenario {
  nodes: GraphNode[];
  edges: GraphEdge[];
  source: string;
  target: string;
}

export interface ParameterScenario {
  modelId: 'newtons_second_law';
  values: { force: number; mass: number };
}

export interface SpatialScenario {
  sceneId: 'projectile_3d';
  values: { speed: number; elevation: number; heading: number; gravity: number };
}

export interface FunctionScenario {
  functionId: 'quadratic_function';
  values: { a: number; b: number; c: number };
}

export interface LabGuidance {
  instructions: string;
  predictionPrompt: string;
  hint: string;
  observationPrompt: string;
}

export interface LabSourceContext {
  mode: 'course' | 'topic';
  courseId?: string;
  revisionId?: string;
  topicId?: string;
  passageIds?: string[];
  topic?: string;
}

/** Engine + scenario pair. Discriminated so the client cannot mix engines. */
export type LabDefinition =
  | {
      engine: 'weighted_graph';
      scenario: WeightedGraphScenario;
    }
  | {
      engine: 'parameter_model';
      scenario: ParameterScenario;
    }
  | {
      engine: 'spatial_3d';
      scenario: SpatialScenario;
    }
  | {
      engine: 'function_plot';
      scenario: FunctionScenario;
    };

export interface VisualLabCheckOption {
  id: string;
  label: string;
}
export interface VisualLabCheck {
  prompt: string;
  options: VisualLabCheckOption[];
  /** Server-only. Never projected into a browser payload. */
  correctOptionId: string;
  /** Server-only until the learner submits. */
  explanation: string;
}

/** What the browser may receive. No answer key, rubric or private note. */
export interface PublicVisualLab {
  labId: string;
  schemaVersion: typeof VISUAL_LAB_SCHEMA_VERSION;
  engine: VisualLabEngine;
  title: string;
  concept: string;
  learningObjective: string;
  sourceContext: LabSourceContext;
  definition: LabDefinition;
  guidance: LabGuidance;
  check: { prompt: string; options: VisualLabCheckOption[] };
  generationMode: 'AI_PLANNED' | 'DETERMINISTIC_FALLBACK';
  createdAt: string;
}

export interface EngineCapability {
  engine: VisualLabEngine;
  label: string;
  supports: string;
  models?: readonly string[];
}
export const ENGINE_CAPABILITIES: readonly EngineCapability[] = [
  {
    engine: 'weighted_graph',
    label: 'Weighted graph explorer',
    supports: 'Weighted relationships, shortest paths and step-by-step graph traversal'
  },
  {
    engine: 'parameter_model',
    label: 'Parameter experiment',
    supports: 'Quantitative relationships between bounded inputs and a deterministic output',
    models: ['newtons_second_law']
  },
  {
    engine: 'spatial_3d',
    label: '3D explorer',
    supports: 'Bounded three-dimensional motion with deterministic geometry (projectile motion)',
    models: ['projectile_3d']
  },
  {
    engine: 'function_plot',
    label: 'Function plotter',
    supports: 'Bounded 2D curves whose shape depends on coefficients (quadratic functions)',
    models: ['quadratic_function']
  }
] as const;
