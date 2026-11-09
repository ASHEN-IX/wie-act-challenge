/**
 * BLOOM-06 — LearningObjective persistence service tests.
 */

// Prevent process.exit() from killing tests (same as study.test.js)
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_ednova';
process.env.NODE_ENV = 'test';
const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code): never => {
  throw new Error(`Unexpected process.exit(${code})`);
});
afterAll(() => exitSpy.mockRestore());

// ── Mock LearningObjective model ──────────────────────────────────────────────
const mockFindOneAndUpdate = jest.fn().mockResolvedValue({ id: 'obj-row' });
const mockUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
const mockDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
const mockFind = jest.fn();

jest.mock('../models/index', () => ({
  LearningObjective: {
    find: mockFind,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
    findOneAndUpdate: mockFindOneAndUpdate
  }
}));

import {
  sha256,
  extractObjectives,
  syncObjectivesForDocument,
  deleteObjectivesForDocument
} from '../services/objectives';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeTopics(
  objs: Array<{
    objectiveId?: string;
    topicId?: string;
    text: string;
    knowledgeType?: string;
    bloomLevel?: string;
    verb?: string;
    classification?: unknown;
  }>
) {
  return [
    {
      id: 'topic_1',
      title: 'Linear Algebra',
      subtopics: objs.map((o, i) => ({
        id: `sub-${i}`,
        title: o.text.slice(0, 20),
        summary: '',
        learning_objectives: [o]
      }))
    }
  ];
}

const SAMPLE_OBJECTIVE = {
  objectiveId: 'obj-1',
  topicId: 'topic_1',
  knowledgeType: 'conceptual',
  bloomLevel: 'understand',
  verb: 'Explain',
  text: 'Explain the role of matrix multiplication in linear transformations.'
};

// ── Tests ────────────────────────────────────────────────────────────────────
describe('sha256()', () => {
  test('returns a 64-char hex string', () => {
    const h = sha256('hello');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic', () => {
    expect(sha256('foo')).toBe(sha256('foo'));
  });

  test('different input → different hash', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('extractObjectives()', () => {
  test('returns empty array for empty topics', () => {
    expect(extractObjectives('doc-1', [])).toEqual([]);
    expect(Reflect.apply(extractObjectives, undefined, ['doc-1', null])).toEqual([]);
  });

  test('flattens objectives from nested topics/subtopics', () => {
    const topics = makeTopics([SAMPLE_OBJECTIVE]);
    const result = extractObjectives('doc-1', topics);
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('doc-1');
    expect(result[0].textHash).toBe(sha256(SAMPLE_OBJECTIVE.text));
  });

  test('skips subtopics without learning_objectives', () => {
    const topics = [
      {
        id: 'topic_1',
        title: 'T',
        subtopics: [{ id: 'sub-1', title: 'S', summary: '' }]
      }
    ];
    expect(extractObjectives('doc-1', topics)).toEqual([]);
  });
});

describe('syncObjectivesForDocument()', () => {
  beforeEach(() => jest.clearAllMocks());

  test('inserts new objectives at version 1 when no prior active objectives', async () => {
    mockFind.mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    });
    mockFindOneAndUpdate.mockResolvedValue({ id: 'obj-row' });

    const stats = await syncObjectivesForDocument({
      userId: 'u1',
      documentId: 'doc-1',
      topics: makeTopics([SAMPLE_OBJECTIVE])
    });

    expect(stats.inserted).toBe(1);
    expect(stats.updated).toBe(0);
    expect(stats.superseded).toBe(0);
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = mockFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({
      documentId: 'doc-1',
      topicId: 'topic_1',
      textHash: sha256(SAMPLE_OBJECTIVE.text)
    });
    expect(update.$setOnInsert.version).toBe(1);
  });

  test('version bumps existing objective on re-ingestion (same text)', async () => {
    const priorActive = [{ topicId: 'topic_1', textHash: sha256(SAMPLE_OBJECTIVE.text) }];
    mockFind.mockReturnValue({
      select: jest.fn().mockResolvedValue(priorActive)
    });
    mockFindOneAndUpdate.mockResolvedValue({ id: 'obj-row' });

    const stats = await syncObjectivesForDocument({
      userId: 'u1',
      documentId: 'doc-1',
      topics: makeTopics([SAMPLE_OBJECTIVE])
    });

    expect(stats.inserted).toBe(0);
    expect(stats.updated).toBe(1);
    expect(stats.superseded).toBe(0);
    const [, update, options] = mockFindOneAndUpdate.mock.calls[0];
    expect(update.$inc.version).toBe(1);
    expect(update.$set.isActive).toBe(true);
    expect(options.upsert).toBeUndefined();
  });

  test('supersedes objectives not in the incoming set', async () => {
    const priorActive = [
      { topicId: 'topic_1', textHash: 'old-hash' },
      { topicId: 'topic_1', textHash: sha256(SAMPLE_OBJECTIVE.text) }
    ];
    mockFind.mockReturnValue({
      select: jest.fn().mockResolvedValue(priorActive)
    });
    mockUpdateMany.mockResolvedValue({ modifiedCount: 1 });
    mockFindOneAndUpdate.mockResolvedValue({ id: 'obj-row' });

    const stats = await syncObjectivesForDocument({
      userId: 'u1',
      documentId: 'doc-1',
      topics: makeTopics([SAMPLE_OBJECTIVE])
    });

    expect(stats.superseded).toBe(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const updateFilter = mockUpdateMany.mock.calls[0][0];
    expect(updateFilter.documentId).toBe('doc-1');
  });

  test('returns zero stats when no incoming objectives', async () => {
    const stats = await syncObjectivesForDocument({
      userId: 'u1',
      documentId: 'doc-1',
      topics: []
    });
    expect(stats).toEqual({ inserted: 0, updated: 0, superseded: 0 });
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('deleteObjectivesForDocument()', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes all objectives for a document', async () => {
    mockDeleteMany.mockResolvedValue({ deletedCount: 3 });
    const count = await deleteObjectivesForDocument('doc-1');
    expect(count).toBe(3);
    expect(mockDeleteMany).toHaveBeenCalledWith({ documentId: 'doc-1' });
  });

  test('returns 0 when nothing to delete', async () => {
    mockDeleteMany.mockResolvedValue({ deletedCount: 0 });
    const count = await deleteObjectivesForDocument('doc-999');
    expect(count).toBe(0);
  });
});
