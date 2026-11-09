import type {
  NardouchConversation as NardouchConversationRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';
import type {
  LearningMode,
  LanguagePreference,
  NardouchMessage
} from '../../../../shared/ednova/nardouch';

export type ConversationRecord = Omit<
  NardouchConversationRow,
  'language' | 'messages' | 'feedback'
> & {
  _id: string;
  mode: LearningMode;
  language: LanguagePreference;
  messages: NardouchMessage[];
  feedback: Array<{ messageId: string; helpful: boolean; comment: string }>;
};

export const NardouchConversationModel = table<ConversationRecord>({
  delegate: () => prisma.nardouchConversation,
  jsonColumns: ['language', 'messages', 'feedback'],
  defaults: () => ({ version: 0, messages: [], feedback: [] }),
  columns: (row) => ({
    userId: row.userId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    contentHash: row.contentHash,
    mode: row.mode,
    language: row.language as unknown as Prisma.InputJsonValue,
    version: row.version,
    messages: row.messages as unknown as Prisma.InputJsonValue,
    feedback: row.feedback as unknown as Prisma.InputJsonValue,
    lockToken: row.lockToken,
    lockedUntil: row.lockedUntil,
    expiresAt: row.expiresAt
  })
});

export default NardouchConversationModel;
