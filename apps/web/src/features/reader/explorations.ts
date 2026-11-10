/** Deterministic interactive explorations (Batch 3, Milestone 3.4).
 *
 * These are NOT source content. The canonical projection carries no trusted
 * structured input for a graph, a sequence or a topology, so the reader cannot
 * derive an interaction from it without inventing data. Instead this module
 * declares a small, fixed set of explorations with an explicit provenance:
 * they are deterministic educational visualisations written by the product,
 * matched to a lesson by concept keyword, and always labelled as such.
 *
 * They are never presented as instructor-reviewed, never as source excerpts,
 * and never as evidence of mastery. A lesson with no match gets no
 * exploration — nothing is forced into a lesson that does not need it.
 */

import type { LessonBlockV2 } from '@noveris/shared/ednova/learningDocumentV2';

export type ExplorationProvenance = 'deterministic_demo';

export type Exploration =
  | {
      kind: 'sequence';
      id: string;
      title: string;
      caption: string;
      /** Restricted arithmetic expression in n. */
      term: string;
      behaviour?: string;
      matches: string[];
    }
  | {
      kind: 'function';
      id: string;
      title: string;
      caption: string;
      expression: string;
      variable?: string;
      domain?: { from: number; to: number };
      parameters?: Array<{
        name: string;
        label: string;
        min: number;
        max: number;
        step: number;
        defaultValue: number;
      }>;
      matches: string[];
    }
  | {
      kind: 'code';
      id: string;
      title: string;
      caption: string;
      language: string;
      code: string;
      annotations: Array<{
        line: number;
        explanation: string;
        state?: Array<{ name: string; value: string }>;
      }>;
      matches: string[];
    }
  | {
      kind: 'topology';
      id: string;
      title: string;
      caption: string;
      nodes: Array<{
        id: string;
        label: string;
        x: number;
        y: number;
        detail?: string;
        kind?: 'host' | 'router' | 'switch' | 'service' | 'store' | 'client';
      }>;
      links: Array<{ from: string; to: string; label?: string }>;
      matches: string[];
    }
  | {
      kind: 'derivation';
      id: string;
      title: string;
      caption: string;
      steps: Array<{ expression: string; explanation?: string }>;
      matches: string[];
    };

export const EXPLORATION_PROVENANCE: ExplorationProvenance = 'deterministic_demo';

export const EXPLORATION_DISCLOSURE =
  'Deterministic educational visualisation supplied with the reader. It is not source content, not instructor-reviewed and not a proof.';

/** The fixed exploration set. Adding one here is a code change with review,
 * never something a model or an upload can do. */
export const EXPLORATIONS: readonly Exploration[] = Object.freeze([
  {
    kind: 'sequence',
    id: 'series-partial-sums',
    title: 'Partial sums of a geometric series',
    caption:
      'The geometric series with ratio 1/2. Each point is a partial sum S(n); the plotted points approach 2 without reaching it at any finite n.',
    term: '1 / 2 ^ n',
    behaviour:
      'Sampled partial sums approach 2. The plot shows sampled values; it does not prove convergence.',
    matches: ['série', 'series', 'somme', 'sum', 'convergence', 'converge', 'géométrique', 'geometric'],
  },
  {
    kind: 'sequence',
    id: 'harmonic-divergence',
    title: 'Harmonic partial sums',
    caption:
      'The harmonic series 1/n. Partial sums keep growing, but slowly: no finite plot proves divergence.',
    term: '1 / n',
    behaviour:
      'Partial sums grow without an apparent bound. A finite plot is suggestive only; divergence needs a proof.',
    matches: ['harmonique', 'harmonic', 'diverge', 'divergence', 'série', 'series'],
  },
  {
    kind: 'function',
    id: 'function-shape',
    title: 'Shape of a simple function',
    caption:
      'Explore how a scale factor changes the shape of a curve. Drag the slider to compare values at the same x.',
    expression: 'a * sin(x)',
    variable: 'x',
    domain: { from: -6.28, to: 6.28 },
    parameters: [
      { name: 'a', label: 'Scale a', min: 0.1, max: 3, step: 0.1, defaultValue: 1 },
    ],
    matches: ['fonction', 'function', 'courbe', 'curve', 'sinus', 'sin', 'limite', 'limit', 'continuité'],
  },
  {
    kind: 'derivation',
    id: 'bounded-monotone',
    title: 'A bounded monotone sequence converges',
    caption:
      'A three-line outline of the standard argument, shown step by step. This is a teaching outline, not the source proof.',
    steps: [
      {
        expression: '(u_n) \\text{ is increasing and bounded above}',
        explanation: 'Start from the two hypotheses the theorem requires.',
      },
      {
        expression: '\\sup_{n} u_n = \\ell \\text{ exists in } \\mathbb{R}',
        explanation: 'A non-empty bounded-above set of reals has a least upper bound.',
      },
      {
        expression: '\\forall \\varepsilon > 0,\\ \\exists N,\\ u_N > \\ell - \\varepsilon',
        explanation: 'By the definition of the supremum, some term lies within ε of it.',
      },
      {
        expression: 'n \\ge N \\Rightarrow \\ell - \\varepsilon < u_n \\le \\ell',
        explanation: 'Monotonicity traps every later term between that bound and ℓ.',
      },
    ],
    matches: ['monotone', 'bornée', 'bounded', 'converge', 'convergence', 'suite', 'sequence', 'théorème'],
  },
  {
    kind: 'topology',
    id: 'tcp-three-way',
    title: 'Three-way handshake as a validated topology',
    caption:
      'Select an element to read its role. The connection path is authored with the lesson, not inferred from a picture.',
    nodes: [
      {
        id: 'client',
        label: 'Client',
        x: 14,
        y: 50,
        kind: 'client',
        detail: 'Initiates the connection by sending SYN with an initial sequence number.',
      },
      {
        id: 'server',
        label: 'Server',
        x: 50,
        y: 50,
        kind: 'service',
        detail: 'Acknowledges with SYN-ACK and reserves state for the connection.',
      },
      {
        id: 'app',
        label: 'Application',
        x: 86,
        y: 50,
        kind: 'store',
        detail: 'Receives the established stream once the client confirms with ACK.',
      },
    ],
    links: [
      { from: 'client', to: 'server', label: 'SYN' },
      { from: 'server', to: 'client', label: 'SYN-ACK' },
      { from: 'client', to: 'server', label: 'ACK' },
      { from: 'server', to: 'app', label: 'stream' },
    ],
    matches: ['tcp', 'connexion', 'connection', 'handshake', 'poignée', 'transport', 'syn', 'ack'],
  },
  {
    kind: 'code',
    id: 'socket-accept',
    title: 'Guided walkthrough of a minimal TCP server',
    caption: 'Step through the reviewed lines. The code is displayed only and is never executed.',
    language: 'python',
    code: [
      'import socket',
      '',
      'server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)',
      'server.bind(("127.0.0.1", 8080))',
      'server.listen(1)',
      'connection, address = server.accept()',
      'print("connected", address)',
    ].join('\n'),
    annotations: [
      { line: 0, explanation: 'Imports the standard socket module. Nothing is executed here.' },
      {
        line: 2,
        explanation: 'Creates a TCP socket for IPv4.',
        state: [{ name: 'server', value: 'socket(AF_INET, SOCK_STREAM)' }],
      },
      {
        line: 3,
        explanation: 'Binds the socket to loopback port 8080.',
        state: [{ name: 'bound', value: '127.0.0.1:8080' }],
      },
      { line: 4, explanation: 'Marks the socket as listening with a backlog of one.' },
      {
        line: 5,
        explanation: 'Blocks until a peer completes the handshake, then returns the connection.',
        state: [{ name: 'connection', value: 'accepted' }],
      },
    ],
    matches: ['socket', 'serveur', 'server', 'tcp', 'python', 'code', 'connexion'],
  },
]);

function lessonText(blocks: LessonBlockV2[], title: string): string {
  const parts: string[] = [title];
  for (const block of blocks) {
    if (block.type === 'heading') parts.push(block.text);
    else if (block.type === 'paragraph' || block.type === 'quote') parts.push(block.text);
    else if (block.type === 'callout') parts.push(block.title ?? '', block.text);
    else if (block.type === 'list') parts.push(...block.items);
    else if (block.type === 'math') parts.push(block.caption ?? '');
  }
  return parts.join(' ').toLowerCase();
}

/** A lesson is eligible for a visualisation only when it actually carries
 * quantitative material. Prose that merely mentions "theorem" or "sequence"
 * is not: forcing an interaction into it is exactly what the reader must not
 * do. */
function hasQuantitativeMaterial(blocks: LessonBlockV2[]): boolean {
  return blocks.some(
    (block) => block.type === 'math' || block.type === 'chart' || block.type === 'table',
  );
}

/** Deterministic, order-stable match: the first exploration whose keywords
 * appear in the lesson wins. No scoring, no randomness, no model. */
export function explorationsForLesson(
  blocks: LessonBlockV2[],
  title: string,
  limit = 2,
): Exploration[] {
  if (!hasQuantitativeMaterial(blocks)) return [];
  const text = lessonText(blocks, title);
  const matched = EXPLORATIONS.filter((exploration) =>
    exploration.matches.some((keyword) => text.includes(keyword.toLowerCase())),
  );
  return matched.slice(0, limit);
}
