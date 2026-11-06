jest.mock('../services/presentationReader', () => ({
  getPublishedPresentation: jest.fn(),
}));
jest.mock('../models/StructuredAsset', () => ({
  StructuredAsset: { find: jest.fn() },
}));

import type { PublishedPresentationV1 } from '../../../../shared/ednova/presentationDocument';
import { PRESENTATION_SCHEMA_VERSION } from '../../../../shared/ednova/presentationDocument';
import { COMPONENT_REGISTRY_VERSION } from '../../../../shared/ednova/componentRegistry';
import { STRUCTURED_ASSET_SCHEMA_VERSION } from '../../../../shared/ednova/structuredAsset';
import { getPublishedPresentation } from '../services/presentationReader';
import { StructuredAsset } from '../models/StructuredAsset';
import {
  EXPERIENCE_PLAN_DISCLOSURE,
  ExperiencePlanningDisabledError,
  planLessonExperience,
  verifyAssetBindings,
  projectExperiencePlan,
} from '../services/experiencePlanning';
import { validateExperiencePlan } from '../../../../shared/ednova/experiencePlanValidator';
import { experienceContextFingerprint } from '../../../../shared/ednova/experiencePlan';
import { planMockExperience } from '../../../../shared/ednova/mockExperiencePlanner';
import {
  parseStructuredAsset,
  type StructuredAssetV1,
} from '../../../../shared/ednova/structuredAsset';

const courseId = '0123456789abcdef01234567';
const revisionId = 'rev_m41_service';
const contentHash = 'sha256:' + 'c'.repeat(64);

const load = getPublishedPresentation as jest.MockedFunction<typeof getPublishedPresentation>;
const find = StructuredAsset.find as jest.Mock;

function presentation(): PublishedPresentationV1 {
  const block = (
    id: string,
    type: 'heading' | 'paragraph' | 'math',
    extra: Record<string, unknown> = {},
  ) =>
    ({
      id,
      render: type === 'math' && !extra.review ? 'source_faithful' : 'primary',
      reason: type === 'math' && !extra.review ? 'unreviewed_formula' : 'extracted_content',
      block:
        type === 'heading'
          ? { type, id, level: 2, text: 'A heading' }
          : type === 'math'
            ? {
                type,
                id,
                expression: 'x = 1',
                notation: 'latex',
                evidence: ['chunk-1'],
                // SourceMathFallback requires a source region; the real
                // projection always carries one for a math block.
                sourceMeta: {
                  regionId: `region_${id}`,
                  page: 2,
                  bbox: [0, 0, 10, 10],
                  extractionMethod: 'text',
                  confidence: 0.9,
                  reviewRequired: false,
                  issues: [],
                },
                ...extra,
              }
            : { type, id, text: 'Source prose.', evidence: ['chunk-1'] },
    }) as never;

  return {
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    courseId,
    revisionId,
    contentHash,
    canonicalContentHash: 'sha256:' + 'd'.repeat(64),
    title: 'Course',
    summary: 'Summary',
    provenance: {
      policy: 'deterministic_source_faithful',
      canonicalSchemaVersion: '1.0.0',
      readerSchemaVersion: '2.0.0',
      contentHashVerified: true,
    },
    verification: {
      status: 'partially_reviewed',
      math: { total: 2, reviewed: 1, sourceFallback: 1 },
      disclosure: 'disclosure',
    },
    objectives: [],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter',
        summary: '',
        lessons: [
          {
            id: 'lesson-1',
            title: 'Lesson',
            summary: '',
            blocks: [
              block('h1', 'heading'),
              block('p1', 'paragraph'),
              block('m-reviewed', 'math', {
                review: {
                  state: 'accepted',
                  originalExpression: 'x = 1',
                  modelExpression: 'x = 1',
                  reviewer: 'teacher',
                },
              }),
              block('m-unreviewed', 'math'),
              {
                id: 'code1',
                render: 'primary',
                reason: 'extracted_content',
                block: {
                  type: 'code',
                  id: 'code1',
                  language: 'python',
                  code: 'a = 1',
                  evidence: ['chunk-1'],
                },
              } as never,
            ],
          },
        ],
      },
    ],
    sources: [
      {
        documentId: 'doc-1',
        contentHash: 'sha256:' + 'e'.repeat(64),
        pageNumber: null,
        href: `/api/v1/study/courses/${courseId}/revisions/${revisionId}/sources/doc-1`,
      },
    ],
    fallback: {
      readerHref: `/courses/${courseId}/learn?revisionId=${revisionId}`,
      schemaVersion: '2.0.0',
      deterministic: true,
    },
    warnings: [],
  };
}

function storedAsset(overrides: Record<string, unknown> = {}) {
  const parsed = parseStructuredAsset({
    schemaVersion: STRUCTURED_ASSET_SCHEMA_VERSION,
    assetId: 'asset_walkthrough_1',
    courseId,
    revisionId,
    blockId: 'code1',
    lessonId: 'lesson-1',
    registryVersion: COMPONENT_REGISTRY_VERSION,
    component: 'CodeWalkthrough',
    payload: {
      component: 'CodeWalkthrough',
      language: 'python',
      code: 'a = 1\nb = 2',
      annotations: [
        { line: 0, explanation: 'First.' },
        { line: 1, explanation: 'Second.' },
      ],
    },
    provenance: 'instructor_authored',
    review: {
      status: 'instructor_reviewed',
      reviewedBy: 'teacher',
      reviewedAt: '2026-11-01T10:00:00Z',
    },
    audience: 'course',
    fallback: 'CodeViewer',
    disclosure: 'Instructor-authored walkthrough.',
    ...overrides,
  });
  // Shape the row the way the Mongoose model stores it.
  return {
    schemaVersion: parsed.schemaVersion,
    assetId: parsed.assetId,
    courseId: parsed.courseId,
    revisionId: parsed.revisionId,
    ...(parsed.blockId !== undefined ? { blockId: parsed.blockId } : {}),
    lessonId: parsed.lessonId,
    registryVersion: parsed.registryVersion,
    component: parsed.component,
    payload: parsed.payload,
    provenance: parsed.provenance,
    reviewStatus: parsed.review.status,
    ...(parsed.review.reviewedBy !== undefined ? { reviewedBy: parsed.review.reviewedBy } : {}),
    ...(parsed.review.reviewedAt !== undefined ? { reviewedAt: parsed.review.reviewedAt } : {}),
    ...(parsed.sourceReferences !== undefined
      ? { sourceReferences: parsed.sourceReferences }
      : {}),
    audience: parsed.audience,
    fallback: parsed.fallback,
    disclosure: parsed.disclosure,
  };
}

function mockRows(rows: unknown[]) {
  find.mockReturnValue({
    sort: () => ({ limit: () => ({ lean: async () => rows }) }),
  });
}

const originalFlag = process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING = 'true';
  load.mockResolvedValue(presentation());
  mockRows([]);
});

afterAll(() => {
  if (originalFlag === undefined) delete process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING;
  else process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING = originalFlag;
});

describe('experience planning workflow', () => {
  it('is disabled unless the QA flag is explicitly set', async () => {
    delete process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING;
    await expect(
      planLessonExperience('student', courseId, 'lesson-1', 'valid_mathematics'),
    ).rejects.toBeInstanceOf(ExperiencePlanningDisabledError);
    // A disabled planner must not even load the presentation.
    expect(load).not.toHaveBeenCalled();
  });

  it('plans a valid mathematics lesson through the real validator', async () => {
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'valid_mathematics');
    expect(outcome).toMatchObject({ status: 'planned' });
    if (outcome.status !== 'planned') return;
    expect(outcome.plan.canonical.map((entry) => entry.blockId)).toEqual([
      'h1',
      'p1',
      'm-reviewed',
      'm-unreviewed',
      'code1',
    ]);
    expect(outcome.plan.planner.implementation).toBe('mock_experience_planner');
    expect(outcome.plan.disclosure).toBe(EXPERIENCE_PLAN_DISCLOSURE);
    expect(outcome.plan.digest).toMatch(/^fnv1a64:/);
  });

  it('keeps the unreviewed formula on its source-faithful component', async () => {
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'valid_mathematics');
    if (outcome.status !== 'planned') throw new Error('expected a plan');
    const unreviewed = outcome.plan.canonical.find((entry) => entry.blockId === 'm-unreviewed');
    expect(unreviewed?.component).toBe('SourceMathFallback');
  });

  it('returns a typed rejection, not a throw, for an invalid proposal', async () => {
    const outcome = await planLessonExperience(
      'student',
      courseId,
      'lesson-1',
      'attack_missing_block',
    );
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') {
      expect(outcome.code).toBe('PLAN_COVERAGE_BLOCK_MISSING');
      expect(outcome.stage).toBe('coverage');
    }
  });

  it('reports a provider timeout as unavailable rather than rejected', async () => {
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'provider_timeout');
    expect(outcome).toEqual({ status: 'planner_unavailable', failure: 'timeout' });
  });

  it('refuses a lesson that is not in the revision', async () => {
    await expect(
      planLessonExperience('student', courseId, 'lesson-missing', 'valid_mathematics'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an unknown scenario before loading anything', async () => {
    await expect(
      planLessonExperience('student', courseId, 'lesson-1', 'not_a_scenario' as never),
    ).rejects.toMatchObject({ status: 400 });
    expect(load).not.toHaveBeenCalled();
  });

  it('selects a trusted instructor asset as a supplement', async () => {
    mockRows([storedAsset()]);
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'valid_programming');
    if (outcome.status !== 'planned')
      throw new Error(`expected a plan, got ${outcome.status} ${'code' in outcome ? outcome.code : ''}`);
    expect(outcome.plan.supplemental).toHaveLength(1);
    expect(outcome.plan.supplemental[0].assetId).toBe('asset_walkthrough_1');
  });

  it('never exposes an unreviewed generated asset to the learner', async () => {
    mockRows([
      storedAsset({
        assetId: 'asset_generated_1',
        provenance: 'generated_proposal',
        review: { status: 'unreviewed' },
      }),
    ]);
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'valid_programming');
    if (outcome.status !== 'planned') throw new Error('expected a plan');
    expect(outcome.plan.supplemental).toHaveLength(0);
  });

  it('skips a malformed stored asset instead of failing the lesson', async () => {
    mockRows([{ assetId: 'broken', schemaVersion: '0.0.0' }, storedAsset()]);
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'valid_programming');
    if (outcome.status !== 'planned') throw new Error('expected a plan');
    expect(outcome.plan.supplemental.map((entry) => entry.assetId)).toEqual([
      'asset_walkthrough_1',
    ]);
  });

  it('fails closed when a foreign-revision asset reaches the planner', async () => {
    mockRows([storedAsset({ revisionId: 'rev_other' })]);
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'valid_programming');
    // Production filters the row out in the query; this proves the second line
    // of defence. A supplement whose review cannot be verified is not silently
    // dropped — the plan is rejected and the deterministic reader takes over.
    expect(outcome).toMatchObject({
      status: 'rejected',
      code: 'PLAN_ASSET_REVIEW_UNVERIFIED',
    });
  });
});

describe('asset review verification', () => {
  const binding = {
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    authorizedDocumentIds: new Set(['doc-1']),
  };

  it('verifies a review claim that is internally consistent and bound', () => {
    const asset = parseStructuredAsset({
      schemaVersion: STRUCTURED_ASSET_SCHEMA_VERSION,
      assetId: 'a1',
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      registryVersion: COMPONENT_REGISTRY_VERSION,
      component: 'CodeWalkthrough',
      payload: {
        component: 'CodeWalkthrough',
        language: 'python',
        code: 'a = 1',
        annotations: [{ line: 0, explanation: 'Only line.' }],
      },
      provenance: 'instructor_authored',
      review: {
        status: 'instructor_reviewed',
        reviewedBy: 'teacher',
        reviewedAt: '2026-11-01T10:00:00Z',
      },
      audience: 'course',
      fallback: 'CodeViewer',
      disclosure: 'Instructor-authored.',
    });
    const [verified] = verifyAssetBindings([asset], binding);
    expect(verified.reviewVerified).toBe(true);
  });

  it('does not verify a review claim on an asset bound elsewhere', () => {
    const asset = {
      assetId: 'a1',
      courseId,
      revisionId: 'rev_other',
      lessonId: 'lesson-1',
      component: 'CodeWalkthrough',
      provenance: 'instructor_authored',
      review: {
        status: 'instructor_reviewed',
        reviewedBy: 'teacher',
        reviewedAt: '2026-11-01T10:00:00Z',
      },
    } as unknown as StructuredAssetV1;
    const [verified] = verifyAssetBindings([asset], binding);
    expect(verified.reviewVerified).toBe(false);
  });

  it('does not verify a source-derived asset whose references are foreign', () => {
    const asset = {
      assetId: 'a1',
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      component: 'CodeWalkthrough',
      provenance: 'source_derived',
      review: { status: 'not_applicable' },
      sourceReferences: [
        { documentId: 'doc-from-another-course', pageNumber: null, lineStart: 1, lineEnd: 2 },
      ],
    } as unknown as StructuredAssetV1;
    const [verified] = verifyAssetBindings([asset], binding);
    expect(verified.sourceVerified).toBe(false);
  });

  it('marks a generated proposal as unverified review', () => {
    const asset = {
      assetId: 'a1',
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      component: 'NetworkTopology',
      provenance: 'generated_proposal',
      review: { status: 'unreviewed' },
    } as unknown as StructuredAssetV1;
    const [verified] = verifyAssetBindings([asset], binding);
    expect(verified.reviewVerified).toBe(false);
  });
});

describe('plan projection', () => {
  it('only projects a branded validated plan', () => {
    expect(() => projectExperiencePlan({} as never)).toThrow();
  });

  it('carries no source text or learner identity', async () => {
    const outcome = await planLessonExperience('student', courseId, 'lesson-1', 'valid_mathematics');
    if (outcome.status !== 'planned') throw new Error('expected a plan');
    const serialized = JSON.stringify(outcome.plan);
    expect(serialized).not.toContain('Source prose.');
    expect(serialized).not.toContain('student');
    expect(serialized).not.toContain('token');
    expect(Object.keys(outcome.plan)).not.toContain('actor');
  });

  it('is stable across identical requests', async () => {
    const a = await planLessonExperience('student', courseId, 'lesson-1', 'valid_mathematics');
    const b = await planLessonExperience('student', courseId, 'lesson-1', 'valid_mathematics');
    if (a.status !== 'planned' || b.status !== 'planned') throw new Error('expected plans');
    expect(a.plan.digest).toBe(b.plan.digest);
    expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
  });
});

// The validator and mock are exercised directly in experience-plan.test.ts;
// these references keep the imports honest for the service-level assertions.
void validateExperiencePlan;
void experienceContextFingerprint;
void planMockExperience;
