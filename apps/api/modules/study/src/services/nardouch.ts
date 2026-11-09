/** Student authority and durable continuity belong to Study, not the model. */
import { createHash, randomUUID } from 'node:crypto';
import { NardouchConversationModel as Conversations } from '../models/NardouchConversation';
import { CourseRevision } from '../models';
import { canReadCourse } from './resourceAccess';
import { getPublishedCourseContext, PublicationForbiddenError } from './coursePublication';
import { verifyRevisionArtifact } from './revisionSources';
import aiClient from '../../../../shared/aiClient';
import {
  NardouchError,
  parseNardouchInput,
  parseNardouchAnswer,
  exactObject,
  type NardouchConversation,
  type NardouchMessage
} from '../../../../shared/ednova/nardouch';

const retention = () => new Date(Date.now() + 30 * 86400_000);
function upstreamObject(value: unknown, keys: string[]) {
  try {
    return exactObject(value, keys);
  } catch {
    throw new NardouchError(503, 'The speech provider returned an invalid response. Please retry.');
  }
}
function identifier(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new NardouchError(404, 'Conversation not found');
}
export async function getConversation(userId: string, id: string) {
  identifier(id);
  const record = await Conversations.findOne({
    id: id,
    userId,
    expiresAt: { $gt: new Date() }
  });
  if (!record) throw new NardouchError(404, 'Conversation not found');
  if (!(await canReadCourse(userId, record.courseId)))
    throw new PublicationForbiddenError('Course access denied');
  // A historical conversation remains bound to its published revision.
  await getPublishedCourseContext(userId, record.courseId, record.revisionId);
  return record;
}
export function publicConversation(record: {
  id: unknown;
  courseId: string;
  revisionId: string;
  version: number;
  messages: NardouchMessage[];
  mode: NardouchConversation['mode'];
  language: NardouchConversation['language'];
}): NardouchConversation {
  return {
    id: String(record.id),
    courseId: record.courseId,
    revisionId: record.revisionId,
    version: record.version,
    messages: record.messages,
    mode: record.mode,
    language: record.language
  };
}
export async function submitTurn(userId: string, raw: unknown) {
  const input = parseNardouchInput(raw);
  if (!(await canReadCourse(userId, input.courseId)))
    throw new PublicationForbiddenError('Course access denied');
  const context = await getPublishedCourseContext(userId, input.courseId, input.revisionId);
  const objective = input.objectiveId
    ? context.topics.flatMap((t) => t.objectives).find((o) => o.objectiveId === input.objectiveId)
    : undefined;
  if (input.objectiveId && !objective)
    throw new NardouchError(400, 'Select a published learning objective');
  const revision = await CourseRevision.findOne({
    courseId: input.courseId,
    revisionTag: context.revisionId
  });
  if (!revision) throw new NardouchError(503, 'Course materials are unavailable');
  const artifact = await verifyRevisionArtifact(revision);
  let record;
  if (input.conversationId) {
    record = await getConversation(userId, input.conversationId);
    if (
      record.courseId !== input.courseId ||
      record.revisionId !== input.revisionId ||
      record.contentHash !== context.contentHash
    )
      throw new NardouchError(409, 'Start a new conversation for these course materials');
  } else {
    if (input.expectedVersion !== 0) throw new NardouchError(409, 'Start a new conversation');
    record = await Conversations.create({
      userId,
      courseId: input.courseId,
      revisionId: context.revisionId,
      contentHash: context.contentHash,
      mode: input.mode,
      language: input.language,
      expiresAt: retention()
    });
  }
  if (record.messages.length >= 80)
    throw new NardouchError(409, 'Start a new conversation to continue');
  const lockToken = randomUUID();
  const locked = await Conversations.findOneAndUpdate(
    {
      id: record.id,
      userId,
      version: input.expectedVersion,
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: new Date() } }]
    },
    { $set: { lockToken, lockedUntil: new Date(Date.now() + 90_000) } },
    { new: true }
  );
  if (!locked)
    throw new NardouchError(409, 'Conversation changed or is busy. Reload it before retrying.');
  try {
    const traceId = randomUUID();
    const response = await aiClient.post(
      '/api/ai/nardouch/turn',
      {
        grounding: {
          courseId: input.courseId,
          revisionId: context.revisionId,
          contentHash: context.contentHash,
          manifestDigest: revision.sourceManifestDigest,
          artifactHash: artifact.artifactHash,
          authorizedDocumentIds: context.authorizedDocumentIds,
          question: input.message,
          topK: 5
        },
        history: locked.messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        objective: objective?.statement || '',
        mode: input.mode,
        language: input.language,
        traceId
      },
      { timeout: 26000 }
    );
    const answer = parseNardouchAnswer(response.data, {
      allowMock: process.env.NODE_ENV !== 'production' && process.env.LLM_MOCK === '1'
    });
    if (
      answer.usage.traceId !== traceId ||
      answer.mode !== input.mode ||
      answer.language.language !== input.language.language ||
      answer.language.script !== input.language.script ||
      answer.citations.some(
        (c) =>
          !context.authorizedDocumentIds.includes(c.documentId) ||
          !artifact.passages.some(
            (p) =>
              p.documentId === c.documentId &&
              p.chunkId === c.chunkId &&
              p.textHash === c.textHash &&
              p.pageNumber === c.pageNumber &&
              p.text === c.quote
          )
      )
    )
      throw new NardouchError(503, 'Nardouch could not verify the response sources');
    if (!(await canReadCourse(userId, input.courseId)))
      throw new PublicationForbiddenError('Course access revoked');
    const current = await getPublishedCourseContext(userId, input.courseId, input.revisionId);
    if (current.contentHash !== context.contentHash)
      throw new NardouchError(409, 'Course materials changed');
    const messages: NardouchMessage[] = [
      { id: randomUUID(), role: 'user', content: input.message },
      { id: randomUUID(), role: 'assistant', content: answer.displayText, answer }
    ];
    const saved = await Conversations.findOneAndUpdate(
      { id: locked.id, userId, lockToken, version: input.expectedVersion },
      {
        $push: { messages: { $each: messages } },
        $inc: { version: 1 },
        $set: { mode: input.mode, language: input.language, expiresAt: retention() },
        $unset: { lockedUntil: 1, lockToken: 1 }
      },
      { new: true }
    );
    if (!saved) throw new NardouchError(409, 'Conversation changed. Reload it before retrying.');
    return publicConversation(saved);
  } finally {
    await Conversations.updateOne(
      { id: locked.id, userId, lockToken },
      { $unset: { lockedUntil: 1, lockToken: 1 } }
    );
  }
}
export async function submitFeedback(userId: string, id: string, raw: unknown) {
  const body = exactObject(raw, ['messageId', 'helpful', 'comment']);
  if (
    typeof body.messageId !== 'string' ||
    typeof body.helpful !== 'boolean' ||
    (body.comment !== undefined && (typeof body.comment !== 'string' || body.comment.length > 1000))
  )
    throw new NardouchError(400, 'Invalid feedback');
  const record = await getConversation(userId, id);
  if (!record.messages.some((m) => m.id === body.messageId && m.role === 'assistant'))
    throw new NardouchError(404, 'Response not found');
  // Bounded one feedback per response; does not enter assessment or room channels.
  await Conversations.updateOne(
    { id: id, userId, 'feedback.messageId': { $ne: body.messageId } },
    {
      $push: {
        feedback: { messageId: body.messageId, helpful: body.helpful, comment: body.comment || '' }
      }
    }
  );
}

/** Audio is transient; only the corrected text becomes a conversation message. */
export async function transcribeSpeech(userId: string, raw: unknown) {
  const body = exactObject(raw, ['courseId', 'revisionId', 'audioBase64', 'locale', 'consent']);
  if (
    typeof body.courseId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.courseId) ||
    typeof body.revisionId !== 'string' ||
    body.revisionId.length > 128 ||
    typeof body.audioBase64 !== 'string' ||
    body.audioBase64.length > 1_300_000 ||
    !body.audioBase64.length ||
    body.consent !== true ||
    !['ar-TN', 'fr-FR', 'en-US'].includes(String(body.locale))
  )
    throw new NardouchError(
      400,
      'Invalid recording. Record at most 30 seconds and confirm speech-provider consent.'
    );
  await getPublishedCourseContext(userId, body.courseId, body.revisionId);
  const response = await aiClient.post(
    '/api/ai/nardouch/transcribe',
    {
      audioBase64: body.audioBase64,
      locale: body.locale,
      consent: true
    },
    { timeout: 23000 }
  );
  const result = upstreamObject(response.data, ['transcript']);
  if (
    typeof result.transcript !== 'string' ||
    !result.transcript.trim() ||
    result.transcript.length > 4000
  )
    throw new NardouchError(503, 'No usable transcript. Type your question or retry.');
  if (!(await canReadCourse(userId, body.courseId)))
    throw new PublicationForbiddenError('Course access revoked');
  return { transcript: result.transcript };
}
export async function generateSpeech(userId: string, id: string, raw: unknown) {
  const body = exactObject(raw, ['messageId']);
  if (typeof body.messageId !== 'string') throw new NardouchError(400, 'Select a response');
  const record = await getConversation(userId, id);
  const message = record.messages.find((m) => m.id === body.messageId && m.role === 'assistant');
  if (!message?.answer) throw new NardouchError(404, 'Response not found');
  const answer = parseNardouchAnswer(message.answer);
  const response = await aiClient.post(
    '/api/ai/nardouch/speech',
    {
      speechText: answer.speechText,
      generationKey: createHash('sha256').update(`${userId}:${id}:${message.id}`).digest('hex')
    },
    { timeout: 23000 }
  );
  const result = upstreamObject(response.data, ['audioBase64', 'mimeType']);
  if (
    !['audio/wav', 'audio/mpeg'].includes(String(result.mimeType)) ||
    typeof result.audioBase64 !== 'string' ||
    result.audioBase64.length > 5_400_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(result.audioBase64)
  )
    throw new NardouchError(503, 'Spoken answer is unavailable. Read the text response.');
  if (!(await canReadCourse(userId, record.courseId)))
    throw new PublicationForbiddenError('Course access revoked');
  return result as { audioBase64: string; mimeType: string };
}
