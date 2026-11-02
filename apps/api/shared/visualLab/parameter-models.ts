/**
 * Registered mathematical models for the parameter engine.
 *
 * The planner may only name a `modelId` from this registry. Formulas are typed
 * functions here, never expressions supplied by a model or a browser.
 */
import { visualLabError, type ParameterScenario } from './types';

export interface ParameterSpec {
  key: 'force' | 'mass';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  description: string;
}

export interface ParameterModel {
  id: ParameterScenario['modelId'];
  label: string;
  concept: string;
  objective: string;
  output: { label: string; unit: string; formula: string };
  parameters: readonly [ParameterSpec, ParameterSpec];
  defaults: { force: number; mass: number };
  /** Deterministic, total function over the validated domain. */
  compute: (values: { force: number; mass: number }) => { acceleration: number };
  guidance: { predictionPrompt: string; hint: string; observationPrompt: string };
  check: {
    prompt: string;
    options: readonly { id: string; label: string }[];
    correctOptionId: string;
    explanation: string;
  };
}

export const NEWTONS_SECOND_LAW: ParameterModel = {
  id: 'newtons_second_law',
  label: "Newton's second law",
  concept: "Newton's second law (F = ma)",
  objective:
    'Relate net force, mass and acceleration and predict how each change affects the result',
  output: { label: 'Acceleration', unit: 'm/s²', formula: 'a = F / m' },
  parameters: [
    {
      key: 'force',
      label: 'Net force (F)',
      unit: 'N',
      min: 0,
      max: 200,
      step: 1,
      description: 'Total force acting on the object'
    },
    {
      key: 'mass',
      label: 'Mass (m)',
      unit: 'kg',
      min: 0.5,
      max: 50,
      step: 0.5,
      description: 'Inertial mass of the object'
    }
  ],
  defaults: { force: 40, mass: 8 },
  compute: ({ force, mass }) => ({ acceleration: force / mass }),
  guidance: {
    predictionPrompt:
      'If the mass doubles and the force stays the same, what happens to the acceleration?',
    hint: 'Try holding the force fixed and only changing the mass. Watch the acceleration and compare it with the mass.',
    observationPrompt:
      'Describe the relationship between force, mass and acceleration using your own numbers.'
  },
  check: {
    prompt: 'An object of 4 kg is pushed with a net force of 12 N. What is its acceleration?',
    options: [
      { id: 'a', label: '3 m/s²' },
      { id: 'b', label: '48 m/s²' },
      { id: 'c', label: '0.33 m/s²' },
      { id: 'd', label: '12 m/s²' }
    ],
    correctOptionId: 'a',
    explanation:
      'a = F / m = 12 N / 4 kg = 3 m/s². Doubling the mass would halve this acceleration.'
  }
};

export const PARAMETER_MODELS: readonly ParameterModel[] = [NEWTONS_SECOND_LAW];

export function getParameterModel(id: unknown): ParameterModel {
  const model = PARAMETER_MODELS.find((entry) => entry.id === id);
  if (!model)
    throw visualLabError(
      'UNSUPPORTED_MODEL',
      `Only these parameter models are supported: ${PARAMETER_MODELS.map((m) => m.id).join(', ')}`
    );
  return model;
}

export function parseParameterValues(model: ParameterModel, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', 'Parameter values must be an object');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'force,mass')
    throw visualLabError('INVALID_SCENARIO', 'Parameter values must be force and mass only');
  const result = { force: 0, mass: 0 };
  for (const spec of model.parameters) {
    const v = raw[spec.key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < spec.min || v > spec.max)
      throw visualLabError(
        'INVALID_PARAMETER',
        `${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}`
      );
    result[spec.key] = v;
  }
  return result;
}

export function parseParameterScenario(value: unknown): ParameterScenario {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', 'Parameter scenario must be an object');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'modelId,values')
    throw visualLabError('INVALID_SCENARIO', 'Parameter scenario has unsupported fields');
  const model = getParameterModel(raw.modelId);
  return { modelId: model.id, values: parseParameterValues(model, raw.values) };
}

/** Authoritative output. Rounding is display-only; this is the value used for grading. */
export function parameterOutput(scenario: ParameterScenario) {
  const model = getParameterModel(scenario.modelId);
  const values = parseParameterValues(model, scenario.values);
  return { model, values, output: model.compute(values) };
}
