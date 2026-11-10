/** Closed, shared browser/gateway contracts. Histories and evidence are server owned. */
export type LearningMode = 'explain' | 'socratic' | 'practice' | 'peer';
export interface LanguagePreference {
  language: 'auto' | 'darija' | 'fr' | 'en' | 'mixed';
  script: 'auto' | 'arabizi' | 'arabic';
}
export interface NardouchInput {
  courseId: string;
  revisionId: string;
  conversationId?: string;
  message: string;
  mode: LearningMode;
  language: LanguagePreference;
  objectiveId?: string;
  expectedVersion: number;
}
export interface NardouchCitation {
  documentId: string;
  pageNumber: number | null;
  chunkId: string;
  textHash: string;
  quote: string;
  verified: boolean;
}
export type SpeechLanguage = 'ar' | 'fr' | 'en';
export interface NardouchAnswer {
  displayText: string;
  speechText: string;
  speechLanguage?: SpeechLanguage | null;
  followups: string[];
  citations: NardouchCitation[];
  evidenceStatus: 'source_linked' | 'missing_context';
  mode: LearningMode;
  language: LanguagePreference;
  usage: {
    traceId: string;
    model: string;
    tier: 'compact' | 'capable';
    executionMode: 'REAL_APPROVED' | 'MOCK_TEST';
    latencyMs: number | null;
    tokens: Record<string, number> | null;
    fallbackUsed: boolean;
  };
}
export interface NardouchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answer?: NardouchAnswer;
}
export interface NardouchConversation {
  id: string;
  courseId: string;
  revisionId: string;
  version: number;
  messages: NardouchMessage[];
  mode: LearningMode;
  language: LanguagePreference;
}
export class NardouchError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
export function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new NardouchError(400, 'Invalid Nardouch request');
  return value as Record<string, unknown>;
}
export function parseLanguage(value: unknown): LanguagePreference {
  const v = exactObject(value, ['language', 'script']);
  if (
    !['auto', 'darija', 'fr', 'en', 'mixed'].includes(String(v.language)) ||
    !['auto', 'arabizi', 'arabic'].includes(String(v.script))
  )
    throw new NardouchError(400, 'Invalid language preference');
  return v as unknown as LanguagePreference;
}
export function parseNardouchInput(value: unknown): NardouchInput {
  const v = exactObject(value, [
    'courseId',
    'revisionId',
    'conversationId',
    'message',
    'mode',
    'language',
    'objectiveId',
    'expectedVersion'
  ]);
  if (
    typeof v.courseId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v.courseId
    ) ||
    typeof v.revisionId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v.revisionId) ||
    typeof v.message !== 'string' ||
    !v.message.trim() ||
    v.message.length > 4000 ||
    !['explain', 'socratic', 'practice', 'peer'].includes(String(v.mode)) ||
    !Number.isInteger(v.expectedVersion) ||
    Number(v.expectedVersion) < 0 ||
    (v.conversationId !== undefined &&
      (typeof v.conversationId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          v.conversationId
        ))) ||
    (v.objectiveId !== undefined &&
      (typeof v.objectiveId !== 'string' || v.objectiveId.length > 150))
  )
    throw new NardouchError(400, 'Invalid Nardouch request');
  return {
    ...v,
    message: v.message.trim(),
    language: parseLanguage(v.language)
  } as unknown as NardouchInput;
}
export function parseNardouchAnswer(value: unknown, { allowMock = false } = {}): NardouchAnswer {
  try {
    const v = exactObject(value, [
      'displayText',
      'speechText',
      'speechLanguage',
      'followups',
      'citations',
      'evidenceStatus',
      'mode',
      'language',
      'usage'
    ]);
    if (
      typeof v.displayText !== 'string' ||
      !v.displayText.trim() ||
      v.displayText.length > 12000 ||
      typeof v.speechText !== 'string' ||
      (v.speechLanguage == null
        ? v.speechText !== v.displayText
        : (typeof v.speechLanguage !== 'string' ||
          !['ar', 'fr', 'en'].includes(v.speechLanguage) ||
          !v.speechText.trim() ||
          v.speechText.length > 600 ||
          /https?:\/\/|\[/.test(v.speechText))) ||
      /https?:\/\/|\[doc:/.test(v.displayText) ||
      !Array.isArray(v.followups) ||
      v.followups.length > 3 ||
      v.followups.some((f) => typeof f !== 'string' || !f.trim() || f.length > 300) ||
      !Array.isArray(v.citations) ||
      v.citations.length > 5 ||
      !['source_linked', 'missing_context'].includes(String(v.evidenceStatus)) ||
      (v.evidenceStatus === 'source_linked') !== v.citations.length > 0 ||
      !['explain', 'socratic', 'practice', 'peer'].includes(String(v.mode))
    )
      throw new Error();
    parseLanguage(v.language);
    const u = exactObject(v.usage, [
      'traceId',
      'model',
      'tier',
      'executionMode',
      'latencyMs',
      'tokens',
      'fallbackUsed'
    ]);
    if (
      typeof u.traceId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(u.traceId) ||
      typeof u.model !== 'string' ||
      u.model.length > 300 ||
      !['compact', 'capable'].includes(String(u.tier)) ||
      (u.executionMode !== 'REAL_APPROVED' && !(allowMock && u.executionMode === 'MOCK_TEST')) ||
      (u.latencyMs !== null &&
        (typeof u.latencyMs !== 'number' || !Number.isFinite(u.latencyMs) || u.latencyMs < 0)) ||
      typeof u.fallbackUsed !== 'boolean'
    )
      throw new Error();
    if (u.tokens !== null) {
      if (
        !u.tokens ||
        typeof u.tokens !== 'object' ||
        Array.isArray(u.tokens) ||
        Object.values(u.tokens).some((n) => typeof n !== 'number' || !Number.isInteger(n) || n < 0)
      )
        throw new Error();
    }
    for (const item of v.citations) {
      const c = exactObject(item, [
        'documentId',
        'pageNumber',
        'chunkId',
        'textHash',
        'quote',
        'verified'
      ]);
      if (
        typeof c.documentId !== 'string' ||
        typeof c.chunkId !== 'string' ||
        typeof c.textHash !== 'string' ||
        typeof c.quote !== 'string' ||
        c.quote.length > 12000 ||
        c.verified !== true ||
        (c.pageNumber !== null && (!Number.isInteger(c.pageNumber) || Number(c.pageNumber) < 1))
      )
        throw new Error();
    }
    return v as unknown as NardouchAnswer;
  } catch {
    throw new NardouchError(503, 'Nardouch returned an invalid response. Please retry.');
  }
}
