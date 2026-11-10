/** Reader preview fixture (Batch 3 verification support).
 *
 * Builds a real `PublishedPresentationV1` through the production builder, so
 * the preview renders the same contract the API serves. It exists so the
 * reader can be exercised in a browser without a live database, and is only
 * reachable from the development-only preview route.
 */

import type { LessonBlockV2 } from '@noveris/shared/ednova/learningDocumentV2';
import type { PublishedStructuredAssetV1 } from '@noveris/shared/ednova/structuredAsset';
import {
  buildPublishedPresentation,
  type PublishedPresentationV1,
  type PresentationBuildInput,
} from '@noveris/shared/ednova/presentationDocument';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_batch3_preview';
const contentHash = 'sha256:' + 'c'.repeat(64);
const documentId = 'doc_aaaaaaaaaaaaaaaa';

const span = (page: number) => [
  { chunkId: `chunk-${page}`, documentId, pageNumber: page, lineStart: 1, lineEnd: 40 },
];
const meta = (regionId: string, page: number) => ({
  regionId,
  page,
  bbox: [40, 60, 500, 120] as [number, number, number, number],
  extractionMethod: 'text' as const,
  confidence: 0.86,
  reviewRequired: false,
  issues: [],
});

const maths: LessonBlockV2[] = [
  {
    type: 'heading',
    id: 'h-intro',
    level: 2,
    text: '3.1 Rappels sur les séries numériques',
  },
  {
    type: 'paragraph',
    id: 'p-intro',
    text:
      'Les séries numériques doivent être vues comme des suites particulières : si (u_n) est une suite, la série de terme général u_n est la suite (S_n) définie par S_n = u_0 + … + u_n.',
    evidence: ['chunk-1'],
    provenance: span(1),
  },
  {
    type: 'callout',
    id: 'def-convergence',
    kind: 'definition',
    title: 'Série convergente',
    text:
      "On dit que la série converge lorsque la suite (S_n) converge. Dans ce cas, la limite est appelée somme de la série.",
    evidence: ['chunk-1'],
    provenance: span(1),
  },
  {
    type: 'math',
    id: 'm-reviewed',
    expression: 'S_n = \\sum_{p=0}^{n} u_p \\quad\\text{et}\\quad S = \\lim_{n \\to +\\infty} S_n',
    notation: 'latex',
    evidence: ['chunk-1'],
    provenance: span(1),
    sourceMeta: meta('region_aaaaaaaaaaaaaaaaaaaa', 1),
    review: {
      state: 'corrected',
      originalExpression: 'Sn = X up, S = lim Sn',
      modelExpression: 'S_n = \\sum_{p=0}^{n} u_p',
      reviewer: 'instructor.demo',
    },
  },
  {
    type: 'callout',
    id: 'thm-comparison',
    kind: 'theorem',
    title: 'Théorème de comparaison',
    text:
      "Soient (u_n) et (v_n) deux suites positives. Si u_n ≤ v_n à partir d'un certain rang et si la série de terme général v_n converge, alors la série de terme général u_n converge.",
    evidence: ['chunk-2'],
    provenance: span(2),
  },
  {
    type: 'callout',
    id: 'proof-comparison',
    kind: 'proof',
    title: 'Démonstration',
    text:
      'La suite des sommes partielles de (u_n) est croissante et majorée par la somme de la série (v_n). Une suite croissante et majorée converge.',
    evidence: ['chunk-2'],
    provenance: span(2),
  },
  {
    type: 'math',
    id: 'm-unreviewed',
    expression: 'dt < +1 X un = lim n!+1 n X p=0 up',
    notation: 'plain',
    evidence: ['chunk-3'],
    provenance: span(3),
    sourceMeta: meta('region_bbbbbbbbbbbbbbbbbbbb', 3),
  },
  {
    type: 'callout',
    id: 'ex-31',
    kind: 'exercise',
    title: 'Exercice 3.1',
    text: "Montrer que la série de terme général 1/n² converge et calculer sa somme.",
    evidence: ['chunk-4'],
    provenance: span(4),
  },
  {
    type: 'callout',
    id: 'example-31',
    kind: 'example',
    title: 'Exemple',
    text:
      'La série géométrique de raison 1/2 converge vers 2 : ses sommes partielles valent 2 − 2^(1−n).',
    evidence: ['chunk-4'],
    provenance: span(4),
  },
  {
    type: 'math',
    id: 'm-derivation',
    expression:
      '\\begin{aligned} S_n &= \\sum_{p=0}^{n} \\frac{1}{2^p} \\\\ &= 2 - \\frac{1}{2^{n}} \\end{aligned}',
    notation: 'latex',
    evidence: ['chunk-4'],
    provenance: span(4),
    sourceMeta: meta('region_cccccccccccccccccccc', 4),
    review: {
      state: 'accepted',
      originalExpression: 'Sn = 2 - 1/2^n',
      modelExpression: 'S_n = 2 - \\frac{1}{2^{n}}',
      reviewer: 'instructor.demo',
    },
  },
  {
    type: 'callout',
    id: 'remark-31',
    kind: 'remark',
    title: 'Remarque',
    text:
      'La convergence ne dépend pas des premiers termes : modifier un nombre fini de termes ne change pas la nature de la série.',
    evidence: ['chunk-4'],
    provenance: span(4),
  },
];

const networking: LessonBlockV2[] = [
  { type: 'heading', id: 'h-tcp', level: 2, text: '4.2 Établissement d’une connexion TCP' },
  {
    type: 'paragraph',
    id: 'p-tcp',
    text:
      'Une connexion TCP est établie par un échange en trois temps. Le client envoie un segment SYN, le serveur répond par SYN-ACK, puis le client acquitte par ACK.',
    evidence: ['chunk-10'],
    provenance: span(10),
  },
  {
    type: 'table',
    id: 't-messages',
    caption: 'Messages de l’établissement de connexion',
    columns: ['Message', 'Émetteur', 'Rôle'],
    rows: [
      ['SYN', 'Client', 'Demande d’ouverture'],
      ['SYN-ACK', 'Serveur', 'Accusé et ouverture'],
      ['ACK', 'Client', 'Confirmation'],
    ],
    evidence: ['chunk-10'],
    provenance: span(10),
  },
  {
    type: 'diagram',
    id: 'dg-handshake',
    title: 'Déroulement de la poignée de main',
    description: 'Les trois messages, dans l’ordre du protocole.',
    steps: [
      { id: 's1', label: 'Client → Serveur : SYN', detail: 'Le client propose un numéro de séquence.' },
      { id: 's2', label: 'Serveur → Client : SYN-ACK', detail: 'Le serveur accuse et propose son numéro.' },
      { id: 's3', label: 'Client → Serveur : ACK', detail: 'La connexion est établie.' },
    ],
    evidence: ['chunk-10'],
    provenance: span(10),
  },
  {
    type: 'code',
    id: 'code-listen',
    language: 'python',
    code: 'import socket\n\nserver = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\nserver.bind(("127.0.0.1", 8080))\nserver.listen(1)\nconnection, address = server.accept()\nprint("connected", address)',
    caption: 'Un serveur TCP minimal, à titre d’illustration.',
    evidence: ['chunk-11'],
    provenance: span(11),
  },
  {
    type: 'chart',
    id: 'ch-latency',
    title: 'Latence mesurée par taille de segment',
    caption: 'Valeurs de démonstration.',
    kind: 'bar',
    categories: ['64 o', '512 o', '1 Ko'],
    series: [{ label: 'Aller-retour (ms)', values: [2, 4, 7] }],
    evidence: ['chunk-11'],
    provenance: span(11),
  },
  {
    type: 'media',
    id: 'fig-topology',
    mediaType: 'image',
    alt: 'Schéma du réseau de laboratoire',
    caption: 'Figure 4.1 — topologie du laboratoire.',
    evidence: ['chunk-11'],
    provenance: span(11),
  },
];

const prose: LessonBlockV2[] = [
  { type: 'heading', id: 'h-prose', level: 2, text: '1.1 What a proof is' },
  {
    type: 'paragraph',
    id: 'p-prose',
    text:
      'A proof is a finite sequence of statements in which each statement follows from the previous ones by an accepted rule of inference. The purpose of a proof is not persuasion but justification: it shows that the conclusion cannot fail to hold.',
    evidence: ['chunk-20'],
    provenance: span(20),
  },
  {
    type: 'quote',
    id: 'q-prose',
    text: 'A proof is what convinces a mathematician who doubts.',
    evidence: ['chunk-20'],
    provenance: span(20),
  },
  {
    type: 'list',
    id: 'l-prose',
    ordered: true,
    items: [
      'State the assumptions precisely.',
      'Choose a method of proof.',
      'Derive each step from an accepted rule.',
      'State the conclusion and check it matches the claim.',
    ],
    evidence: ['chunk-20'],
    provenance: span(20),
  },
  {
    type: 'paragraph',
    id: 'p-prose-2',
    text:
      'This lesson deliberately contains no mathematics beyond a single symbol: the reader must stay comfortable when a course has no formulas, no diagrams and no code.',
    evidence: ['chunk-21'],
    provenance: span(21),
  },
];

/** A lesson with many unreviewed formulas, mirroring the reference course's
 * 83 source-faithful mathematics blocks. It exists to measure whether those
 * images are fetched eagerly. */
const stressMath: LessonBlockV2[] = [
  { type: 'heading', id: 'h-stress', level: 2, text: '3.9 Formules non révisées (charge)' },
  {
    type: 'paragraph',
    id: 'p-stress',
    text:
      'Cette leçon contient de nombreuses formules non révisées, comme la version publiée de référence. Elle sert à mesurer le comportement de chargement.',
    evidence: ['chunk-30'],
    provenance: span(30),
  },
  ...Array.from({ length: 60 }, (_, index): LessonBlockV2 => ({
    type: 'math',
    id: `stress-${index + 1}`,
    expression: `F_{${index + 1}} = \\int_{0}^{${index + 1}} f(x)\\,dx`,
    notation: 'plain',
    evidence: [`chunk-${30 + index}`],
    provenance: span(30 + (index % 5)),
    sourceMeta: meta(`region_${String(index + 100).padStart(20, '0')}`.slice(0, 27), 30 + (index % 5)),
  })),
];

const input: PresentationBuildInput = {
  courseId,
  revisionId,
  contentHash,
  canonicalContentHash: contentHash,
  title: 'Analyse et réseaux — aperçu Batch 3',
  summary:
    'A multi-subject preview built through the production presentation contract: reviewed and unreviewed mathematics, structured proofs, code, tables, a process diagram and prose.',
  objectives: [
    { objectiveId: 'obj-1', statement: 'Distinguish a convergent series from a divergent one.', bloomLevel: 'understand' },
    { objectiveId: 'obj-2', statement: 'Apply the comparison test to a positive-term series.', bloomLevel: 'apply' },
    { objectiveId: 'obj-3', statement: 'Describe the TCP three-way handshake.', bloomLevel: 'understand' },
  ],
  chapters: [
    {
      id: 'chapter-3',
      title: 'Chapitre 3 — Séries de fonctions',
      summary: 'Convergence, comparaison et sommes partielles.',
      lessons: [
        { id: 'lesson-3-1', title: 'Rappels sur les séries numériques', summary: 'Définitions et premiers exemples.', blocks: maths },
      ],
    },
    {
      id: 'chapter-4',
      title: 'Chapitre 4 — Réseaux',
      summary: 'Transport et établissement de connexion.',
      lessons: [
        { id: 'lesson-4-2', title: 'Établissement d’une connexion TCP', summary: 'La poignée de main en trois temps.', blocks: networking },
        { id: 'lesson-4-3', title: 'Reading prose without mathematics', summary: 'A lesson with no formulas at all.', blocks: prose },
        { id: 'lesson-4-4', title: 'Formules non révisées (charge)', summary: 'Performance measurement lesson.', blocks: stressMath },
      ],
    },
  ],
  sources: [
    {
      documentId,
      contentHash,
      pageNumber: null,
      href: `/api/v1/study/courses/${courseId}/revisions/${revisionId}/sources/${documentId}`,
    },
  ],
  warnings: [
    'Source provenance is bound to the preserved document. Extraction fidelity, including symbols and layout, is unverified.',
  ],
};

export const previewPresentation: PublishedPresentationV1 = buildPublishedPresentation(input);
export const previewCourseId = courseId;

/** One authorized structured asset, to exercise the Milestone 3.6 path in a
 * browser. It is explicitly marked as demonstration content: the reader labels
 * it as such and never presents it as source material. */
export const previewAssets: PublishedStructuredAssetV1[] = [
  {
    schemaVersion: '1.0.0',
    assetId: 'asset_preview_tcp_walkthrough',
    courseId,
    revisionId,
    lessonId: 'lesson-4-2',
    blockId: 'code-listen',
    component: 'CodeWalkthrough',
    provenance: 'deterministic_demo',
    review: { status: 'not_applicable' },
    payload: {
      component: 'CodeWalkthrough',
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
        { line: 0, explanation: 'Imports the socket module. Nothing is executed.' },
        {
          line: 2,
          explanation: 'Creates a TCP socket.',
          state: [{ name: 'server', value: 'socket(AF_INET, SOCK_STREAM)' }],
        },
        { line: 3, explanation: 'Binds to loopback port 8080.' },
        { line: 4, explanation: 'Begins listening with a backlog of one.' },
        {
          line: 5,
          explanation: 'Blocks until a peer completes the handshake.',
          state: [{ name: 'connection', value: 'accepted' }],
        },
      ],
    },
    label: 'Demonstration content',
    fallback: 'CodeViewer',
    disclosure: 'Authored demonstration, not source content and not instructor-reviewed.',
  },
];
