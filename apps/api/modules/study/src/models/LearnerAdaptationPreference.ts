import type {
  LearnerAdaptationPreference as LearnerAdaptationPreferenceRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/**
 * One learner's adaptation preferences (Batch 4, Milestone 4.4).
 *
 * User-scoped, editable, resettable, and deliberately small. It stores only
 * what the application needs to honour a stated preference — never an ability
 * estimate, never a learning-style classification, never an evidence history.
 * Assessment evidence is read live from the trusted records at recommendation
 * time and is not copied here.
 *
 * `version` makes concurrent writes deterministic: a stale tab writing an old
 * version is rejected rather than silently winning.
 */
export type ILearnerAdaptationPreference = Omit<LearnerAdaptationPreferenceRow, 'dismissed'> & {
  _id: string;
  dismissed: Array<{
    courseId: string;
    revisionId: string;
    lessonId: string;
    mode: string;
    at: Date;
  }>;
};

export const LearnerAdaptationPreference = table<ILearnerAdaptationPreference>({
  delegate: () => prisma.learnerAdaptationPreference,
  jsonColumns: ['dismissed'],
  defaults: () => ({
    version: 0,
    recommendationsEnabled: true,
    allowAssessmentEvidence: true,
    preferWorkedExamples: false,
    preferVisualExploration: false,
    preferDetailedProofs: false,
    dismissed: []
  }),
  columns: (row) => ({
    userId: row.userId,
    version: row.version,
    recommendationsEnabled: row.recommendationsEnabled,
    allowAssessmentEvidence: row.allowAssessmentEvidence,
    preferredMode: row.preferredMode,
    preferWorkedExamples: row.preferWorkedExamples,
    preferVisualExploration: row.preferVisualExploration,
    preferDetailedProofs: row.preferDetailedProofs,
    dismissed: row.dismissed as unknown as Prisma.InputJsonValue
  })
});

export default LearnerAdaptationPreference;
