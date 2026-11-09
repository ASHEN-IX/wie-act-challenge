/**
 * Visual Learning Lab orchestration: authorization, validation, dedupe, refusal.
 * Models, course authority, source artifacts and the AI service are mocked, so
 * this suite proves the Node boundary rather than provider behaviour.
 */
jest.mock('../models/index', () => ({
  VisualLab: { findOne: jest.fn(), create: jest.fn() },
  CourseRevision: { findOne: jest.fn() }
}));
jest.mock('../services/resourceAccess', () => ({ canReadCourse: jest.fn() }));
jest.mock('../services/coursePublication', () => {
  class PublicationForbiddenError extends Error {
    readonly code = 'FORBIDDEN';
  }
  class UnpublishedCourseError extends Error {
    readonly code = 'UNPUBLISHED';
  }
  return {
    getPublishedCourseContext: jest.fn(),
    resolveCourseSource: jest.fn(),
    PublicationForbiddenError,
    UnpublishedCourseError
  };
});
jest.mock('../services/revisionSources', () => {
  class SourceIntegrityError extends Error {
    readonly code = 'SOURCE_INTEGRITY_UNAVAILABLE';
  }
  return { verifyRevisionArtifact: jest.fn(), SourceIntegrityError };
});
jest.mock('../../../../shared/aiClient', () => ({
  __esModule: true,
  default: { post: jest.fn() }
}));

import aiClient from '../../../../shared/aiClient';
import { VisualLab, CourseRevision } from '../models';
import { canReadCourse } from '../services/resourceAccess';
import {
  getPublishedCourseContext,
  resolveCourseSource,
  PublicationForbiddenError
} from '../services/coursePublication';
import { verifyRevisionArtifact } from '../services/revisionSources';
import {
  authoritativeState,
  classifyLocally,
  guideVisualLab,
  parseGuideInput,
  parsePlanInput,
  planVisualLab,
  VisualLabValidationError
} from '../services/visualLabPlanning';
import { fallbackCandidate } from '../../../../shared/visualLab/definition';

const COURSE = '64f1a2b3c4d5e6f7a8b9c0d1';
const ACTOR = 'actor-1';
const aiPost = aiClient.post as jest.Mock;

function graphCandidate() {
  return {
    ...fallbackCandidate('weighted_graph'),
    concept: 'Shortest path routing costs'
  };
}

const leanFind = (value: unknown) => (VisualLab.findOne as jest.Mock).mockResolvedValue(value);

function storedLab(overrides: Record<string, unknown> = {}) {
  const candidate = graphCandidate();
  return {
    labId: 'lab_abcdef0123456789abcd',
    schemaVersion: 1,
    ownerUserId: ACTOR,
    scope: 'private',
    sourceMode: 'topic',
    courseId: undefined,
    revisionId: undefined,
    topicId: undefined,
    passageIds: [],
    topic: 'Dijkstra',
    engine: 'weighted_graph',
    title: candidate.title,
    concept: candidate.concept,
    learningObjective: candidate.learningObjective,
    definition: { engine: 'weighted_graph', scenario: candidate.scenario },
    guidance: {
      ...candidate.guidance,
      observationPrompt: 'Observe'
    },
    check: {
      prompt: 'Which route?',
      options: [
        { id: 'correct', label: 'Right' },
        { id: 'alt0', label: 'Wrong' }
      ],
      correctOptionId: 'correct',
      explanation: 'Because the weights add up.'
    },
    generationMode: 'AI_PLANNED',
    generationKey: 'key',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  leanFind(null);
  // `create()` returns the row directly now (no `toObject()`).
  (VisualLab.create as jest.Mock).mockImplementation(async (doc: Record<string, unknown>) => ({
    ...doc,
    _id: 'lab-row',
    createdAt: new Date('2026-11-01T10:00:00.000Z')
  }));
  aiPost.mockResolvedValue({
    data: {
      status: 'planned',
      reason: 'Weighted graph relationships',
      candidate: graphCandidate(),
      executionMode: 'MOCK_TEST'
    }
  });
});

describe('parsePlanInput', () => {
  it('accepts a course request and a topic request', () => {
    expect(parsePlanInput({ mode: 'topic', concept: 'Dijkstra' })).toEqual({
      mode: 'topic',
      concept: 'Dijkstra',
      language: 'en'
    });
    expect(
      parsePlanInput({ mode: 'course', courseId: COURSE, concept: 'Routing', revisionId: 'rev_1' })
    ).toMatchObject({ mode: 'course', courseId: COURSE, revisionId: 'rev_1' });
  });
  it('rejects unknown fields, bad modes, empty concepts and forged course claims', () => {
    const bad: unknown[] = [
      {},
      { mode: 'room', concept: 'x' },
      { mode: 'topic', concept: '   ' },
      { mode: 'topic', concept: 'x', courseId: COURSE },
      { mode: 'topic', concept: 'x', revisionId: 'rev_1' },
      { mode: 'course', concept: 'x' },
      { mode: 'course', courseId: 'not-an-id', concept: 'x' },
      { mode: 'topic', concept: 'x', language: 'zh' },
      { mode: 'topic', concept: 'x', unexpected: true },
      { mode: 'topic', concept: 'x'.repeat(501) }
    ];
    for (const value of bad) expect(() => parsePlanInput(value)).toThrow(VisualLabValidationError);
  });
});

describe('planVisualLab', () => {
  it('rejects a course the caller cannot read before any model call', async () => {
    (canReadCourse as jest.Mock).mockResolvedValue(false);
    await expect(
      planVisualLab(ACTOR, { mode: 'course', courseId: COURSE, concept: 'Routing' })
    ).rejects.toBeInstanceOf(PublicationForbiddenError);
    expect(aiPost).not.toHaveBeenCalled();
    expect(VisualLab.create).not.toHaveBeenCalled();
  });

  it('sends only authorized verified passages and pins the published revision', async () => {
    (canReadCourse as jest.Mock).mockResolvedValue(true);
    (resolveCourseSource as jest.Mock).mockResolvedValue({
      access: { decision: 'allowed', code: 'ALLOWED' }
    });
    (getPublishedCourseContext as jest.Mock).mockResolvedValue({
      revisionId: 'rev_published',
      authorizedDocumentIds: ['doc_1']
    });
    (CourseRevision.findOne as jest.Mock).mockReturnValue({
      lean: async () => ({ courseId: COURSE, revisionTag: 'rev_published' })
    });
    (verifyRevisionArtifact as jest.Mock).mockResolvedValue({
      passages: [
        {
          documentId: 'doc_1',
          chunkId: 'chk_' + 'a'.repeat(64),
          pageNumber: 3,
          sectionId: 'sec_1',
          text: 'Dijkstra finds the shortest path by settling the cheapest frontier node.'
        },
        {
          documentId: 'doc_foreign',
          chunkId: 'chk_' + 'b'.repeat(64),
          pageNumber: 1,
          sectionId: 'sec_2',
          text: 'shortest path secret'
        }
      ]
    });

    const result = await planVisualLab(ACTOR, {
      mode: 'course',
      courseId: COURSE,
      concept: 'shortest path',
      revisionId: 'rev_published'
    });
    expect(result.kind).toBe('lab');
    const body = aiPost.mock.calls[0][1] as Record<string, unknown>;
    expect(aiPost.mock.calls[0][0]).toBe('/api/ai/visual-lab/plan');
    expect(body.courseId).toBe(COURSE);
    expect(body.revisionId).toBe('rev_published');
    const passages = body.passages as Array<{ documentId: string }>;
    expect(passages.map((p) => p.documentId)).toEqual(['doc_1']);
    if (result.kind === 'lab') {
      expect(result.lab.sourceContext.revisionId).toBe('rev_published');
      expect(JSON.stringify(result.lab)).not.toContain('correctOptionId');
    }
  });

  it('returns a stored lab instead of calling the model twice for the same request', async () => {
    leanFind(storedLab());
    const result = await planVisualLab(ACTOR, { mode: 'topic', concept: 'Dijkstra' });
    expect(result.kind).toBe('lab');
    expect(aiPost).not.toHaveBeenCalled();
    expect(VisualLab.create).not.toHaveBeenCalled();
  });

  it('refuses an unsupported concept instead of inventing a simulation', async () => {
    aiPost.mockResolvedValue({
      data: {
        status: 'unsupported',
        reason: 'No supported engine represents molecular orbitals accurately.',
        executionMode: 'MOCK_TEST'
      }
    });
    const result = await planVisualLab(ACTOR, {
      mode: 'topic',
      concept: 'molecular orbital hybridisation'
    });
    expect(result).toEqual({
      kind: 'unsupported',
      message: 'No supported engine represents molecular orbitals accurately.'
    });
    expect(VisualLab.create).not.toHaveBeenCalled();
  });

  it('rejects a proposal the domain validator refuses, then falls back honestly', async () => {
    const broken = graphCandidate() as unknown as Record<string, unknown>;
    (broken.scenario as Record<string, unknown>).edges = [];
    aiPost.mockResolvedValue({
      data: { status: 'planned', reason: 'x', candidate: broken, executionMode: 'MOCK_TEST' }
    });
    const result = await planVisualLab(ACTOR, { mode: 'topic', concept: 'Dijkstra algorithm' });
    expect(result.kind).toBe('lab');
    if (result.kind === 'lab') {
      expect(result.lab.generationMode).toBe('DETERMINISTIC_FALLBACK');
      expect(result.lab.engine).toBe('weighted_graph');
    }
  });

  it('keeps working when the AI service is unavailable', async () => {
    aiPost.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await planVisualLab(ACTOR, { mode: 'topic', concept: "Newton's second law" });
    expect(result.kind).toBe('lab');
    if (result.kind === 'lab') {
      expect(result.lab.generationMode).toBe('DETERMINISTIC_FALLBACK');
      expect(result.lab.engine).toBe('parameter_model');
    }
  });

  it('does not fall back for a concept outside both engines', async () => {
    aiPost.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await planVisualLab(ACTOR, { mode: 'topic', concept: 'Shakespearean sonnets' });
    expect(result.kind).toBe('unsupported');
  });
});

describe('locally-derived fallback classification', () => {
  it('classifies only the registered domains', () => {
    expect(classifyLocally('Dijkstra shortest path')).toBe('weighted_graph');
    expect(classifyLocally('force and mass')).toBe('parameter_model');
    expect(classifyLocally('projectile launch angle')).toBe('spatial_3d');
    expect(classifyLocally('3D printing')).toBeNull();
    expect(classifyLocally('the French Revolution')).toBeNull();
  });
});

describe('authoritative state', () => {
  it('recomputes graph results from server-validated weights', () => {
    const candidate = graphCandidate();
    const definition = {
      engine: 'weighted_graph' as const,
      scenario: candidate.scenario as never
    };
    const edgeCount = (candidate.scenario as { edges: unknown[] }).edges.length;
    const state = authoritativeState(definition, Array(edgeCount).fill(1));
    expect(state.totalCost).toBe(2);
    expect((state.edges as Array<{ weight: number }>).every((e) => e.weight === 1)).toBe(true);
  });
  it('rejects invalid weight overrides', () => {
    const definition = {
      engine: 'weighted_graph' as const,
      scenario: graphCandidate().scenario as never
    };
    const edgeCount = (graphCandidate().scenario as { edges: unknown[] }).edges.length;
    for (const bad of [
      Array(edgeCount).fill(0),
      Array(edgeCount - 1).fill(1),
      'edges',
      Array(edgeCount).fill(-1)
    ])
      expect(() => authoritativeState(definition, bad)).toThrow(VisualLabValidationError);
  });
  it('computes the parameter output on the server', () => {
    const state = authoritativeState(
      {
        engine: 'parameter_model',
        scenario: { modelId: 'newtons_second_law', values: { force: 30, mass: 4 } }
      },
      { force: 100 }
    );
    expect(state.acceleration).toBe(25);
  });
});

describe('guide', () => {
  it('rejects unknown guidance fields', () => {
    expect(() => parseGuideInput({ question: 'Why?', extra: 1 })).toThrow(VisualLabValidationError);
    expect(() => parseGuideInput({ question: 'Why?', guidanceMode: 'grade' })).toThrow(
      VisualLabValidationError
    );
    expect(parseGuideInput({ question: ' Why did it change? ' })).toEqual({
      question: 'Why did it change?',
      guidanceMode: 'explain',
      parameters: undefined
    });
  });

  it('grounds the model call in the server-computed state', async () => {
    leanFind(storedLab());
    aiPost.mockResolvedValue({
      data: { status: 'guided', text: 'The heavier edge loses.', executionMode: 'MOCK_TEST' }
    });
    const result = await guideVisualLab(ACTOR, 'lab_abcdef0123456789abcd', {
      question: 'Why did the path change?'
    });
    expect(result.status).toBe('guided');
    const body = aiPost.mock.calls[0][1] as { state: Record<string, unknown> };
    expect(body.state.engine).toBe('weighted_graph');
    expect(body.state.totalCost).toBe(6);
  });

  it('returns deterministic guidance when the model is unavailable', async () => {
    leanFind(storedLab());
    aiPost.mockRejectedValue(new Error('down'));
    const result = await guideVisualLab(ACTOR, 'lab_abcdef0123456789abcd', {
      question: 'Why did the path change?'
    });
    expect(result.status).toBe('fallback');
    expect(result.text.length).toBeGreaterThan(40);
  });

  it('hides labs owned by another user', async () => {
    await expect(
      guideVisualLab('someone-else', 'lab_abcdef0123456789abcd', { question: 'Why?' })
    ).rejects.toMatchObject({ code: 'LAB_NOT_FOUND' });
    expect(aiPost).not.toHaveBeenCalled();
  });
});

describe('state-aware deterministic guidance', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { deterministicGuidance } = require('../../../../shared/visualLab/definition');

  it('restates the current graph result from authoritative state', () => {
    const definition = {
      engine: 'weighted_graph' as const,
      scenario: {
        nodes: ['A', 'B', 'C'].map((id) => ({ id, label: id })),
        edges: [
          { source: 'A', target: 'B', weight: 9 },
          { source: 'A', target: 'C', weight: 1 },
          { source: 'C', target: 'B', weight: 2 }
        ],
        source: 'A',
        target: 'B'
      }
    };
    const state = authoritativeState(definition, [9, 1, 2]);
    expect(deterministicGuidance('weighted_graph', 'why', state)).toContain('A → C → B costs 3');
    // A weight override changes the route the guide describes.
    const changed = authoritativeState(definition, [2, 9, 9]);
    expect(deterministicGuidance('weighted_graph', 'why', changed)).toContain('A → B costs 2');
  });

  it('computes 3D state on the server and honours bounded overrides only', () => {
    const definition = {
      engine: 'spatial_3d' as const,
      scenario: {
        sceneId: 'projectile_3d' as const,
        values: { speed: 20, elevation: 45, heading: 0, gravity: 10 }
      }
    };
    const state = authoritativeState(definition, { elevation: 30 });
    expect(state.range).toBeCloseTo((400 * Math.sin(Math.PI / 3)) / 10, 6);
    expect(deterministicGuidance('spatial_3d', 'why', state)).toContain('30°');
    expect(() => authoritativeState(definition, { gravity: 0 })).toThrow();
    expect(() => authoritativeState(definition, { speed: 20, bogus: 1 })).toThrow();
  });
});
