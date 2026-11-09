/**
 * Visual Learning Lab planning orchestration.
 *
 * Responsibilities kept here, in the owning domain:
 * - authorize the course and pin the published revision before any model call;
 * - select and minimize the source excerpts sent to the AI service;
 * - validate every AI proposal against the registered engines;
 * - persist validated labs and deduplicate equivalent generation requests.
 *
 * The deterministic engine state (graph trace, parameter output) is never taken
 * from the model; it is computed by shared/visualLab on both sides.
 */
import crypto from 'node:crypto';
import aiClient from '../../../../shared/aiClient';
import { CourseRevision, VisualLab, type IVisualLab } from '../models';
import { canReadCourse } from './resourceAccess';
import {
  PublicationForbiddenError,
  UnpublishedCourseError,
  getPublishedCourseContext,
  resolveCourseSource
} from './coursePublication';
import { verifyRevisionArtifact } from './revisionSources';
import {
  buildStoredLab,
  deterministicGuidance,
  fallbackCandidate,
  gradeCheck,
  parseLabCandidate,
  toPublicLab,
  type LabCandidate,
  type StoredLab
} from '../../../../shared/visualLab/definition';
import { graphTrace } from '../../../../shared/visualLab/graph';
import { parameterOutput } from '../../../../shared/visualLab/parameter-models';
import { functionOutput } from '../../../../shared/visualLab/function-models';
import { spatialOutput } from '../../../../shared/visualLab/spatial-models';
import {
  VISUAL_LAB_LIMITS,
  type LabDefinition,
  type LabSourceContext,
  type PublicVisualLab,
  type FunctionScenario,
  type SpatialScenario,
  type VisualLabEngine
} from '../../../../shared/visualLab/types';

export class VisualLabValidationError extends Error {
  readonly status = 400;
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'VisualLabValidationError';
  }
}
export class VisualLabNotFoundError extends Error {
  readonly status = 404;
  readonly code = 'LAB_NOT_FOUND';
  constructor() {
    super('Visual lab not found');
    this.name = 'VisualLabNotFoundError';
  }
}
export class VisualLabUnavailableError extends Error {
  readonly status = 503;
  readonly code = 'VISUAL_LAB_UNAVAILABLE';
  constructor(message = 'Visual lab planning is unavailable') {
    super(message);
    this.name = 'VisualLabUnavailableError';
  }
}

export interface PlanLabInput {
  mode: 'course' | 'topic';
  courseId?: string;
  revisionId?: string;
  topicId?: string;
  concept: string;
  language?: 'en' | 'fr' | 'ar' | 'ary';
}

const MAX_PASSAGES = 6;
const PASSAGE_CHARS = 900;

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string')
    throw new VisualLabValidationError('INVALID_INPUT', `${field} is required`);
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) throw new VisualLabValidationError('INVALID_INPUT', `${field} is required`);
  if (Array.from(trimmed).length > max)
    throw new VisualLabValidationError('INVALID_INPUT', `${field} is too long`);
  return trimmed;
}

export function parsePlanInput(value: unknown): PlanLabInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new VisualLabValidationError('INVALID_INPUT', 'A planning request is required');
  const raw = value as Record<string, unknown>;
  const allowed = ['mode', 'courseId', 'revisionId', 'topicId', 'concept', 'language'];
  if (Object.keys(raw).some((key) => !allowed.includes(key)))
    throw new VisualLabValidationError('INVALID_INPUT', 'Unsupported planning field');
  if (raw.mode !== 'course' && raw.mode !== 'topic')
    throw new VisualLabValidationError('INVALID_INPUT', 'Mode must be course or topic');
  const language = raw.language === undefined ? 'en' : (raw.language as PlanLabInput['language']);
  if (!['en', 'fr', 'ar', 'ary'].includes(String(language)))
    throw new VisualLabValidationError('INVALID_INPUT', 'Unsupported language');
  const concept = text(raw.concept, 'Concept', 500);

  if (raw.mode === 'topic') {
    if (raw.courseId !== undefined || raw.revisionId !== undefined || raw.topicId !== undefined)
      throw new VisualLabValidationError(
        'INVALID_SOURCE_CLAIM',
        'A topic lab cannot claim course context'
      );
    return { mode: 'topic', concept, language };
  }

  if (typeof raw.courseId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.courseId))
    throw new VisualLabValidationError('INVALID_INPUT', 'A valid course is required');
  if (raw.revisionId !== undefined && typeof raw.revisionId !== 'string')
    throw new VisualLabValidationError('INVALID_INPUT', 'Invalid revision');
  if (raw.topicId !== undefined && typeof raw.topicId !== 'string')
    throw new VisualLabValidationError('INVALID_INPUT', 'Invalid topic');
  return {
    mode: 'course',
    courseId: raw.courseId,
    revisionId: raw.revisionId as string | undefined,
    topicId: raw.topicId as string | undefined,
    concept,
    language
  };
}

/** Local classification used only to build an honestly-labelled fallback. */
const GRAPH_TERMS = [
  'dijkstra',
  'shortest path',
  'shortest-path',
  'weighted graph',
  'graph',
  'routing',
  'router',
  'network',
  'connectivity',
  'dependency',
  'topology',
  'cheapest route'
];
const PARAMETER_TERMS = ['newton', 'f = ma', 'f=ma', 'force', 'mass', 'acceleration', 'second law'];
const SPATIAL_TERMS = ['projectile', 'trajectory', 'launch angle', 'ballistic', 'parabolic'];
const FUNCTION_TERMS = [
  'quadratic',
  'parabola',
  'vertex',
  'polynomial',
  'discriminant',
  'roots of',
  'y = ax'
];
function scoreEngines(concept: string) {
  const lowered = concept.toLowerCase();
  const score = (terms: string[]) => terms.filter((term) => lowered.includes(term)).length;
  return {
    weighted_graph: score(GRAPH_TERMS),
    parameter_model: score(PARAMETER_TERMS),
    spatial_3d: score(SPATIAL_TERMS),
    function_plot: score(FUNCTION_TERMS)
  } satisfies Record<VisualLabEngine, number>;
}

export function classifyLocally(concept: string): VisualLabEngine | null {
  const {
    weighted_graph: graph,
    parameter_model: parameter,
    spatial_3d: spatial,
    function_plot: fn
  } = scoreEngines(concept);
  if (!graph && !parameter && !spatial && !fn) return null;
  if (spatial >= graph && spatial >= parameter && spatial >= fn) return 'spatial_3d';
  if (fn >= graph && fn >= parameter) return 'function_plot';
  return parameter > graph ? 'parameter_model' : 'weighted_graph';
}

function normalizeConcept(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim()
    .slice(0, 200);
}

export type PlannedLab =
  { kind: 'lab'; lab: PublicVisualLab } | { kind: 'unsupported'; message: string };

/**
 * Authorize, ground, plan and persist one lab.
 *
 * The same (owner, request) pair returns the stored lab instead of calling the
 * model again. A course-sourced lab keeps its original revision pin.
 */
export async function planVisualLab(actor: string, rawInput: unknown): Promise<PlannedLab> {
  const input = parsePlanInput(rawInput);
  let sourceContext: LabSourceContext;
  let passages: Array<Record<string, unknown>> = [];

  if (input.mode === 'course') {
    const courseId = input.courseId as string;
    if (!(await canReadCourse(actor, courseId)))
      throw new PublicationForbiddenError('Access to course materials denied');
    const resolution = await resolveCourseSource(actor, courseId, input.revisionId);
    if (resolution.access.decision !== 'allowed') {
      if (resolution.access.code === 'UNPUBLISHED') throw new UnpublishedCourseError();
      throw new PublicationForbiddenError('Access to course materials denied');
    }
    const published = await getPublishedCourseContext(actor, courseId, input.revisionId);

    const revision = await CourseRevision.findOne({
      courseId,
      revisionTag: published.revisionId
    });
    if (!revision) throw new VisualLabUnavailableError('Exact revision is unavailable');
    const artifact = await verifyRevisionArtifact(revision);
    const authorized = new Set(published.authorizedDocumentIds);

    // Only verified passages are candidates; the concept and topic narrow them.
    const terms = normalizeConcept(`${input.concept} ${input.topicId || ''}`)
      .split(' ')
      .filter((term) => term.length > 3);
    const scored = artifact.passages
      .filter((p) => authorized.has(p.documentId))
      .map((p) => {
        const body = p.text.toLowerCase();
        const overlap = terms.filter((term) => body.includes(term)).length;
        return { p, overlap };
      })
      .filter(({ p, overlap }) => overlap > 0 || (input.topicId && p.sectionId === input.topicId))
      .sort((a, b) => b.overlap - a.overlap || a.p.chunkId.localeCompare(b.p.chunkId))
      .slice(0, MAX_PASSAGES);

    passages = scored.map(({ p }) => ({
      documentId: p.documentId,
      pageNumber: p.pageNumber,
      sectionId: p.sectionId,
      text: p.text.slice(0, PASSAGE_CHARS)
    }));
    sourceContext = {
      mode: 'course',
      courseId,
      revisionId: published.revisionId,
      topicId: input.topicId,
      passageIds: scored.map(({ p }) => p.chunkId)
    };

    if (!(await canReadCourse(actor, courseId)))
      throw new PublicationForbiddenError('Course access revoked before planning');
  } else {
    sourceContext = { mode: 'topic', topic: input.concept };
  }

  const generationKey = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        mode: input.mode,
        courseId: sourceContext.courseId || null,
        revisionId: sourceContext.revisionId || null,
        topicId: sourceContext.topicId || null,
        concept: normalizeConcept(input.concept),
        schema: 1
      })
    )
    .digest('hex');

  const existing = await VisualLab.findOne({ ownerUserId: actor, generationKey });
  if (existing) return { kind: 'lab', lab: toPublicLab(fromDocument(existing)) };

  let candidate: LabCandidate | null = null;
  let generationMode: StoredLab['generationMode'] = 'AI_PLANNED';
  let unsupported: string | undefined;

  try {
    const response = await aiClient.post(
      '/api/ai/visual-lab/plan',
      {
        schemaVersion: '1.0.0',
        mode: input.mode,
        concept: input.concept,
        courseId: sourceContext.courseId,
        revisionId: sourceContext.revisionId,
        topicId: input.topicId,
        passages,
        language: input.language || 'en'
      },
      { timeout: 45000 }
    );
    const raw = response.data as Record<string, unknown>;
    const status = raw?.status;
    if (status === 'planned') {
      try {
        candidate = parseLabCandidate(raw.candidate);
      } catch {
        // The AI service validated structurally, but the domain validator is authoritative.
        unsupported =
          'The AI proposal did not satisfy the simulator’s own limits, so it was discarded.';
      }
    } else if (status === 'unsupported') {
      unsupported =
        typeof raw.reason === 'string' && raw.reason.trim()
          ? raw.reason.slice(0, 400)
          : 'No supported visual lab can demonstrate this concept accurately.';
    }
  } catch {
    // Model/service failure must not break the lab: fall through to a labelled example.
  }

  if (!candidate) {
    const engine = classifyLocally(input.concept);
    if (!engine)
      return {
        kind: 'unsupported',
        message:
          unsupported ||
          'No supported engine can demonstrate this concept accurately, so no simulation was created.'
      };
    candidate = fallbackCandidate(engine, input.concept);
    generationMode = 'DETERMINISTIC_FALLBACK';
  }

  const labId = `lab_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const stored = buildStoredLab({
    labId,
    candidate,
    sourceContext,
    generationMode,
    createdAt: new Date().toISOString()
  });
  const document = {
    labId,
    schemaVersion: stored.schemaVersion,
    ownerUserId: actor,
    scope: 'private' as const,
    sourceMode: sourceContext.mode,
    courseId: sourceContext.courseId,
    revisionId: sourceContext.revisionId,
    topicId: sourceContext.topicId,
    passageIds: sourceContext.passageIds || [],
    topic: sourceContext.topic,
    engine: stored.engine,
    title: stored.title,
    concept: stored.concept,
    learningObjective: stored.learningObjective,
    definition: stored.definition,
    guidance: stored.guidance,
    check: stored.check,
    generationMode: stored.generationMode,
    generationKey
  };
  try {
    const saved = await VisualLab.create(document);
    return { kind: 'lab', lab: toPublicLab(fromDocument(saved)) };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      // A concurrent identical request won the race; reuse it rather than bill twice.
      const winner = await VisualLab.findOne({ ownerUserId: actor, generationKey });
      if (winner) return { kind: 'lab', lab: toPublicLab(fromDocument(winner)) };
    }
    throw error;
  }
}

function fromDocument(source: object): StoredLab {
  const doc = source as Record<string, unknown>;
  return {
    labId: String(doc.labId),
    schemaVersion: 1,
    engine: doc.engine as VisualLabEngine,
    title: String(doc.title),
    concept: String(doc.concept),
    learningObjective: String(doc.learningObjective),
    sourceContext: {
      mode: doc.sourceMode as 'course' | 'topic',
      courseId: doc.courseId as string | undefined,
      revisionId: doc.revisionId as string | undefined,
      topicId: doc.topicId as string | undefined,
      passageIds: (doc.passageIds as string[]) || [],
      topic: doc.topic as string | undefined
    },
    definition: doc.definition as LabDefinition,
    guidance: doc.guidance as StoredLab['guidance'],
    check: doc.check as StoredLab['check'],
    generationMode: doc.generationMode as StoredLab['generationMode'],
    createdAt: (doc.createdAt as Date | undefined)?.toISOString?.() || new Date().toISOString()
  };
}

/** Owner-scoped read. A course-sourced lab re-checks the course grant every time. */
async function loadOwned(
  actor: string,
  labId: string
): Promise<{ stored: StoredLab; doc: IVisualLab }> {
  if (typeof labId !== 'string' || !/^lab_[a-f0-9]{20}$/.test(labId))
    throw new VisualLabNotFoundError();
  const doc = await VisualLab.findOne({ labId, ownerUserId: actor });
  if (!doc) throw new VisualLabNotFoundError();
  if (doc.courseId && !(await canReadCourse(actor, doc.courseId)))
    throw new PublicationForbiddenError('Access to the source course is no longer available');
  return {
    stored: fromDocument(doc as unknown as Record<string, unknown>),
    doc: doc as IVisualLab
  };
}

export async function getVisualLab(actor: string, labId: string): Promise<PublicVisualLab> {
  return toPublicLab((await loadOwned(actor, labId)).stored);
}

/** Authoritative state for one experiment, recomputed on the server. */
export function authoritativeState(
  definition: LabDefinition,
  parameters: unknown
): Record<string, unknown> {
  if (definition.engine === 'weighted_graph') {
    const base = definition.scenario;
    const overrides = parseWeightOverrides(base.edges, parameters);
    const edges = base.edges.map((edge, index) => ({
      ...edge,
      weight: overrides[index] ?? edge.weight
    }));
    const trace = graphTrace({ ...base, edges });
    const final = trace.steps[trace.steps.length - 1];
    return {
      engine: 'weighted_graph',
      source: base.source,
      target: base.target,
      edges,
      totalCost: trace.totalCost,
      path: trace.path,
      distances: final.distances,
      steps: trace.steps.length - 1
    };
  }
  if (definition.engine === 'function_plot') {
    const overrides =
      parameters && typeof parameters === 'object' && !Array.isArray(parameters) ? parameters : {};
    const { fn, values, output } = functionOutput({
      functionId: definition.scenario.functionId,
      values: { ...definition.scenario.values, ...overrides } as FunctionScenario['values']
    });
    return {
      engine: 'function_plot',
      functionId: fn.id,
      values,
      vertex: output.vertex,
      roots: output.roots,
      discriminant: output.discriminant
    };
  }
  if (definition.engine === 'spatial_3d') {
    const overrides =
      parameters && typeof parameters === 'object' && !Array.isArray(parameters) ? parameters : {};
    const { scene, values, output } = spatialOutput({
      sceneId: definition.scenario.sceneId,
      values: { ...definition.scenario.values, ...overrides } as SpatialScenario['values']
    });
    return {
      engine: 'spatial_3d',
      sceneId: scene.id,
      values,
      range: output.range,
      maxHeight: output.maxHeight,
      timeOfFlight: output.timeOfFlight,
      landing: output.landing
    };
  }
  const values =
    parameters && typeof parameters === 'object'
      ? { ...definition.scenario.values, ...(parameters as Record<string, unknown>) }
      : definition.scenario.values;
  const {
    model,
    values: validated,
    output
  } = parameterOutput({
    modelId: definition.scenario.modelId,
    values: values as { force: number; mass: number }
  });
  return {
    engine: 'parameter_model',
    modelId: model.id,
    formula: model.output.formula,
    values: validated,
    acceleration: output.acceleration
  };
}

function parseWeightOverrides(
  edges: ReadonlyArray<{ weight: number }>,
  parameters: unknown
): Array<number | undefined> {
  if (parameters === undefined || parameters === null) return [];
  if (!Array.isArray(parameters) || parameters.length !== edges.length)
    throw new VisualLabValidationError(
      'INVALID_PARAMETER',
      'Edge weights must be supplied for every edge'
    );
  return parameters.map((value, index) => {
    if (value === undefined) return undefined;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < VISUAL_LAB_LIMITS.weight.min ||
      value > VISUAL_LAB_LIMITS.weight.max
    )
      throw new VisualLabValidationError(
        'INVALID_PARAMETER',
        `Edge ${index + 1} must be a whole number from ${VISUAL_LAB_LIMITS.weight.min} to ${VISUAL_LAB_LIMITS.weight.max}`
      );
    return value;
  });
}

export interface GuideInput {
  question: string;
  guidanceMode: 'explain' | 'hint' | 'next' | 'challenge';
  parameters?: unknown;
}

export function parseGuideInput(value: unknown): GuideInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new VisualLabValidationError('INVALID_INPUT', 'A question is required');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !['question', 'guidanceMode', 'parameters'].includes(key)))
    throw new VisualLabValidationError('INVALID_INPUT', 'Unsupported guidance field');
  const guidanceMode = raw.guidanceMode === undefined ? 'explain' : raw.guidanceMode;
  if (!['explain', 'hint', 'next', 'challenge'].includes(String(guidanceMode)))
    throw new VisualLabValidationError('INVALID_INPUT', 'Unsupported guidance mode');
  return {
    question: text(raw.question, 'Question', 1000),
    guidanceMode: guidanceMode as GuideInput['guidanceMode'],
    parameters: raw.parameters
  };
}

export async function guideVisualLab(actor: string, labId: string, rawInput: unknown) {
  const { stored } = await loadOwned(actor, labId);
  const input = parseGuideInput(rawInput);
  const state = authoritativeState(stored.definition, input.parameters);
  try {
    const response = await aiClient.post(
      '/api/ai/visual-lab/guide',
      {
        schemaVersion: '1.0.0',
        question: input.question,
        concept: stored.concept,
        learningObjective: stored.learningObjective,
        engine: stored.engine,
        guidanceMode: input.guidanceMode,
        state
      },
      { timeout: 40000 }
    );
    const raw = response.data as Record<string, unknown>;
    if (raw.status === 'guided' && typeof raw.text === 'string' && raw.text.trim())
      return {
        status: 'guided' as const,
        text: raw.text.slice(0, 2000),
        executionMode: typeof raw.executionMode === 'string' ? raw.executionMode : 'REAL_APPROVED',
        state
      };
  } catch {
    /* Deterministic guidance below keeps the simulation usable. */
  }
  return {
    status: 'fallback' as const,
    text: deterministicGuidance(stored.engine, input.question, state),
    executionMode: 'DETERMINISTIC_FALLBACK',
    state
  };
}

export async function checkUnderstanding(actor: string, labId: string, rawInput: unknown) {
  const { stored } = await loadOwned(actor, labId);
  // Validate the answer shape here so a malformed body is a 400, not a 503.
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput))
    throw new VisualLabValidationError('INVALID_ANSWER', 'Choose one of the offered options');
  const keys = Object.keys(rawInput as Record<string, unknown>);
  const selected = (rawInput as Record<string, unknown>).selectedOptionId;
  if (keys.length !== 1 || typeof selected !== 'string')
    throw new VisualLabValidationError('INVALID_ANSWER', 'Choose one of the offered options');
  if (!stored.check.options.some((option) => option.id === selected))
    throw new VisualLabValidationError('INVALID_ANSWER', 'Choose one of the offered options');
  const result = gradeCheck(stored, rawInput);
  // Deliberately no competency/XP write: mastery must come from the existing
  // server-verified assessment loop, not from opening or completing a lab.
  return { ...result, recordedAsEvidence: false as const, policy: 'visual_lab_practice_only' };
}

export function labCapabilities() {
  return {
    schemaVersion: 1,
    engines: [
      {
        engine: 'weighted_graph',
        label: 'Weighted graph explorer',
        supports: 'Weighted relationships, shortest paths, connectivity',
        configurable: ['edge weights', 'start node', 'destination node'],
        deterministicOutput: 'Dijkstra distances, visited order, shortest path, total cost'
      },
      {
        engine: 'parameter_model',
        label: 'Parameter experiment',
        supports: 'Bounded quantitative relationships with a verified model',
        configurable: ['force', 'mass'],
        models: ['newtons_second_law'],
        deterministicOutput: 'acceleration'
      },
      {
        engine: 'spatial_3d',
        label: '3D explorer',
        supports: 'Bounded 3D motion with deterministic geometry',
        configurable: ['launch speed', 'elevation', 'heading', 'gravity'],
        models: ['projectile_3d'],
        deterministicOutput: 'range, peak height, time of flight, landing point'
      },
      {
        engine: 'function_plot',
        label: 'Function plotter',
        supports: 'Bounded 2D curves defined by coefficients',
        configurable: ['a', 'b', 'c'],
        models: ['quadratic_function'],
        deterministicOutput: 'vertex, real roots, discriminant, y-intercept'
      }
    ],
    note: 'Unsupported concepts are refused rather than approximated.'
  };
}

export interface VisualLabSummary {
  labId: string;
  title: string;
  concept: string;
  engine: VisualLabEngine;
  sourceMode: 'course' | 'topic';
  courseId?: string;
  generationMode: 'AI_PLANNED' | 'DETERMINISTIC_FALLBACK';
  createdAt: string;
}

/** The learner's own labs, newest first. Never returns another owner's labs or answer keys. */
export async function listVisualLabs(actor: string): Promise<VisualLabSummary[]> {
  const labs = await VisualLab.find({ ownerUserId: actor })
    .sort({ createdAt: -1 })
    .limit(60)
    .select('labId title concept engine sourceMode courseId generationMode createdAt');
  return labs.map((lab): VisualLabSummary => ({
    labId: lab.labId,
    title: lab.title,
    concept: lab.concept,
    engine: lab.engine as VisualLabEngine,
    sourceMode: lab.sourceMode as 'course' | 'topic',
    courseId: lab.courseId ?? undefined,
    generationMode: lab.generationMode as 'AI_PLANNED' | 'DETERMINISTIC_FALLBACK',
    createdAt: new Date(lab.createdAt).toISOString()
  }));
}

export interface DiscoveredConcept {
  sectionId: string;
  concept: string;
  engine: VisualLabEngine;
  excerpt: string;
  matches: number;
}

/**
 * Scan the pinned, verified course revision for sections the registered engines
 * can honestly represent. Keyword evidence only: it never invents a concept the
 * course text does not mention, and it says nothing about sections it skips.
 */
export async function discoverVisualConcepts(
  actor: string,
  rawCourseId: unknown,
  rawRevisionId?: unknown
) {
  if (typeof rawCourseId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawCourseId))
    throw new VisualLabValidationError('INVALID_INPUT', 'A valid course is required');
  const courseId = rawCourseId;
  if (
    rawRevisionId !== undefined &&
    (typeof rawRevisionId !== 'string' || !rawRevisionId || rawRevisionId.length > 64)
  )
    throw new VisualLabValidationError('INVALID_INPUT', 'A valid revision is required');
  const revisionId = rawRevisionId as string | undefined;
  if (!(await canReadCourse(actor, courseId)))
    throw new PublicationForbiddenError('Access to course materials denied');
  const resolution = await resolveCourseSource(actor, courseId, revisionId);
  if (resolution.access.decision !== 'allowed') {
    if (resolution.access.code === 'UNPUBLISHED') throw new UnpublishedCourseError();
    throw new PublicationForbiddenError('Access to course materials denied');
  }
  const published = await getPublishedCourseContext(actor, courseId, revisionId);
  const revision = await CourseRevision.findOne({
    courseId,
    revisionTag: published.revisionId
  });
  if (!revision) throw new VisualLabUnavailableError('Exact revision is unavailable');
  const artifact = await verifyRevisionArtifact(revision);
  const authorized = new Set(published.authorizedDocumentIds);

  const sections = new Map<string, string[]>();
  for (const passage of artifact.passages) {
    if (!authorized.has(passage.documentId)) continue;
    const list = sections.get(passage.sectionId) || [];
    list.push(passage.text);
    sections.set(passage.sectionId, list);
  }

  const concepts: DiscoveredConcept[] = [];
  for (const [sectionId, parts] of sections) {
    const body = parts.join(' ').replace(/\s+/g, ' ').trim();
    const scores = scoreEngines(body);
    const ranked = (Object.entries(scores) as Array<[VisualLabEngine, number]>).sort(
      (a, b) => b[1] - a[1]
    );
    const [engine, matches] = ranked[0];
    // Two distinct terms: one stray word like "force" is not evidence of a physics section.
    if (matches < 2) continue;
    const firstSentence = body.split(/(?<=[.!?])\s/)[0] || body;
    concepts.push({
      sectionId,
      concept: firstSentence.slice(0, 120),
      engine,
      excerpt: body.slice(0, 220),
      matches
    });
  }
  concepts.sort((a, b) => b.matches - a.matches || a.sectionId.localeCompare(b.sectionId));
  return {
    courseId,
    revisionId: published.revisionId,
    sectionsScanned: sections.size,
    concepts: concepts.slice(0, 8)
  };
}
