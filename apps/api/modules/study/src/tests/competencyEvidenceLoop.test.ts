/**
 * The verified-practice loop: accepted reviewed evidence must become competency
 * evidence for the learner who produced it.
 *
 * Regression cover for four defects that each independently emptied the learner's
 * progress page: the projection only indexed courses the learner *owned*, the
 * competency key used a level the index never registered, profile rows were never
 * written from reviewed activities at all, and bloom levels were reported in a
 * casing the writer never produced.
 */

/**
 * The converted models return awaitable row lists that still expose `.lean()`.
 */
const leaned = <T>(value: T) => {
  const result = Promise.resolve(value) as Promise<T> & { lean: () => Promise<T> };
  result.lean = () => Promise.resolve(value);
  return result;
};

jest.mock('../models/index', () => ({
  Subject: { find: jest.fn() },
  Course: { find: jest.fn() },
  CourseEnrollment: { find: jest.fn() },
  CourseRevision: { find: jest.fn() },
  CompetencyProfile: { find: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn() }
}));

import { recordAcceptedEvidence } from '../services/competency';
import { getUserCompetencyMap } from '../services/competencyQueries';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  Subject,
  Course,
  CourseEnrollment,
  CourseRevision,
  CompetencyProfile
} = require('../models/index');

const SUBJECT_ID = '507f1f77bcf86cd799439011';
const COURSE_ID = '507f1f77bcf86cd799439012';

const revisionTopics = [
  {
    id: 'top_1nf',
    title: 'First Normal Form (1NF) & Atomicity',
    subtopics: [
      {
        id: 'sub_1nf_def',
        title: 'Atomic domains',
        learning_objectives: [
          { id: 'obj_1nf_def', statement: 'Identify 1NF violations', bloomLevel: 'analyze' }
        ]
      }
    ]
  }
];

beforeEach(() => {
  jest.clearAllMocks();
  CourseEnrollment.find.mockReturnValue({
    distinct: jest.fn().mockResolvedValue([COURSE_ID])
  });
  Course.find.mockReturnValue({
    select: jest.fn().mockImplementation(() =>
      leaned([
        {
          _id: COURSE_ID,
          userId: 'instructor-1',
          subjectId: SUBJECT_ID,
          title: 'CS301',
          topics: []
        }
      ])
    )
  });
  CourseRevision.find.mockReturnValue({
    select: jest
      .fn()
      .mockImplementation(() =>
        leaned([{ courseId: COURSE_ID, revisionTag: 'rev_1', topics: revisionTopics }])
      )
  });
  Subject.find.mockReturnValue({
    select: jest
      .fn()
      .mockImplementation(() => leaned([{ _id: SUBJECT_ID, name: 'Computer Science' }]))
  });
});

describe('accepted evidence becomes competency evidence', () => {
  test('writes a profile row keyed by lowercase bloom level', async () => {
    CompetencyProfile.findOne.mockResolvedValue(null);
    CompetencyProfile.findOneAndUpdate.mockResolvedValue({ _id: 'profile-1' });

    await recordAcceptedEvidence({
      userId: 'learner-1',
      objectiveId: 'obj_1nf_def',
      bloomLevel: 'ANALYZE',
      score: 1,
      masteryAchieved: true,
      evaluatedAt: new Date('2026-10-28T10:00:00.000Z'),
      correlationId: 'evi_abc',
      topicId: 'sub_1nf_def'
    });

    const [filter, update] = CompetencyProfile.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({
      userId: 'learner-1',
      topicId: 'sub_1nf_def',
      knowledgeType: 'procedural',
      bloomLevel: 'analyze'
    });
    expect(update.$set.evidence).toEqual([
      expect.objectContaining({
        objectiveId: 'obj_1nf_def',
        correlationId: 'evi_abc',
        masteryScore: 1
      })
    ]);
  });

  test('replaying the same evidence does not duplicate it', async () => {
    CompetencyProfile.findOne.mockResolvedValue({
      evidence: [{ correlationId: 'evi_abc', masteryScore: 1 }]
    });

    await recordAcceptedEvidence({
      userId: 'learner-1',
      objectiveId: 'obj_1nf_def',
      bloomLevel: 'analyze',
      score: 1,
      masteryAchieved: true,
      evaluatedAt: new Date('2026-10-28T10:00:00.000Z'),
      correlationId: 'evi_abc',
      topicId: 'sub_1nf_def'
    });

    expect(CompetencyProfile.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('the learner sees competency evidence for an enrolled course', () => {
  test('resolves the subject and level the attempt recorded', async () => {
    CompetencyProfile.find.mockResolvedValue([
      {
        topicId: 'sub_1nf_def',
        knowledgeType: 'procedural',
        bloomLevel: 'analyze',
        score: 0.74,
        confidence: 0.64,
        evidence: [{ objectiveId: 'obj_1nf_def' }]
      }
    ]);

    const map = await getUserCompetencyMap('learner-1');

    expect(CourseEnrollment.find).toHaveBeenCalledWith({ userId: 'learner-1', status: 'active' });
    expect(map).toHaveLength(1);
    expect(map[0].subjectName).toBe('Computer Science');
    expect(map[0].topics[0].topicName).toBe('Atomic domains');
    expect(map[0].topics[0].parentTopic).toBe('First Normal Form (1NF) & Atomicity');
    // A single observation is reported as low confidence so the learner is not
    // shown a settled-looking percentage built from one data point.
    expect(map[0].topics[0].levels).toEqual([
      { bloomLevel: 'ANALYSE', score: 0.74, confidence: 0.64, count: 1, needsReview: false }
    ]);
  });

  test('reports British ANALYSE and American ANALYZE as one level', async () => {
    CompetencyProfile.find.mockResolvedValue([
      {
        topicId: 'sub_1nf_def',
        knowledgeType: 'conceptual',
        bloomLevel: 'ANALYSE',
        score: 0.5,
        confidence: 0.4,
        evidence: []
      },
      {
        topicId: 'sub_1nf_def',
        knowledgeType: 'procedural',
        bloomLevel: 'ANALYZE',
        score: 0.7,
        confidence: 0.6,
        evidence: []
      }
    ]);

    const map = await getUserCompetencyMap('learner-1');

    expect(map[0].topics[0].levels).toHaveLength(1);
    expect(map[0].topics[0].levels[0]).toMatchObject({ bloomLevel: 'ANALYSE', count: 2 });
  });

  test('flags a level resting on a single observation as needing review', async () => {
    CompetencyProfile.find.mockResolvedValue([
      {
        topicId: 'sub_1nf_def',
        knowledgeType: 'procedural',
        bloomLevel: 'analyze',
        score: 0.9,
        // Exactly what computeConfidence yields for one observation: 1 - 0.6^1.
        // The threshold sits above this on purpose, so the most misleading case
        // (a high percentage from one data point) is the one that gets flagged.
        confidence: 0.4,
        evidence: [{ objectiveId: 'obj_1nf_def' }]
      }
    ]);

    const map = await getUserCompetencyMap('learner-1');

    expect(map[0].topics[0].levels[0]).toMatchObject({ score: 0.9, needsReview: true });
  });

  test('does not flag a level backed by more than one observation', async () => {
    CompetencyProfile.find.mockResolvedValue([
      {
        topicId: 'sub_1nf_def',
        knowledgeType: 'procedural',
        bloomLevel: 'analyze',
        score: 0.7,
        confidence: 0.64,
        evidence: [{ objectiveId: 'obj_1nf_def' }, { objectiveId: 'obj_1nf_def' }]
      }
    ]);

    const map = await getUserCompetencyMap('learner-1');

    expect(map[0].topics[0].levels[0].needsReview).toBe(false);
  });
});
