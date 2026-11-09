jest.mock('../models/NardouchConversation', () => ({
  NardouchConversationModel: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn()
  }
}));
jest.mock('../services/resourceAccess', () => ({ canReadCourse: jest.fn() }));
jest.mock('../services/coursePublication', () => ({
  ...jest.requireActual('../services/coursePublication'),
  getPublishedCourseContext: jest.fn()
}));
jest.mock('../services/revisionSources', () => ({ verifyRevisionArtifact: jest.fn() }));
jest.mock('../models', () => ({ CourseRevision: { findOne: jest.fn() } }));
jest.mock('../../../../shared/aiClient', () => ({
  __esModule: true,
  default: { post: jest.fn() }
}));
import { NardouchConversationModel as C } from '../models/NardouchConversation';
import { CourseRevision } from '../models';
import { canReadCourse } from '../services/resourceAccess';
import { getPublishedCourseContext } from '../services/coursePublication';
import { verifyRevisionArtifact } from '../services/revisionSources';
import aiClient from '../../../../shared/aiClient';
import {
  getConversation,
  submitTurn,
  submitFeedback,
  generateSpeech,
  transcribeSpeech
} from '../services/nardouch';
import { parseNardouchInput, parseNardouchAnswer } from '../../../../shared/ednova/nardouch';
import express from 'express';
import request from 'supertest';
import router from '../routes/nardouch';
const courseId = '01020ca1-fc51-5c10-92c0-16c54abb997f',
  id = '593d63a2-44fc-53df-803a-f264599307e7',
  hash = 'sha256:' + 'c'.repeat(64);
const input = {
  courseId,
  revisionId: 'rev_1',
  message: 'mafhemtech el recursion',
  mode: 'socratic',
  language: { language: 'darija', script: 'arabizi' },
  expectedVersion: 0
};
const record = {
  id: id,
  userId: 'owner',
  courseId,
  revisionId: 'rev_1',
  contentHash: hash,
  version: 0,
  messages: [],
  expiresAt: new Date(Date.now() + 999999)
};
const passage = {
  documentId: 'doc',
  chunkId: 'chk_' + 'c'.repeat(64),
  textHash: hash,
  pageNumber: 2,
  text: 'Recursion needs a base case.'
};
function answer(traceId: string) {
  return {
    displayText: '3lech base case mouhema?',
    speechText: '3lech base case mouhema?',
    followups: [],
    citations: [{ ...passage, quote: passage.text, verified: true, text: undefined }].map(
      ({ text: _, ...c }) => c
    ),
    evidenceStatus: 'source_linked',
    mode: 'socratic',
    language: input.language,
    usage: {
      traceId,
      model: 'approved-model',
      tier: 'capable',
      executionMode: 'REAL_APPROVED',
      latencyMs: 10,
      tokens: null,
      fallbackUsed: false
    }
  };
}
// The converted models return the row directly; `.lean()` no longer exists.
const lean = (value: unknown) => Promise.resolve(value);
beforeEach(() => {
  jest.clearAllMocks();
  (canReadCourse as jest.Mock).mockResolvedValue(true);
  (getPublishedCourseContext as jest.Mock).mockResolvedValue({
    courseId,
    revisionId: 'rev_1',
    contentHash: hash,
    topics: [],
    authorizedDocumentIds: ['doc']
  });
  (CourseRevision.findOne as jest.Mock).mockReturnValue(lean({ sourceManifestDigest: hash }));
  (verifyRevisionArtifact as jest.Mock).mockResolvedValue({
    artifactHash: hash,
    passages: [passage]
  });
  (C.create as jest.Mock).mockResolvedValue(record);
  (C.findOne as jest.Mock).mockReturnValue(lean(record));
  (C.findOneAndUpdate as jest.Mock).mockImplementation((_query, update) =>
    lean(
      update.$push
        ? {
            ...record,
            version: 1,
            mode: input.mode,
            language: input.language,
            messages: update.$push.messages.$each
          }
        : record
    )
  );
  (C.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
  (aiClient.post as jest.Mock).mockImplementation(async (_url, payload) => ({
    data: answer(payload.traceId)
  }));
});
test.each(['userId', 'history', 'authorizedDocumentIds', 'roomId', 'competencies'])(
  'rejects body-controlled %s',
  (field) => {
    expect(() => parseNardouchInput({ ...input, [field]: 'injected' })).toThrow();
  }
);
test('rejects empty questions and invalid modes', () => {
  expect(() => parseNardouchInput({ ...input, message: ' ' })).toThrow();
  expect(() => parseNardouchInput({ ...input, mode: 'answer-generator' })).toThrow();
});
test('creates a durable answer with server-owned history and sources', async () => {
  const result = await submitTurn('owner', input);
  expect(result.version).toBe(1);
  expect(result.messages).toHaveLength(2);
  expect(result.messages[1].answer?.citations[0].documentId).toBe('doc');
  const payload = (aiClient.post as jest.Mock).mock.calls[0][1];
  expect(payload.history).toEqual([]);
  expect(payload).not.toHaveProperty('userId');
  expect(C.findOneAndUpdate).toHaveBeenLastCalledWith(
    expect.objectContaining({ userId: 'owner', version: 0, lockToken: expect.any(String) }),
    expect.objectContaining({ $inc: { version: 1 } }),
    { new: true }
  );
});
test('continuity comes from the owner record, including corrected wording', async () => {
  (C.findOneAndUpdate as jest.Mock).mockReturnValue(
    lean({ ...record, messages: [{ role: 'user', content: 'I meant call stack' }] })
  );
  await submitTurn('owner', { ...input, conversationId: id });
  expect((aiClient.post as jest.Mock).mock.calls[0][1].history).toEqual([
    { role: 'user', content: 'I meant call stack' }
  ]);
});
test('denies course access before retrieval or dispatch', async () => {
  (canReadCourse as jest.Mock).mockResolvedValue(false);
  await expect(submitTurn('stranger', input)).rejects.toThrow();
  expect(aiClient.post).not.toHaveBeenCalled();
});
test('owner-scopes retrieval and does not project locks, feedback or identity', async () => {
  (C.findOne as jest.Mock).mockReturnValue(lean(null));
  await expect(getConversation('stranger', id)).rejects.toMatchObject({ status: 404 });
  expect(C.findOne).toHaveBeenCalledWith(expect.objectContaining({ id: id, userId: 'stranger' }));
});
test('rejects mismatched course histories', async () => {
  (C.findOne as jest.Mock).mockReturnValue(lean({ ...record, courseId: '78740652-c3d8-5a84-b2d0-36d6ac2c2f2b' }));
  await expect(submitTurn('owner', { ...input, conversationId: id })).rejects.toMatchObject({
    status: 409
  });
  expect(aiClient.post).not.toHaveBeenCalled();
});
test('concurrent or stale writes are rejected before inference', async () => {
  (C.findOneAndUpdate as jest.Mock).mockReturnValue(lean(null));
  await expect(submitTurn('owner', { ...input, conversationId: id })).rejects.toMatchObject({
    status: 409
  });
  expect(aiClient.post).not.toHaveBeenCalled();
});
test('access revocation while inference is running discards the response', async () => {
  (canReadCourse as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  await expect(submitTurn('owner', input)).rejects.toThrow();
  expect((C.findOneAndUpdate as jest.Mock).mock.calls).toHaveLength(1);
  expect(C.updateOne).toHaveBeenCalled();
});
test('foreign citations are rejected against the real artifact boundary', async () => {
  (verifyRevisionArtifact as jest.Mock).mockResolvedValue({ artifactHash: hash, passages: [] });
  await expect(submitTurn('owner', input)).rejects.toMatchObject({ status: 503 });
});
test('provider failure releases the lock without appending invented messages', async () => {
  (aiClient.post as jest.Mock).mockRejectedValue(new Error('provider down'));
  await expect(submitTurn('owner', input)).rejects.toThrow();
  expect((C.findOneAndUpdate as jest.Mock).mock.calls).toHaveLength(1);
  expect(C.updateOne).toHaveBeenCalled();
});
test('only a stored assistant message accepts feedback', async () => {
  await expect(
    submitFeedback('owner', id, { messageId: 'fake', helpful: true })
  ).rejects.toMatchObject({ status: 404 });
});
test('production rejects mock responses and different speech meanings', () => {
  const value = answer('a'.repeat(36));
  expect(() => parseNardouchAnswer({ ...value, speechText: 'different' })).toThrow();
  expect(() =>
    parseNardouchAnswer({ ...value, usage: { ...value.usage, executionMode: 'MOCK_TEST' } })
  ).toThrow();
});
test('HTTP boundary requires authentication and disables response caching', async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  const res = await request(app).post('/turn').send(input);
  expect(res.status).toBe(401);
  expect(res.headers['cache-control']).toBe('private, no-store');
});

test('speech cannot be generated from client-supplied arbitrary text', async () => {
  await expect(
    generateSpeech('owner', id, { messageId: 'fake', speechText: 'injected' })
  ).rejects.toMatchObject({ status: 400 });
  expect(aiClient.post).not.toHaveBeenCalled();
});
test('speech requires an owner-visible stored assistant response', async () => {
  await expect(generateSpeech('owner', id, { messageId: 'fake' })).rejects.toMatchObject({
    status: 404
  });
  expect(aiClient.post).not.toHaveBeenCalled();
});
test('transcription requires explicit consent and a bounded recording', async () => {
  await expect(
    transcribeSpeech('owner', {
      courseId,
      revisionId: 'rev_1',
      audioBase64: 'bytes',
      locale: 'ar-TN',
      consent: false
    })
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    transcribeSpeech('owner', {
      courseId,
      revisionId: 'rev_1',
      audioBase64: 'a'.repeat(1_300_001),
      locale: 'ar-TN',
      consent: true
    })
  ).rejects.toMatchObject({ status: 400 });
  expect(aiClient.post).not.toHaveBeenCalled();
});
test('TTS sends only the validated stored answer and rechecks current access', async () => {
  (C.findOne as jest.Mock).mockReturnValue(
    lean({
      ...record,
      messages: [
        { id: 'approved', role: 'assistant', content: 'text', answer: answer('a'.repeat(36)) }
      ]
    })
  );
  (aiClient.post as jest.Mock).mockResolvedValue({
    data: { audioBase64: 'bXAz', mimeType: 'audio/mpeg' }
  });
  const result = await generateSpeech('owner', id, { messageId: 'approved' });
  expect(result.mimeType).toBe('audio/mpeg');
  expect(aiClient.post).toHaveBeenCalledWith(
    '/api/ai/nardouch/speech',
    {
      speechText: '3lech base case mouhema?',
      generationKey: expect.stringMatching(/^[a-f0-9]{64}$/)
    },
    { timeout: 23000 }
  );
  expect(canReadCourse).toHaveBeenCalledTimes(2);
});

test('malformed speech service envelopes are outages, not student validation errors', async () => {
  (C.findOne as jest.Mock).mockReturnValue(
    lean({
      ...record,
      messages: [
        { id: 'approved', role: 'assistant', content: 'text', answer: answer('a'.repeat(36)) }
      ]
    })
  );
  (aiClient.post as jest.Mock).mockResolvedValue({ data: { unexpected: 'provider payload' } });
  await expect(generateSpeech('owner', id, { messageId: 'approved' })).rejects.toMatchObject({
    status: 503
  });
});
