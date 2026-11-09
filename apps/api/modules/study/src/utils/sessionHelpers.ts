import { errorDetails } from '@ednova/shared/errors';
import type { IStudySession } from '../models';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildInternalHeaders } = require('@ednova/shared/auth');

const DEFAULT_TASK_ESTIMATED_MINUTES = 30;

const toSafeInteger = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.max(0, Math.trunc(numeric));
};

const getAxiosErrorDetails = (
  error: unknown
): { message: string; status?: number; data?: unknown } => {
  const { message, status, data } = errorDetails(error);
  return { message, status, data };
};

const isTeamSessionMember = (
  session: Partial<Pick<IStudySession, 'userId' | 'participants'>> | null | undefined,
  userId: string
): boolean => {
  if (!session || !userId) return false;
  const records = session.participants?.filter((p) => String(p.userId) === String(userId)) || [];
  if (records.length) return records.some((p) => !p.leftAt);
  return String(session.userId) === String(userId) && !session.participants?.length;
};

const isObjectId = (str: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

export {
  DEFAULT_TASK_ESTIMATED_MINUTES,
  toSafeInteger,
  getAxiosErrorDetails,
  buildInternalHeaders,
  isTeamSessionMember,
  isObjectId
};

module.exports = {
  DEFAULT_TASK_ESTIMATED_MINUTES,
  toSafeInteger,
  getAxiosErrorDetails,
  buildInternalHeaders,
  isTeamSessionMember,
  isObjectId
};
