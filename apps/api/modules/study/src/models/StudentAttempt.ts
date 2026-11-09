import type {
  Prisma,
  StudentAttempt as StudentAttemptRow
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export type IStudentAttempt = Omit<
  StudentAttemptRow,
  'answers' | 'assessmentResult' | 'submission' | 'preparedEvidence'
> & {
  id: string;
  answers: Record<string, unknown>;
  assessmentResult?: Record<string, unknown> | null;
  submission?: Record<string, unknown> | null;
  preparedEvidence?: Record<string, unknown> | null;
};

export const StudentAttempt = table<IStudentAttempt>({
  delegate: () => prisma.studentAttempt,
  jsonColumns: ['answers', 'assessmentResult', 'submission', 'preparedEvidence'],
  defaults: () => ({ answers: {}, status: 'submitted', submittedAt: new Date() }),
  columns: (row) => ({
    userId: row.userId,
    attemptId: row.attemptId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    contentHash: row.contentHash,
    activityId: row.activityId,
    activityRevision: row.activityRevision,
    activityType: row.activityType,
    roomId: row.roomId,
    timeSpentSeconds: row.timeSpentSeconds,
    answers: row.answers as unknown as Prisma.InputJsonValue,
    payloadHash: row.payloadHash,
    status: row.status,
    submittedAt: row.submittedAt,
    assessmentResult: row.assessmentResult as unknown as Prisma.InputJsonValue,
    evidenceId: row.evidenceId,
    protocolVersion: row.protocolVersion,
    processingState: row.processingState,
    submission: row.submission as unknown as Prisma.InputJsonValue,
    preparedEvidence: row.preparedEvidence as unknown as Prisma.InputJsonValue
  })
});

export default StudentAttempt;
