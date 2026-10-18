// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildInternalHeaders } = require('@study-partner/shared/auth');

const DEFAULT_TASK_ESTIMATED_MINUTES = 30;

const toSafeInteger = (value: any, fallback = 0): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.max(0, Math.trunc(numeric));
};

const getAxiosErrorDetails = (error: any): { message: string; status?: number; data?: any } => ({
  message: error.message,
  status: error.response?.status,
  data: error.response?.data
});

const isTeamSessionMember = (session: any, userId: string): boolean => {
  if (!session || !userId) return false;
  if (String(session.userId) === String(userId)) return true;
  return session.participants?.some((p: any) => String(p.userId) === String(userId) && !p.leftAt);
};

const isObjectId = (str: string): boolean => /^[a-f\d]{24}$/i.test(str);

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
