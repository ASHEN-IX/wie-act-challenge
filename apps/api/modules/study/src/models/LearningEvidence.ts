import type {
  LearningEvidence as LearningEvidenceRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export type ILearningEvidence = Omit<
  LearningEvidenceRow,
  'activity' | 'evaluator' | 'rewardReference'
> & {
  id: string;
  activity: {
    courseId: string;
    revisionId: string;
    contentHash: string;
    activityId: string;
    activityRevision: string;
    activityType: 'InteractiveQuiz' | 'GuidedProblem';
  };
  evaluator: {
    type: 'deterministic_rubric' | 'llm_evaluation';
    model?: string | null;
    validationVersion: string;
    executionMode: 'REAL_APPROVED' | 'MOCK_TEST' | 'DETERMINISTIC_FALLBACK';
  };
  rewardReference?: {
    rewardCandidateId: string;
    policyVersion: string;
    eventKey: string;
    finalAwardId?: string | null;
  } | null;
};

export const LearningEvidence = table<ILearningEvidence>({
  delegate: () => prisma.learningEvidence,
  jsonColumns: ['activity', 'evaluator', 'rewardReference'],
  defaults: () => ({ evidenceVersion: '1.0.0', status: 'accepted', timestamp: new Date() }),
  columns: (row) => ({
    evidenceId: row.evidenceId,
    evidenceVersion: row.evidenceVersion,
    userId: row.userId,
    attemptId: row.attemptId,
    activity: row.activity as unknown as Prisma.InputJsonValue,
    objectiveId: row.objectiveId,
    status: row.status,
    bloomLevel: row.bloomLevel,
    score: row.score,
    masteryAchieved: row.masteryAchieved,
    evaluator: row.evaluator as unknown as Prisma.InputJsonValue,
    rewardReference: row.rewardReference as unknown as Prisma.InputJsonValue,
    timestamp: row.timestamp
  })
});

export default LearningEvidence;
