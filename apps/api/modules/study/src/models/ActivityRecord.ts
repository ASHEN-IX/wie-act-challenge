import type {
  ActivityRecord as ActivityRecordRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export type IActivityRecord = Omit<ActivityRecordRow, 'publicDefinition' | 'serverEvaluation'> & {
  _id: string;
  publicDefinition: Record<string, unknown>;
  serverEvaluation: Record<string, unknown>;
};

export const ActivityRecord = table<IActivityRecord>({
  delegate: () => prisma.activityRecord,
  jsonColumns: ['publicDefinition', 'serverEvaluation'],
  columns: (row) => ({
    courseId: row.courseId,
    revisionId: row.revisionId,
    contentHash: row.contentHash,
    activityId: row.activityId,
    activityRevision: row.activityRevision,
    activityType: row.activityType,
    objectiveId: row.objectiveId,
    publicDefinition: row.publicDefinition as unknown as Prisma.InputJsonValue,
    serverEvaluation: row.serverEvaluation as unknown as Prisma.InputJsonValue
  })
});

export default ActivityRecord;
