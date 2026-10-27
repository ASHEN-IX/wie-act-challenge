/** Audited deterministic illustration; no model-generated code or assessment. */
export interface BinarySearchState {
  exampleId: 'binary-search-v1';
  values: number[];
  target: number;
  step: number;
}
export interface BinarySearchStep {
  low: number;
  high: number;
  comparedIndex: number | null;
  foundIndex: number | null;
  complete: boolean;
  explanation: string;
}
export const DEFAULT_BINARY_SEARCH: BinarySearchState = {
  exampleId: 'binary-search-v1',
  values: [2, 4, 6, 8, 10, 12, 14],
  target: 10,
  step: 0
};

export function binarySearchTrace(values: readonly number[], target: number): BinarySearchStep[] {
  if (
    !Array.isArray(values) ||
    values.length < 1 ||
    values.length > 12 ||
    Array.from(values).some(
      (value, index) =>
        !Number.isInteger(value) ||
        Math.abs(value) > 999 ||
        (index > 0 && value < values[index - 1])
    ) ||
    !Number.isInteger(target) ||
    Math.abs(target) > 999
  )
    throw new Error(
      'Use 1–12 sorted integers from -999 to 999 and an integer target in that range.'
    );
  let low = 0,
    high = values.length - 1;
  const trace: BinarySearchStep[] = [
    {
      low,
      high,
      comparedIndex: null,
      foundIndex: null,
      complete: false,
      explanation: `Search the sorted list for ${target}. Start with every index from 0 to ${high}.`
    }
  ];
  while (low <= high) {
    const mid = Math.floor((low + high) / 2),
      value = values[mid];
    if (value === target) {
      trace.push({
        low,
        high,
        comparedIndex: mid,
        foundIndex: mid,
        complete: true,
        explanation: `Compare index ${mid}: ${value} equals ${target}. A match is found at index ${mid}.`
      });
      break;
    }
    let explanation = `Compare index ${mid}: ${value}`;
    if (value < target) {
      low = mid + 1;
      explanation += ` is less than ${target}; discard this index and all lower indices.`;
    } else {
      high = mid - 1;
      explanation += ` is greater than ${target}; discard this index and all higher indices.`;
    }
    const complete = low > high;
    explanation += complete
      ? ` No indices remain; ${target} is absent.`
      : ` Continue with indices ${low} to ${high}.`;
    trace.push({ low, high, comparedIndex: mid, foundIndex: null, complete, explanation });
  }
  return trace;
}

export function parseBinarySearchState(value: unknown): BinarySearchState {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Unsupported visualization state');
  const state = value as Record<string, unknown>;
  if (
    Object.keys(state).sort().join(',') !== 'exampleId,step,target,values' ||
    state.exampleId !== 'binary-search-v1' ||
    !Array.isArray(state.values) ||
    typeof state.target !== 'number' ||
    typeof state.step !== 'number'
  )
    throw new Error('Unsupported visualization state');
  const values = [...state.values] as number[];
  const trace = binarySearchTrace(values, state.target);
  if (!Number.isInteger(state.step) || state.step < 0 || state.step >= trace.length)
    throw new Error('Visualization step is outside the deterministic trace');
  return { exampleId: 'binary-search-v1', values, target: state.target, step: state.step };
}
