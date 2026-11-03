/**
 * Registered 2D function plots.
 *
 * The planner may only name a `functionId` from this registry. Curves, vertex
 * and roots are computed here, from the same exported functions on the server
 * and in the browser, never from a formula supplied by a model.
 */
import { visualLabError, type FunctionScenario } from './types';

export interface FunctionParameterSpec {
  key: 'a' | 'b' | 'c';
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
}

export interface QuadraticValues {
  a: number;
  b: number;
  c: number;
}

export interface QuadraticOutput {
  vertex: { x: number; y: number };
  discriminant: number;
  /** Real roots in ascending order (empty when the parabola never crosses the x-axis). */
  roots: number[];
  yIntercept: number;
  opensUp: boolean;
}

export const QUADRATIC_FUNCTION = {
  id: 'quadratic_function' as const,
  label: 'Quadratic function explorer',
  concept: 'Quadratic functions: y = ax² + bx + c',
  objective:
    'Explain how the coefficients a, b and c move the parabola, its vertex and where it crosses the x-axis',
  parameters: [
    { key: 'a', label: 'a (curvature)', min: -5, max: 5, step: 0.5, description: 'Sign sets the opening direction; size sets how narrow it is' },
    { key: 'b', label: 'b (tilt)', min: -10, max: 10, step: 1, description: 'Shifts the vertex sideways together with a' },
    { key: 'c', label: 'c (height)', min: -10, max: 10, step: 1, description: 'Where the curve crosses the y-axis' }
  ] as readonly FunctionParameterSpec[],
  defaults: { a: 1, b: -2, c: -3 } as QuadraticValues,
  guidance: {
    predictionPrompt:
      'If you make a negative while keeping b and c, which way will the parabola open and what happens to the vertex height?',
    hint: 'Change one coefficient at a time. The vertex is at x = −b / 2a, and the curve crosses the x-axis only when b² − 4ac is not negative.',
    observationPrompt:
      'Describe how changing one coefficient moved the vertex or the roots, using your own numbers.'
  }
};

export function quadraticOutput(values: QuadraticValues): QuadraticOutput {
  const { a, b, c } = values;
  const vx = -b / (2 * a);
  const discriminant = b * b - 4 * a * c;
  let roots: number[] = [];
  if (discriminant === 0) roots = [vx];
  else if (discriminant > 0) {
    const root = Math.sqrt(discriminant);
    roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)].sort((x, y) => x - y);
  }
  return {
    vertex: { x: vx, y: a * vx * vx + b * vx + c },
    discriminant,
    roots,
    yIntercept: c,
    opensUp: a > 0
  };
}

/** Evenly spaced samples of y = ax² + bx + c over [xMin, xMax]. */
export function quadraticCurve(values: QuadraticValues, xMin: number, xMax: number, samples = 80) {
  return Array.from({ length: samples + 1 }, (_, index) => {
    const x = xMin + ((xMax - xMin) * index) / samples;
    return { x, y: values.a * x * x + values.b * x + values.c };
  });
}

export function getFunction(id: unknown) {
  if (id !== QUADRATIC_FUNCTION.id)
    throw visualLabError(
      'UNSUPPORTED_MODEL',
      `Only these functions are supported: ${QUADRATIC_FUNCTION.id}`
    );
  return QUADRATIC_FUNCTION;
}

export function parseFunctionValues(value: unknown): QuadraticValues {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', 'Function values must be an object');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'a,b,c')
    throw visualLabError('INVALID_SCENARIO', 'Function values must be exactly: a, b, c');
  const result = { a: 0, b: 0, c: 0 };
  for (const spec of QUADRATIC_FUNCTION.parameters) {
    const v = raw[spec.key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < spec.min || v > spec.max)
      throw visualLabError('INVALID_PARAMETER', `${spec.label} must be between ${spec.min} and ${spec.max}`);
    result[spec.key] = v;
  }
  // a = 0 is a line, not a parabola: the vertex formula would divide by zero.
  if (result.a === 0) throw visualLabError('INVALID_PARAMETER', 'a must not be 0 for a quadratic');
  return result;
}

export function parseFunctionScenario(value: unknown): FunctionScenario {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', 'Function scenario must be an object');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'functionId,values')
    throw visualLabError('INVALID_SCENARIO', 'Function scenario has unsupported fields');
  const fn = getFunction(raw.functionId);
  return { functionId: fn.id, values: parseFunctionValues(raw.values) };
}

/** Authoritative output used by guidance and by the derived understanding check. */
export function functionOutput(scenario: FunctionScenario) {
  const values = parseFunctionValues(scenario.values);
  return { fn: getFunction(scenario.functionId), values, output: quadraticOutput(values) };
}
