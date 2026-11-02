/**
 * Deterministic weighted-graph engine (undirected, positive integer weights).
 *
 * Dijkstra is implemented here once and shared by the API (authoritative
 * verification) and the browser (immediate rendering). Ties resolve to the
 * lexicographically smallest node so every replay is identical.
 */
import {
  VISUAL_LAB_LIMITS,
  visualLabError,
  type GraphEdge,
  type GraphNode,
  type WeightedGraphScenario
} from './types';

const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/;

export interface GraphStep {
  step: number;
  finalized: string[];
  current: string | null;
  distances: Record<string, number | null>;
  relaxations: Array<{
    from: string;
    to: string;
    weight: number;
    previous: number | null;
    distance: number;
    improved: boolean;
    tie: boolean;
  }>;
  complete: boolean;
  explanation: string;
}

export interface GraphTrace {
  steps: GraphStep[];
  path: string[];
  totalCost: number | null;
}

export function isGraphScenario(value: unknown): value is WeightedGraphScenario {
  try {
    parseWeightedGraphScenario(value);
    return true;
  } catch {
    return false;
  }
}

export function parseWeightedGraphScenario(value: unknown): WeightedGraphScenario {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', 'Graph scenario must be an object');
  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw).sort().join(',');
  if (keys !== 'edges,nodes,source,target')
    throw visualLabError('INVALID_SCENARIO', 'Graph scenario has unsupported fields');
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges))
    throw visualLabError('INVALID_SCENARIO', 'Graph nodes and edges must be lists');
  if (
    raw.nodes.length < VISUAL_LAB_LIMITS.nodes.min ||
    raw.nodes.length > VISUAL_LAB_LIMITS.nodes.max
  )
    throw visualLabError(
      'INVALID_SCENARIO',
      `Use ${VISUAL_LAB_LIMITS.nodes.min}–${VISUAL_LAB_LIMITS.nodes.max} nodes`
    );
  if (raw.edges.length > VISUAL_LAB_LIMITS.edges.max)
    throw visualLabError('INVALID_SCENARIO', 'Graph has too many edges');

  const nodes: GraphNode[] = raw.nodes.map((node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node))
      throw visualLabError('INVALID_SCENARIO', 'Invalid node');
    const entry = node as Record<string, unknown>;
    if (Object.keys(entry).sort().join(',') !== 'id,label')
      throw visualLabError('INVALID_SCENARIO', 'Invalid node fields');
    if (typeof entry.id !== 'string' || !NODE_ID.test(entry.id))
      throw visualLabError('INVALID_SCENARIO', 'Node identifiers must be short and stable');
    if (
      typeof entry.label !== 'string' ||
      !entry.label.trim() ||
      Array.from(entry.label).length > 40
    )
      throw visualLabError('INVALID_SCENARIO', 'Node labels must be 1–40 characters');
    return { id: entry.id, label: entry.label.trim() };
  });
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length)
    throw visualLabError('INVALID_SCENARIO', 'Node identifiers must be unique');

  const known = new Set(nodes.map((n) => n.id));
  const pairs = new Set<string>();
  const edges: GraphEdge[] = raw.edges.map((edge) => {
    if (!edge || typeof edge !== 'object' || Array.isArray(edge))
      throw visualLabError('INVALID_SCENARIO', 'Invalid edge');
    const entry = edge as Record<string, unknown>;
    if (Object.keys(entry).sort().join(',') !== 'source,target,weight')
      throw visualLabError('INVALID_SCENARIO', 'Invalid edge fields');
    const { source, target, weight } = entry;
    if (typeof source !== 'string' || typeof target !== 'string')
      throw visualLabError('INVALID_SCENARIO', 'Edge endpoints must be node identifiers');
    if (!known.has(source) || !known.has(target))
      throw visualLabError('INVALID_SCENARIO', 'Edge references an unknown node');
    if (source === target) throw visualLabError('INVALID_SCENARIO', 'Self-loops are not supported');
    if (
      typeof weight !== 'number' ||
      !Number.isInteger(weight) ||
      weight < VISUAL_LAB_LIMITS.weight.min ||
      weight > VISUAL_LAB_LIMITS.weight.max
    )
      throw visualLabError(
        'INVALID_SCENARIO',
        `Edge weights must be whole numbers from ${VISUAL_LAB_LIMITS.weight.min} to ${VISUAL_LAB_LIMITS.weight.max}`
      );
    const pair = [source, target].sort().join('|');
    if (pairs.has(pair))
      throw visualLabError('INVALID_SCENARIO', 'Only one edge is allowed between two nodes');
    pairs.add(pair);
    return { source, target, weight };
  });
  if (edges.length < VISUAL_LAB_LIMITS.edges.min)
    throw visualLabError('INVALID_SCENARIO', 'A graph needs at least one edge');
  if (typeof raw.source !== 'string' || typeof raw.target !== 'string')
    throw visualLabError('INVALID_SCENARIO', 'A start and destination node are required');
  if (!known.has(raw.source) || !known.has(raw.target))
    throw visualLabError('INVALID_SCENARIO', 'Start or destination is not a node');
  if (raw.source === raw.target)
    throw visualLabError('INVALID_SCENARIO', 'Start and destination must differ');
  return { nodes, edges, source: raw.source, target: raw.target };
}

function adjacency(edges: readonly GraphEdge[]) {
  const map = new Map<string, Array<{ to: string; weight: number }>>();
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, []);
    if (!map.has(edge.target)) map.set(edge.target, []);
    map.get(edge.source)!.push({ to: edge.target, weight: edge.weight });
    map.get(edge.target)!.push({ to: edge.source, weight: edge.weight });
  }
  for (const list of map.values()) list.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
  return map;
}

/**
 * Full deterministic Dijkstra trace. Unreachable nodes keep `null` distances and
 * the trace ends by naming them, so disconnected graphs are explained, not hidden.
 */
export function graphTrace(scenario: WeightedGraphScenario): GraphTrace {
  const graph = parseWeightedGraphScenario(scenario);
  const neighbours = adjacency(graph.edges);
  const ids = graph.nodes.map((n) => n.id).sort();
  const label = new Map(graph.nodes.map((n) => [n.id, n.label]));
  const distances = new Map<string, number | null>(ids.map((id) => [id, null]));
  const previous = new Map<string, string[]>();
  distances.set(graph.source, 0);
  const finalized: string[] = [];
  const steps: GraphStep[] = [
    {
      step: 0,
      finalized: [],
      current: null,
      distances: snapshot(distances, ids),
      relaxations: [],
      complete: false,
      explanation: `Start at ${label.get(graph.source)} with total cost 0. Every other node is unreachable until an edge reaches it.`
    }
  ];

  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of ids) {
      if (finalized.includes(id)) continue;
      const d = distances.get(id);
      // `ids` is sorted: among equal distances the first id wins, so ties replay identically.
      if (d === null || d === undefined || d >= best) continue;
      current = id;
      best = d;
    }
    if (current === null) break;
    finalized.push(current);
    const relaxations: GraphStep['relaxations'] = [];
    for (const neighbour of neighbours.get(current) || []) {
      if (finalized.includes(neighbour.to)) continue;
      const candidate = best + neighbour.weight;
      const existing = distances.get(neighbour.to) ?? null;
      const improved = existing === null || candidate < existing;
      const tie = existing !== null && candidate === existing;
      if (improved) {
        distances.set(neighbour.to, candidate);
        // An improvement replaces the predecessor: keeping the old one would
        // reconstruct a route whose cost does not match the settled distance.
        previous.set(neighbour.to, [current]);
      } else if (tie) {
        previous.set(neighbour.to, (previous.get(neighbour.to) || []).concat(current));
      }
      relaxations.push({
        from: current,
        to: neighbour.to,
        weight: neighbour.weight,
        previous: existing,
        distance: improved || tie ? candidate : (existing as number),
        improved,
        tie
      });
    }
    const settled = graph.target === current;
    const parts = [
      `Settle ${label.get(current)} at total cost ${best}.`,
      ...relaxations.map((r) =>
        r.improved
          ? `${label.get(r.from)}→${label.get(r.to)} (${r.weight}) improves the cost to ${r.distance}.`
          : r.tie
            ? `${label.get(r.from)}→${label.get(r.to)} (${r.weight}) matches the existing cost of ${r.distance}.`
            : `${label.get(r.from)}→${label.get(r.to)} (${r.weight}) costs ${r.distance}, so the known ${r.previous} stays.`
      )
    ];
    steps.push({
      step: steps.length,
      finalized: [...finalized],
      current,
      distances: snapshot(distances, ids),
      relaxations,
      complete: settled,
      explanation: parts.join(' ')
    });
    if (settled) break;
  }

  const unreachable = ids.filter((id) => distances.get(id) === null);
  if (unreachable.length)
    steps.push({
      step: steps.length,
      finalized: [...finalized],
      current: null,
      distances: snapshot(distances, ids),
      relaxations: [],
      complete: true,
      explanation: `No remaining node is reachable. Unreachable from ${label.get(graph.source)}: ${unreachable.map((id) => label.get(id)).join(', ')}.`
    });

  const targetDistance = distances.get(graph.target) ?? null;
  const path =
    targetDistance === null ? [] : reconstruct(previous, graph.source, graph.target, ids);
  return { steps, path, totalCost: targetDistance };
}

function snapshot(distances: Map<string, number | null>, ids: string[]) {
  const out: Record<string, number | null> = {};
  for (const id of ids) out[id] = distances.get(id) ?? null;
  return out;
}

/** Ties produce alternatives; pick the lexicographically smallest for replay. */
function reconstruct(
  previous: Map<string, string[]>,
  source: string,
  target: string,
  ids: string[]
): string[] {
  const best = new Map<string, string>();
  for (const id of ids) {
    const candidates = previous.get(id);
    if (candidates?.length) best.set(id, [...candidates].sort()[0]);
  }
  const path: string[] = [];
  let cursor: string | undefined = target;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    path.unshift(cursor);
    if (cursor === source) break;
    cursor = best.get(cursor);
  }
  return path[0] === source ? path : [];
}

export function edgeLabel(edge: GraphEdge, nodes: readonly GraphNode[]): string {
  const name = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  return `${name(edge.source)} ↔ ${name(edge.target)}`;
}

export function distanceSnapshot(trace: GraphTrace): Record<string, number | null> {
  return trace.steps[trace.steps.length - 1].distances;
}
