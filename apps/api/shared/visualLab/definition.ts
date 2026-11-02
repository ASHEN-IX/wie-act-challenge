/**
 * Validation and projection for Visual Learning Lab definitions.
 *
 * Division of responsibility:
 * - the AI planner proposes concept, engine, scenario and guidance;
 * - this module validates every value against the registered engines;
 * - the understanding check is *derived deterministically* from the validated
 *   scenario, so no model-authored answer key is ever trusted or stored.
 */
import {
  ENGINE_CAPABILITIES,
  VISUAL_LAB_LIMITS,
  VISUAL_LAB_SCHEMA_VERSION,
  visualLabError,
  type LabDefinition,
  type LabGuidance,
  type LabSourceContext,
  type PublicVisualLab,
  type VisualLabCheck,
  type VisualLabEngine
} from './types';
import { graphTrace, parseWeightedGraphScenario } from './graph';
import { QUADRATIC_FUNCTION, functionOutput, parseFunctionScenario } from './function-models';
import { PROJECTILE_3D, parseSpatialScenario, spatialOutput } from './spatial-models';
import {
  NEWTONS_SECOND_LAW,
  getParameterModel,
  parameterOutput,
  parseParameterScenario
} from './parameter-models';

export interface LabCandidate {
  engine: VisualLabEngine;
  title: string;
  concept: string;
  learningObjective: string;
  scenario: unknown;
  guidance: Pick<LabGuidance, 'instructions' | 'predictionPrompt' | 'hint'>;
}

export interface StoredLab extends Omit<PublicVisualLab, 'check'> {
  check: VisualLabCheck;
}

// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function plainText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw visualLabError('INVALID_SCENARIO', `${field} must be text`);
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) throw visualLabError('INVALID_SCENARIO', `${field} cannot be empty`);
  if (CONTROL.test(trimmed))
    throw visualLabError('INVALID_SCENARIO', `${field} contains unsupported characters`);
  if (Array.from(trimmed).length > max)
    throw visualLabError('INVALID_SCENARIO', `${field} exceeds ${max} characters`);
  return trimmed;
}

function exactKeys(value: unknown, keys: string[], field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', `${field} must be an object`);
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort().join(',');
  if (actual !== [...keys].sort().join(','))
    throw visualLabError('INVALID_SCENARIO', `${field} has unsupported fields`);
  return record;
}

export function isSupportedEngine(value: unknown): value is VisualLabEngine {
  return ENGINE_CAPABILITIES.some((entry) => entry.engine === value);
}

/** Strictly validate a planner proposal. Unknown engines/fields are rejected. */
export function parseLabCandidate(value: unknown): LabCandidate {
  const raw = exactKeys(
    value,
    ['engine', 'title', 'concept', 'learningObjective', 'scenario', 'guidance'],
    'Lab proposal'
  );
  if (!isSupportedEngine(raw.engine))
    throw visualLabError(
      'UNSUPPORTED_ENGINE',
      `Supported engines are ${ENGINE_CAPABILITIES.map((e) => e.engine).join(', ')}`
    );
  const guidance = exactKeys(
    raw.guidance,
    ['instructions', 'predictionPrompt', 'hint'],
    'Lab guidance'
  );
  const candidate: LabCandidate = {
    engine: raw.engine,
    title: plainText(raw.title, 'Title', VISUAL_LAB_LIMITS.title),
    concept: plainText(raw.concept, 'Concept', VISUAL_LAB_LIMITS.concept),
    learningObjective: plainText(
      raw.learningObjective,
      'Learning objective',
      VISUAL_LAB_LIMITS.objective
    ),
    scenario: raw.scenario,
    guidance: {
      instructions: plainText(guidance.instructions, 'Instructions', VISUAL_LAB_LIMITS.guidance),
      predictionPrompt: plainText(
        guidance.predictionPrompt,
        'Prediction prompt',
        VISUAL_LAB_LIMITS.guidance
      ),
      hint: plainText(guidance.hint, 'Hint', VISUAL_LAB_LIMITS.guidance)
    }
  };
  // Validate the engine-specific scenario now so no invalid lab is ever stored.
  if (candidate.engine === 'weighted_graph') parseWeightedGraphScenario(candidate.scenario);
  else if (candidate.engine === 'spatial_3d') parseSpatialScenario(candidate.scenario);
  else if (candidate.engine === 'function_plot') parseFunctionScenario(candidate.scenario);
  else parseParameterScenario(candidate.scenario);
  return candidate;
}

export function scenarioDefinition(candidate: LabCandidate): LabDefinition {
  if (candidate.engine === 'weighted_graph')
    return { engine: 'weighted_graph', scenario: parseWeightedGraphScenario(candidate.scenario) };
  if (candidate.engine === 'spatial_3d')
    return { engine: 'spatial_3d', scenario: parseSpatialScenario(candidate.scenario) };
  if (candidate.engine === 'function_plot')
    return { engine: 'function_plot', scenario: parseFunctionScenario(candidate.scenario) };
  return { engine: 'parameter_model', scenario: parseParameterScenario(candidate.scenario) };
}

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const fmt = (value: number) => String(round(value));

/** Server-derived understanding check. Never accepts a model-provided answer key. */
export function deriveCheck(definition: LabDefinition): VisualLabCheck {
  if (definition.engine === 'weighted_graph') {
    const scenario = parseWeightedGraphScenario(definition.scenario);
    const trace = graphTrace(scenario);
    const name = (id: string) => scenario.nodes.find((n) => n.id === id)?.label ?? id;
    const pathLabel = (path: string[]) => path.map(name).join(' → ');
    const reachable = trace.totalCost !== null && trace.path.length > 0;
    const correctId = 'correct';
    const options: Array<{ id: string; label: string }> = [];
    let explanation: string;
    if (reachable) {
      options.push({ id: correctId, label: `${pathLabel(trace.path)} (cost ${trace.totalCost})` });
      const alternatives = simplePaths(scenario, scenario.source, scenario.target)
        .filter((p) => p.cost > (trace.totalCost as number))
        .sort((a, b) => a.cost - b.cost || a.path.join().localeCompare(b.path.join()))
        .slice(0, 3)
        .map((p, index) => ({ id: `alt${index}`, label: `${pathLabel(p.path)} (cost ${p.cost})` }));
      options.push(...alternatives);
      explanation = `The lowest total cost is ${trace.totalCost} along ${pathLabel(trace.path)}. Adding edge weights along each alternative shows why it costs more.`;
    } else {
      options.push({ id: correctId, label: 'No route exists between the two nodes' });
      options.push({ id: 'alt0', label: 'The direct edge has the lowest cost' });
      options.push({ id: 'alt1', label: 'The route through the middle node has the lowest cost' });
      explanation = `No chain of edges connects ${name(scenario.source)} to ${name(scenario.target)}, so no finite cost exists. Try changing the start or destination.`;
    }
    shuffle(options, `${scenario.source}>${scenario.target}>${scenario.edges.length}`);
    return {
      prompt: `Which statement is true for the lowest-cost route from ${name(scenario.source)} to ${name(scenario.target)}?`,
      options,
      correctOptionId: correctId,
      explanation
    };
  }

  if (definition.engine === 'spatial_3d') {
    const { values, output } = spatialOutput(definition.scenario);
    const sin2 = Math.sin(2 * values.elevation * (Math.PI / 180));
    const candidates = [
      { id: 'correct', value: output.range },
      // Dropped the doubled angle: v² sin θ / g
      {
        id: 'alt0',
        value: (values.speed ** 2 * Math.sin(values.elevation * (Math.PI / 180))) / values.gravity
      },
      // Confused range with peak height
      { id: 'alt1', value: output.maxHeight },
      // Halved the range (spurious extra factor of 2)
      { id: 'alt2', value: (values.speed ** 2 * sin2) / (2 * values.gravity) }
    ];
    const seen = new Set<number>();
    const options = candidates
      .filter((c) => {
        const key = round(c.value, 2);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((c) => ({ id: c.id, label: `${fmt(c.value)} m` }));
    shuffle(options, `${values.speed}>${values.elevation}>${values.gravity}>spatial`);
    return {
      prompt: `A projectile is launched at ${fmt(values.speed)} m/s, ${fmt(values.elevation)}° above level ground, where gravity is ${fmt(values.gravity)} m/s². How far does it land from the launch point (ignoring air resistance)?`,
      options,
      correctOptionId: 'correct',
      explanation: `Range = v² sin(2θ) / g = ${fmt(values.speed)}² × sin(${fmt(values.elevation * 2)}°) / ${fmt(values.gravity)} = ${fmt(output.range)} m. Peak height is a different quantity: v² sin²θ / 2g = ${fmt(output.maxHeight)} m.`
    };
  }

  if (definition.engine === 'function_plot') {
    const { values, output } = functionOutput(definition.scenario);
    const { a, b } = values;
    const candidates = [
      { id: 'correct', value: output.vertex.x },
      // Sign slip: b / 2a
      { id: 'alt0', value: b / (2 * a) },
      // Forgot the factor of 2: -b / a
      { id: 'alt1', value: -b / a },
      // Inverted: -2a / b (or -2a when b = 0)
      { id: 'alt2', value: b === 0 ? -2 * a : (-2 * a) / b }
    ];
    const seen = new Set<number>();
    const options = candidates
      .filter((c) => {
        const key = round(c.value, 2);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((c) => ({ id: c.id, label: `x = ${fmt(c.value)}` }));
    shuffle(options, `${a}>${b}>${values.c}>function`);
    return {
      prompt: `For y = ${fmt(a)}x² ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b))}x ${values.c < 0 ? '−' : '+'} ${fmt(Math.abs(values.c))}, at which x is the vertex (the turning point)?`,
      options,
      correctOptionId: 'correct',
      explanation: `The vertex is at x = −b / 2a = −(${fmt(b)}) / (2 × ${fmt(a)}) = ${fmt(output.vertex.x)}, where y = ${fmt(output.vertex.y)}.`
    };
  }

  const { model, values, output } = parameterOutput(definition.scenario);
  const force = values.force;
  const mass = values.mass;
  const correct = output.acceleration;
  const candidates = [
    { id: 'correct', value: correct },
    { id: 'alt0', value: force * mass },
    { id: 'alt1', value: mass === 0 ? correct + 1 : force / (mass * 2) },
    { id: 'alt2', value: force + mass }
  ] as const;
  const seen = new Set<number>();
  const options = candidates
    .filter((c) => {
      const key = round(c.value, 4);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => ({ id: c.id, label: `${fmt(c.value)} ${model.output.unit}` }));
  shuffle(options, `${force}>${mass}>${model.id}`);
  return {
    prompt: `${model.parameters[0].label} is ${fmt(force)} ${model.parameters[0].unit} and ${model.parameters[1].label.toLowerCase()} is ${fmt(mass)} ${model.parameters[1].unit}. What is the acceleration?`,
    options,
    correctOptionId: 'correct',
    explanation: `Using ${model.output.formula}: a = ${fmt(force)} / ${fmt(mass)} = ${fmt(correct)} ${model.output.unit}.`
  };
}

/** Deterministic ordering so the same scenario always shows the same option order. */
function shuffle<T>(items: T[], seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  for (let i = items.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) % 2147483648;
    const j = hash % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

interface SimplePath {
  path: string[];
  cost: number;
}

/** Enumerate simple paths for distractor generation (bounded graph, so this is safe). */
function simplePaths(
  scenario: ReturnType<typeof parseWeightedGraphScenario>,
  source: string,
  target: string
): SimplePath[] {
  const neighbours = new Map<string, Array<{ to: string; weight: number }>>();
  for (const edge of scenario.edges) {
    if (!neighbours.has(edge.source)) neighbours.set(edge.source, []);
    if (!neighbours.has(edge.target)) neighbours.set(edge.target, []);
    neighbours.get(edge.source)!.push({ to: edge.target, weight: edge.weight });
    neighbours.get(edge.target)!.push({ to: edge.source, weight: edge.weight });
  }
  const results: SimplePath[] = [];
  const walk = (node: string, path: string[], cost: number) => {
    if (results.length >= 40) return;
    if (node === target && path.length > 1) {
      results.push({ path: [...path], cost });
      return;
    }
    for (const next of neighbours.get(node) || []) {
      if (path.includes(next.to)) continue;
      walk(next.to, [...path, next.to], cost + next.weight);
    }
  };
  walk(source, [source], 0);
  return results;
}

export function buildStoredLab(input: {
  labId: string;
  candidate: LabCandidate;
  sourceContext: LabSourceContext;
  generationMode: StoredLab['generationMode'];
  createdAt: string;
}): StoredLab {
  const definition = scenarioDefinition(input.candidate);
  return {
    labId: input.labId,
    schemaVersion: VISUAL_LAB_SCHEMA_VERSION,
    engine: definition.engine,
    title: input.candidate.title,
    concept: input.candidate.concept,
    learningObjective: input.candidate.learningObjective,
    sourceContext: input.sourceContext,
    definition,
    guidance: {
      instructions: input.candidate.guidance.instructions,
      predictionPrompt: input.candidate.guidance.predictionPrompt,
      hint: input.candidate.guidance.hint,
      observationPrompt:
        definition.engine === 'weighted_graph'
          ? 'Explain which edge weight changed the answer, then predict the route again before you run it.'
          : definition.engine === 'spatial_3d'
            ? PROJECTILE_3D.guidance.observationPrompt
            : definition.engine === 'function_plot'
              ? QUADRATIC_FUNCTION.guidance.observationPrompt
              : NEWTONS_SECOND_LAW.guidance.observationPrompt
    },
    check: deriveCheck(definition),
    generationMode: input.generationMode,
    createdAt: input.createdAt
  };
}

/** Browser projection. The correct option and explanation are withheld. */
export function toPublicLab(lab: StoredLab): PublicVisualLab {
  return {
    labId: lab.labId,
    schemaVersion: lab.schemaVersion,
    engine: lab.engine,
    title: lab.title,
    concept: lab.concept,
    learningObjective: lab.learningObjective,
    sourceContext: lab.sourceContext,
    definition: lab.definition,
    guidance: lab.guidance,
    check: { prompt: lab.check.prompt, options: lab.check.options.map((o) => ({ ...o })) },
    generationMode: lab.generationMode,
    createdAt: lab.createdAt
  };
}

export function gradeCheck(
  lab: StoredLab,
  input: unknown
): { correct: boolean; correctOptionId: string; explanation: string } {
  const raw = exactKeys(input, ['selectedOptionId'], 'Answer');
  const selected = raw.selectedOptionId;
  if (typeof selected !== 'string' || !lab.check.options.some((o) => o.id === selected))
    throw visualLabError('INVALID_ANSWER', 'Choose one of the offered options');
  return {
    correct: selected === lab.check.correctOptionId,
    correctOptionId: lab.check.correctOptionId,
    explanation: lab.check.explanation
  };
}

/**
 * Deterministic guide used when no model is approved. It only restates values
 * the trusted engines already computed (`state` is authoritativeState output).
 */
export function deterministicGuidance(
  engine: VisualLabEngine,
  question: string,
  state?: Record<string, unknown>
): string {
  if (engine === 'weighted_graph') {
    const path = Array.isArray(state?.path) ? (state.path as string[]) : [];
    const cost = typeof state?.totalCost === 'number' ? state.totalCost : null;
    const current =
      path.length && cost !== null
        ? `With the current weights, the cheapest route ${path.join(' → ')} costs ${cost}. `
        : '';
    return `${current}Add the weights along each complete route: the smallest total wins, not the route with the fewest edges. Change one weight on that route and re-run it to see whether the cheapest route switches.`;
  }
  if (engine === 'spatial_3d') {
    const s3 = state as
      | { values?: { speed: number; elevation: number }; range?: number; maxHeight?: number }
      | undefined;
    const now =
      s3?.values && typeof s3.range === 'number' && typeof s3.maxHeight === 'number'
        ? `Right now ${s3.values.speed} m/s at ${s3.values.elevation}° gives a range of ${Math.round(s3.range * 10) / 10} m and a peak of ${Math.round(s3.maxHeight * 10) / 10} m. `
        : '';
    return `${now}Range depends on sin(2θ), so two elevations that add up to 90° land at the same distance, but the steeper one flies higher and longer. Change only the elevation, keep speed and gravity fixed, and compare.`;
  }
  if (engine === 'function_plot') {
    const fp = state as
      | { values?: { a: number; b: number; c: number }; vertex?: { x: number; y: number }; roots?: number[] }
      | undefined;
    const now =
      fp?.values && fp.vertex
        ? `Right now y = ${fp.values.a}x² + ${fp.values.b}x + ${fp.values.c} has its vertex at (${Math.round(fp.vertex.x * 100) / 100}, ${Math.round(fp.vertex.y * 100) / 100}) and ${fp.roots?.length ?? 0} real root(s). `
        : '';
    return `${now}Change one coefficient at a time: a flips and narrows the curve, c lifts it, and b slides the vertex. The vertex is at x = −b / 2a, and the curve crosses the x-axis only when b² − 4ac is not negative.`;
  }
  const values = state?.values as { force?: number; mass?: number } | undefined;
  const acceleration = typeof state?.acceleration === 'number' ? state.acceleration : null;
  const current =
    values && acceleration !== null
      ? `Right now F = ${values.force} N and m = ${values.mass} kg give a = ${Math.round(acceleration * 100) / 100} m/s². `
      : '';
  return `${current}Write the relationship as a = F / m before substituting numbers (${question ? 'your question is recorded' : 'no question given'}). If the force doubles at constant mass, the acceleration doubles; if the mass doubles at constant force, the acceleration halves.`;
}

export function fallbackCandidate(engine: VisualLabEngine, conceptHint?: string): LabCandidate {
  if (engine === 'weighted_graph') {
    return {
      engine,
      title: 'Understanding weighted shortest paths',
      concept: conceptHint?.trim() || 'Weighted shortest paths',
      learningObjective:
        'Explain how edge weights change the cheapest route between two nodes, and verify it by stepping through Dijkstra’s algorithm',
      scenario: {
        nodes: [
          { id: 'A', label: 'A · Library' },
          { id: 'B', label: 'B · Campus gate' },
          { id: 'C', label: 'C · Station' },
          { id: 'D', label: 'D · Lab' }
        ],
        edges: [
          { source: 'A', target: 'B', weight: 4 },
          { source: 'A', target: 'C', weight: 2 },
          { source: 'C', target: 'B', weight: 1 },
          { source: 'B', target: 'D', weight: 3 },
          { source: 'C', target: 'D', weight: 7 }
        ],
        source: 'A',
        target: 'D'
      },
      guidance: {
        instructions:
          'Change an edge weight, then step through the algorithm. Watch the cost labels before and after each edge is relaxed.',
        predictionPrompt:
          'Before you run it: which route from A to D looks cheapest, A → B → D or A → C → B → D?',
        hint: 'Add the weights along each complete route. The route with the smallest total wins, not the one with fewer edges.'
      }
    };
  }
  if (engine === 'spatial_3d')
    return {
      engine,
      title: PROJECTILE_3D.label,
      concept: conceptHint?.trim() || PROJECTILE_3D.concept,
      learningObjective: PROJECTILE_3D.objective,
      scenario: { sceneId: PROJECTILE_3D.id, values: { ...PROJECTILE_3D.defaults } },
      guidance: {
        instructions:
          'Orbit the scene, then change the elevation, speed, heading and gravity. Watch the range and peak height update.',
        predictionPrompt: PROJECTILE_3D.guidance.predictionPrompt,
        hint: PROJECTILE_3D.guidance.hint
      }
    };
  if (engine === 'function_plot')
    return {
      engine,
      title: QUADRATIC_FUNCTION.label,
      concept: conceptHint?.trim() || QUADRATIC_FUNCTION.concept,
      learningObjective: QUADRATIC_FUNCTION.objective,
      scenario: { functionId: QUADRATIC_FUNCTION.id, values: { ...QUADRATIC_FUNCTION.defaults } },
      guidance: {
        instructions:
          'Drag a, b and c and watch the curve, its vertex and the points where it crosses the x-axis.',
        predictionPrompt: QUADRATIC_FUNCTION.guidance.predictionPrompt,
        hint: QUADRATIC_FUNCTION.guidance.hint
      }
    };
  const model = getParameterModel('newtons_second_law');
  return {
    engine,
    title: model.label,
    concept: conceptHint?.trim() || model.concept,
    learningObjective: model.objective,
    scenario: { modelId: model.id, values: { ...model.defaults } },
    guidance: {
      instructions:
        'Set a force and a mass, then watch the acceleration. Change one value at a time so you can attribute the change.',
      predictionPrompt: model.guidance.predictionPrompt,
      hint: model.guidance.hint
    }
  };
}
