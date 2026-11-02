/**
 * Visual Learning Lab engine correctness. Pure functions, no provider and no DB.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { graphTrace, parseWeightedGraphScenario } from '../../shared/visualLab/graph';
import {
  NEWTONS_SECOND_LAW,
  parameterOutput,
  parseParameterScenario,
  parseParameterValues
} from '../../shared/visualLab/parameter-models';
import {
  PROJECTILE_3D,
  niceExtent,
  parseSpatialScenario,
  projectileOutput,
  projectileTrajectory
} from '../../shared/visualLab/spatial-models';
import {
  buildStoredLab,
  deriveCheck,
  fallbackCandidate,
  gradeCheck,
  parseLabCandidate,
  toPublicLab
} from '../../shared/visualLab/definition';

const graph = (weights: number[]) =>
  ({
    nodes: [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
      { id: 'C', label: 'C' },
      { id: 'D', label: 'D' }
    ],
    edges: [
      { source: 'A', target: 'B', weight: weights[0] },
      { source: 'B', target: 'D', weight: weights[1] },
      { source: 'A', target: 'C', weight: weights[2] },
      { source: 'C', target: 'D', weight: weights[3] }
    ],
    source: 'A',
    target: 'D'
  }) as const;

test('weighted graph: known cheapest route and total cost', () => {
  const trace = graphTrace(parseWeightedGraphScenario(graph([2, 7, 5, 3])));
  assert.deepEqual(trace.path, ['A', 'C', 'D']);
  assert.equal(trace.totalCost, 8);
  assert.deepEqual(trace.steps.at(-1)?.distances, { A: 0, B: 2, C: 5, D: 8 });
});

test('weighted graph: changing one weight changes the answer deterministically', () => {
  const cheaperDirect = graphTrace(parseWeightedGraphScenario(graph([2, 1, 5, 3])));
  assert.deepEqual(cheaperDirect.path, ['A', 'B', 'D']);
  assert.equal(cheaperDirect.totalCost, 3);
  // same input → identical replay
  assert.deepEqual(graphTrace(parseWeightedGraphScenario(graph([2, 1, 5, 3]))), cheaperDirect);
});

test('weighted graph: equal-cost alternatives resolve to the same replay', () => {
  const trace = graphTrace(parseWeightedGraphScenario(graph([1, 4, 4, 1])));
  assert.equal(trace.totalCost, 5);
  // Two equal-cost routes (A→B→D and A→C→D); the documented tie-break is stable.
  assert.deepEqual(trace.path, ['A', 'B', 'D']);
  assert.equal(trace.totalCost, 5);
  assert.deepEqual(trace, graphTrace(parseWeightedGraphScenario(graph([1, 4, 4, 1]))));
});

test('weighted graph: unreachable destination is explained, not fabricated', () => {
  const trace = graphTrace(
    parseWeightedGraphScenario({
      nodes: [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' }
      ],
      edges: [{ source: 'A', target: 'B', weight: 3 }],
      source: 'A',
      target: 'C'
    })
  );
  assert.equal(trace.totalCost, null);
  assert.deepEqual(trace.path, []);
  const last = trace.steps.at(-1)!;
  assert.match(last.explanation, /Unreachable from A: C/);
  assert.equal(last.distances.C, null);
});

test('weighted graph: disconnected start still produces one deterministic trace', () => {
  const trace = graphTrace(
    parseWeightedGraphScenario({
      nodes: [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' }
      ],
      edges: [{ source: 'B', target: 'C', weight: 2 }],
      source: 'A',
      target: 'C'
    })
  );
  assert.equal(trace.totalCost, null);
  assert.match(
    trace.steps.at(-1)!.explanation,
    /Unreachable from A: B, C|Unreachable from A: C, B/
  );
});

test('weighted graph: rejects malformed, oversized and out-of-range scenarios', () => {
  const cases: unknown[] = [
    { ...graph([1, 1, 1, 1]), extra: true },
    { ...graph([0, 1, 1, 1]) },
    { ...graph([100, 1, 1, 1]) },
    { ...graph([1.5, 1, 1, 1]) },
    { ...graph([1, 1, 1, 1]), source: 'D', target: 'D' },
    { ...graph([1, 1, 1, 1]), target: 'Z' },
    {
      ...graph([1, 1, 1, 1]),
      edges: [...graph([1, 1, 1, 1]).edges, { source: 'A', target: 'B', weight: 2 }]
    },
    {
      ...graph([1, 1, 1, 1]),
      edges: [...graph([1, 1, 1, 1]).edges, { source: 'A', target: 'A', weight: 2 }]
    },
    {
      nodes: Array.from({ length: 11 }, (_, i) => ({ id: `n${i}`, label: `n${i}` })),
      edges: [{ source: 'n0', target: 'n1', weight: 1 }],
      source: 'n0',
      target: 'n1'
    },
    { nodes: [{ id: 'A', label: 'A' }], edges: [], source: 'A', target: 'A' }
  ];
  for (const value of cases) assert.throws(() => parseWeightedGraphScenario(value));
});

test("newton's second law: verified calculations and boundaries", () => {
  const scenario = parseParameterScenario({
    modelId: 'newtons_second_law',
    values: { force: 40, mass: 8 }
  });
  assert.equal(parameterOutput(scenario).output.acceleration, 5);
  assert.equal(
    parameterOutput({ modelId: 'newtons_second_law', values: { force: 0, mass: 0.5 } }).output
      .acceleration,
    0
  );
  assert.equal(
    parameterOutput({ modelId: 'newtons_second_law', values: { force: 200, mass: 50 } }).output
      .acceleration,
    4
  );
  const model = NEWTONS_SECOND_LAW;
  for (const values of [
    { force: -1, mass: 10 },
    { force: 10, mass: 0 },
    { force: 201, mass: 10 },
    { force: 10, mass: 51 },
    { force: Number.NaN, mass: 10 },
    { force: 10, mass: Number.POSITIVE_INFINITY }
  ])
    assert.throws(() => parseParameterValues(model, values), Error, JSON.stringify(values));
});

test('planner proposals cannot smuggle extra fields, code or unknown engines', () => {
  const good = fallbackCandidate('weighted_graph');
  assert.doesNotThrow(() => parseLabCandidate(good));
  const reject = (value: unknown) => assert.throws(() => parseLabCandidate(value));
  reject({ ...good, script: 'alert(1)' });
  reject({ ...good, engine: 'react_component' });
  reject({ ...good, engine: 'parameter_model' }); // graph scenario with the wrong engine
  reject({ ...good, guidance: { ...good.guidance, answerKey: 'A' } });
  reject({ ...good, scenario: { ...(good.scenario as object), formula: 'a=F/m' } });
});

test('understanding check is derived server-side and withheld from the browser', () => {
  const candidate = parseLabCandidate(fallbackCandidate('weighted_graph'));
  const lab = buildStoredLab({
    labId: 'lab_aaaaaaaaaaaaaaaaaaaa',
    candidate,
    sourceContext: { mode: 'topic' },
    generationMode: 'DETERMINISTIC_FALLBACK',
    createdAt: new Date().toISOString()
  });
  assert.equal(lab.check.correctOptionId, 'correct');
  assert.ok(lab.check.options.some((option) => option.id === 'correct'));
  const projected = JSON.stringify(toPublicLab(lab));
  assert.equal(projected.includes('correctOptionId'), false);
  assert.equal(projected.includes('explanation'), false);
  const graded = gradeCheck(lab, { selectedOptionId: lab.check.correctOptionId });
  assert.equal(graded.correct, true);
  assert.ok(graded.explanation.length > 20);
  const wrong = lab.check.options.find((o) => o.id !== lab.check.correctOptionId)!;
  assert.equal(gradeCheck(lab, { selectedOptionId: wrong.id }).correct, false);
  assert.throws(() => gradeCheck(lab, { selectedOptionId: 'not-an-option' }));
  assert.throws(() => gradeCheck(lab, { selectedOptionId: 'correct', score: 1 }));
});

test('parameter check options are distinct and include the true value', () => {
  const candidate = parseLabCandidate(fallbackCandidate('parameter_model'));
  const lab = buildStoredLab({
    labId: 'lab_bbbbbbbbbbbbbbbbbbbb',
    candidate,
    sourceContext: { mode: 'topic' },
    generationMode: 'DETERMINISTIC_FALLBACK',
    createdAt: new Date().toISOString()
  });
  const labels = lab.check.options.map((o) => o.label);
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(labels.includes('5 m/s²'));
  assert.equal(deriveCheck(lab.definition).correctOptionId, lab.check.correctOptionId);
});

const sceneValues = { speed: 20, elevation: 45, heading: 0, gravity: 10 };

test('projectile motion: known values, symmetry and heading', () => {
  const out = projectileOutput(sceneValues);
  assert.ok(Math.abs(out.range - 40) < 1e-9);
  assert.ok(Math.abs(out.maxHeight - 10) < 1e-9);
  assert.ok(Math.abs(out.timeOfFlight - (2 * 20 * Math.SQRT1_2) / 10) < 1e-9);
  // Complementary elevations land at the same distance; the steeper one flies higher.
  const low = projectileOutput({ ...sceneValues, elevation: 30 });
  const high = projectileOutput({ ...sceneValues, elevation: 60 });
  assert.ok(Math.abs(low.range - high.range) < 1e-9);
  assert.ok(high.maxHeight > low.maxHeight);
  // Heading only rotates the landing point on the ground plane.
  const north = projectileOutput({ ...sceneValues, heading: 90 });
  assert.ok(Math.abs(north.landing.x) < 1e-9 && Math.abs(north.landing.z - 40) < 1e-9);
  // Weaker gravity means a longer flight.
  assert.ok(projectileOutput({ ...sceneValues, gravity: 1.6 }).range > out.range * 5);
});

test('projectile trajectory starts and ends on the ground and peaks at the computed height', () => {
  const path = projectileTrajectory({ ...sceneValues, heading: 40 }, 64);
  const out = projectileOutput({ ...sceneValues, heading: 40 });
  assert.equal(path[0].y, 0);
  assert.ok(Math.abs(path[path.length - 1].y) < 1e-9);
  assert.ok(Math.abs(path[path.length - 1].x - out.landing.x) < 1e-9);
  assert.ok(Math.abs(Math.max(...path.map((p) => p.y)) - out.maxHeight) < 1e-9);
  assert.ok(path.every((p) => p.y >= 0));
});

test('spatial scenario rejects unbounded values, unknown scenes and smuggled fields', () => {
  const good = { sceneId: 'projectile_3d', values: { ...PROJECTILE_3D.defaults } };
  assert.deepEqual(parseSpatialScenario(good).values, PROJECTILE_3D.defaults);
  for (const bad of [
    { ...good, values: { ...good.values, gravity: 0 } },
    { ...good, values: { ...good.values, elevation: 90 } },
    { ...good, values: { ...good.values, speed: Number.NaN } },
    { ...good, values: { ...good.values, extra: 1 } },
    { ...good, sceneId: 'n_body' },
    { ...good, script: 'alert(1)' }
  ])
    assert.throws(() => parseSpatialScenario(bad));
});

test('spatial lab: derived check is correct, hides the key and lists distinct options', () => {
  const candidate = fallbackCandidate('spatial_3d', 'projectile motion');
  const stored = buildStoredLab({
    labId: 'lab_x',
    candidate: parseLabCandidate(candidate),
    sourceContext: { mode: 'topic', topic: 'projectile motion' },
    generationMode: 'DETERMINISTIC_FALLBACK',
    createdAt: new Date().toISOString()
  });
  const out = projectileOutput(PROJECTILE_3D.defaults);
  const correct = stored.check.options.find((o) => o.id === stored.check.correctOptionId)!;
  assert.equal(correct.label, `${Math.round(out.range * 100) / 100} m`);
  assert.equal(new Set(stored.check.options.map((o) => o.label)).size, stored.check.options.length);
  const publicLab = toPublicLab(stored);
  assert.ok(!JSON.stringify(publicLab).includes('correctOptionId'));
  assert.equal(
    gradeCheck(stored, { selectedOptionId: stored.check.correctOptionId }).correct,
    true
  );
  assert.equal(gradeCheck(stored, { selectedOptionId: 'alt1' }).correct, false);
});

test('niceExtent rounds up to 1, 2 or 5 times a power of ten', () => {
  assert.deepEqual([0.3, 1, 1.5, 3, 7, 40, 66].map(niceExtent), [1, 1, 2, 5, 10, 50, 100]);
});

describe('function_plot engine', () => {
  // Imported lazily so the existing import block above stays untouched.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fm = require('../../shared/visualLab/function-models');

  it('computes vertex, roots and discriminant for y = x² − 2x − 3', () => {
    const out = fm.quadraticOutput({ a: 1, b: -2, c: -3 });
    expect(out.vertex).toEqual({ x: 1, y: -4 });
    expect(out.roots).toEqual([-1, 3]);
    expect(out.discriminant).toBe(16);
  });

  it('reports no real roots when the discriminant is negative and one root at a touch', () => {
    expect(fm.quadraticOutput({ a: 1, b: 0, c: 4 }).roots).toEqual([]);
    expect(fm.quadraticOutput({ a: 1, b: -4, c: 4 }).roots).toEqual([2]);
  });

  it('rejects a = 0, out-of-range values, extra fields and unregistered functions', () => {
    expect(() => fm.parseFunctionScenario({ functionId: 'quadratic_function', values: { a: 0, b: 1, c: 1 } })).toThrow();
    expect(() => fm.parseFunctionScenario({ functionId: 'quadratic_function', values: { a: 1, b: 99, c: 1 } })).toThrow();
    expect(() => fm.parseFunctionScenario({ functionId: 'quadratic_function', values: { a: 1, b: 1, c: 1 }, script: 'x' })).toThrow();
    expect(() => fm.parseFunctionScenario({ functionId: 'cubic', values: { a: 1, b: 1, c: 1 } })).toThrow();
  });

  it('derives a check whose answer is the vertex x and withholds nothing wrong', () => {
    const { deriveCheck } = require('../../shared/visualLab/definition');
    const check = deriveCheck({ engine: 'function_plot', scenario: { functionId: 'quadratic_function', values: { a: 2, b: -8, c: 1 } } });
    expect(check.correctOptionId).toBe('correct');
    expect(check.options.find((o: { id: string }) => o.id === 'correct').label).toBe('x = 2');
    expect(new Set(check.options.map((o: { label: string }) => o.label)).size).toBe(check.options.length);
  });
});
