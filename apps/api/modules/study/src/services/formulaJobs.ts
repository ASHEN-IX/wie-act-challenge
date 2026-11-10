import crypto from 'node:crypto';
import amqp from 'amqplib';
import { Course } from '../models';
import { FormulaRecognitionJob as Jobs } from '../models/FormulaRecognitionJob';
import { FormulaProposal } from '../models/FormulaProposal';
import { findEditableDraft } from './courseDraft';
import { canManageCourse } from './resourceAccess';
import { verifyBlob, manifestDigest, type SourceDocument } from './revisionSources';
import { fail, validateCorrection } from './formulaReview';
import aiClient from '../../../../shared/aiClient';
import { EXCHANGE_JOBS } from '../../../../shared/ai-messaging/topology';
import { prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { isDuplicateKey } from '../models/_table';

export const FORMULA_QUEUE = process.env.FORMULA_QUEUE || 'ai.work.study.formula.recognize';
const ROUTE = process.env.FORMULA_ROUTING_KEY || 'study.formula.recognize';
const digest = (value: unknown) =>
  'sha256:' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function snapshot(
  actor: string | undefined,
  courseId: string,
  tag: string,
  version: number
) {
  if (!actor) fail(401, 'UNAUTHENTICATED');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId) ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tag) ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    fail(422, 'INVALID_REQUEST');
  if (!(await canManageCourse(actor, courseId))) fail(403, 'FORBIDDEN');
  const draft = await findEditableDraft(courseId);
  if (
    !draft ||
    draft.status !== 'draft' ||
    draft.revokedAt ||
    draft.revisionTag !== tag ||
    draft.__v !== version
  )
    fail(409, 'DRAFT_CHANGED');
  return draft;
}
/**
 * Owner consent and provider eligibility are generic `payload` rows: their
 * columns vary by provider, so the documented query keys live in `payload`.
 */
async function findConsent(where: Record<string, unknown>) {
  const rows = await prisma.formulaSourceConsent.findMany();
  return rows.find((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    return Object.entries(where).every(([key, value]) => payload[key] === value);
  });
}
async function findEligible(docHash: string, model: string) {
  const rows = await prisma.formulaProviderEligibility.findMany({
    where: {
      provider: 'gemini',
      model,
      freeTier: true,
      billingAttached: false,
      expiresAt: { gt: new Date() },
      NOT: { revoked: true }
    }
  });
  void docHash;
  return rows[0];
}
export async function consent(
  actor: string,
  courseId: string,
  tag: string,
  version: number,
  documentId: string
) {
  const draft = await snapshot(actor, courseId, tag, version);
  const course = await Course.findById(courseId);
  if (!course || ![course.ownerUserId, course.userId].includes(actor))
    fail(403, 'OWNER_CONSENT_REQUIRED');
  const doc = draft.sourceManifest?.find((d) => d.documentId === documentId);
  if (!doc?.storageRef) fail(404, 'NOT_FOUND');
  await verifyBlob(doc as SourceDocument);
  const identity = digest([courseId, doc.contentHash, 'gemini']);
  // Unique consent identity (`payload.identity`): re-granting is idempotent.
  const existing = await findConsent({ identity });
  if (existing) {
    await prisma.formulaSourceConsent.update({
      where: { id: existing.id },
      data: {
        payload: {
          ...(existing.payload as Record<string, unknown>),
          courseId,
          documentHash: doc.contentHash,
          provider: 'gemini',
          owner: actor,
          grantedAt: new Date(),
          revoked: false
        } as unknown as import('../../../../src/generated/prisma/client').Prisma.InputJsonValue
      }
    });
  } else {
    await prisma.formulaSourceConsent.create({
      data: {
        id: newId(),
        payload: {
          identity,
          courseId,
          documentHash: doc.contentHash,
          provider: 'gemini',
          owner: actor,
          grantedAt: new Date(),
          revoked: false
        } as unknown as import('../../../../src/generated/prisma/client').Prisma.InputJsonValue
      }
    });
  }
  return { granted: true };
}
async function prerequisites(actor: string, courseId: string, docHash: string, model: string) {
  if (!(await canManageCourse(actor, courseId))) fail(403, 'FORBIDDEN');
  const course = await Course.findById(courseId);
  const grant = await findConsent({
    courseId,
    documentHash: docHash,
    provider: 'gemini',
    revoked: false
  });
  const grantOwner = (grant?.payload as Record<string, unknown> | undefined)?.owner as
    string | undefined;
  if (!grant || !course || ![course.ownerUserId, course.userId].includes(grantOwner ?? ''))
    fail(403, 'OWNER_CONSENT_REQUIRED');
  const eligible = await findEligible(docHash, model);
  if (!eligible || !eligible.keySha256 || !eligible.verifiedBy || !eligible.projectId)
    fail(503, 'FREE_TIER_UNVERIFIED');
  // Python checks credential binding, operator approval and durable budget without inference.
  try {
    await aiClient.post(
      '/api/ai/sources/recognition-preflight',
      { model, keySha256: eligible.keySha256 },
      { timeout: 10000 }
    );
  } catch {
    fail(503, 'OPERATOR_APPROVAL_OR_BUDGET_UNAVAILABLE');
  }
}
async function inspect(
  draft: Awaited<ReturnType<typeof snapshot>>,
  documentId: string,
  regionId: string
) {
  if (!/^doc_[a-f0-9]{16}$/.test(documentId) || !/^region_[a-f0-9]{20}$/.test(regionId))
    fail(422, 'INVALID_REGION');
  const documents = draft.sourceManifest as SourceDocument[];
  const doc = documents?.find((d) => d.documentId === documentId);
  if (!doc?.storageRef || doc.mediaType !== 'application/pdf') fail(404, 'SOURCE_UNAVAILABLE');
  await verifyBlob(doc);
  const contentHash = 'sha256:' + draft.contentHash.replace(/^sha256:/, '');
  const manifest = {
    schemaVersion: '1.0.0',
    courseId: String(draft.courseId),
    revisionId: draft.revisionTag,
    contentHash,
    documents,
    manifestDigest: manifestDigest(
      String(draft.courseId),
      draft.revisionTag,
      contentHash,
      documents
    ),
    documentId,
    regionId
  };
  const { data: region } = await aiClient.post('/api/ai/sources/region-inspect', manifest);
  if (
    !region ||
    !Number.isSafeInteger(region.page) ||
    region.page < 1 ||
    !Array.isArray(region.bbox) ||
    region.bbox.length !== 4 ||
    !region.bbox.every(Number.isFinite) ||
    region.bbox[0] < 0 ||
    region.bbox[1] < 0 ||
    region.bbox[2] <= region.bbox[0] ||
    region.bbox[3] <= region.bbox[1] ||
    typeof region.text !== 'string' ||
    region.text.length > 8000 ||
    region.documentId !== documentId ||
    region.documentHash !== doc.contentHash ||
    region.regionId !== regionId ||
    !/^sha256:[a-f0-9]{64}$/.test(region.cropHash)
  )
    fail(503, 'SOURCE_INTEGRITY_UNAVAILABLE');
  return { manifest, region };
}
export async function dispatch(id: string) {
  const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
  try {
    const ch = await conn.createConfirmChannel();
    await ch.assertExchange(EXCHANGE_JOBS, 'direct', { durable: true });
    await ch.assertQueue(FORMULA_QUEUE, {
      durable: true,
      arguments: {
        'x-single-active-consumer': true,
        'x-max-length': 100,
        'x-overflow': 'reject-publish'
      }
    });
    await ch.bindQueue(FORMULA_QUEUE, EXCHANGE_JOBS, ROUTE);
    ch.publish(EXCHANGE_JOBS, ROUTE, Buffer.from(JSON.stringify({ jobId: id })), {
      persistent: true,
      messageId: id,
      contentType: 'application/json'
    });
    await ch.waitForConfirms();
    await ch.close();
  } finally {
    await conn.close();
  }
}
export async function submit(
  actor: string,
  courseId: string,
  tag: string,
  body: Record<string, unknown> | null | undefined
) {
  if (
    !body ||
    Object.keys(body).some((k) => !['documentId', 'regionId', 'draftVersion'].includes(k))
  )
    fail(422, 'INVALID_REQUEST');
  const draft = await snapshot(actor, courseId, tag, body.draftVersion as number);
  const { region } = await inspect(draft, String(body.documentId), String(body.regionId));
  const model = process.env.FORMULA_RECOGNITION_MODEL || 'gemini/gemini-2.5-flash';
  await prerequisites(actor, courseId, region.documentHash, model);
  const identity = digest([
    courseId,
    String(draft.id),
    tag,
    draft.__v,
    region.documentHash,
    region.regionId,
    region.cropHash,
    model
  ]);
  const payload = {
    identity,
    courseId,
    revisionId: String(draft.id),
    revisionTag: tag,
    draftVersion: draft.__v,
    actor,
    documentId: region.documentId,
    documentHash: region.documentHash,
    regionId: region.regionId,
    cropHash: region.cropHash,
    page: region.page,
    bbox: region.bbox,
    sourceText: region.text,
    model,
    state: 'queued'
  };
  let job;
  try {
    job = await Jobs.findOneAndUpdate(
      { identity },
      { $setOnInsert: payload },
      { upsert: true, new: true }
    );
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
    job = await Jobs.findOne({ identity });
  }
  if (!job || Array.isArray(job)) fail(503, 'JOB_UNAVAILABLE');
  if (job.state === 'queued') await dispatch(String(job.id));
  return job;
}
export async function status(actor: string, courseId: string, tag: string, id: string) {
  if (!actor) fail(401, 'UNAUTHENTICATED');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    fail(422, 'INVALID_JOB');
  if (!(await canManageCourse(actor, courseId))) fail(403, 'FORBIDDEN');
  const job = await Jobs.findOne({ id: id, courseId, revisionTag: tag });
  if (!job || Array.isArray(job)) fail(404, 'NOT_FOUND');
  return job;
}
export async function cancel(actor: string, courseId: string, tag: string, id: string) {
  await status(actor, courseId, tag, id);
  await Jobs.updateOne(
    { id: id, state: { $in: ['queued', 'running'] } },
    { $set: { state: 'cancelled', finishedAt: new Date() } }
  );
  return status(actor, courseId, tag, id);
}
export async function processJob(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return;
  const claim = crypto.randomUUID();
  const job = await Jobs.findOneAndUpdate(
    { id: id, state: 'queued' },
    { $set: { state: 'running', claim, startedAt: new Date() } },
    { new: true }
  );
  if (!job) return;
  let dispatched = false;
  try {
    const draft = await snapshot(job.actor, job.courseId, job.revisionTag, job.draftVersion);
    if (String(draft.id) !== job.revisionId) fail(409, 'DRAFT_CHANGED');
    const { manifest, region } = await inspect(draft, job.documentId, job.regionId);
    if (region.cropHash !== job.cropHash || region.documentHash !== job.documentHash)
      fail(409, 'SOURCE_CHANGED');
    await prerequisites(job.actor, job.courseId, job.documentHash, job.model);
    if (!(await Jobs.exists({ id: id, state: 'running', claim }))) return;
    dispatched = true;
    const { data } = await aiClient.post(
      '/api/ai/sources/recognize-formula',
      { ...manifest, jobId: id },
      { timeout: 40000, maxContentLength: 131072 }
    );
    const p = data.proposal;
    if (
      typeof data.modelVersion !== 'string' ||
      !data.modelVersion ||
      data.modelVersion.length > 256 ||
      !Number.isSafeInteger(data.usage?.totalTokens) ||
      data.usage.totalTokens < 0 ||
      data.usage.totalTokens > 65536 ||
      p?.source?.page !== region.page ||
      JSON.stringify(p?.source?.bbox) !== JSON.stringify(region.bbox) ||
      p?.source?.source_sha256 !== job.documentHash ||
      p.source.region_id !== job.regionId ||
      p.source.document_id !== job.documentId ||
      p.source.revision_id !== job.revisionTag ||
      p.provider !== 'gemini' ||
      p.model !== job.model ||
      p.review_disposition !== 'pending'
    )
      fail(503, 'INVALID_PROPOSAL');
    if (p.response.status !== 'proposed') fail(422, 'UNRESOLVED');
    validateCorrection(p.response.content);
    await Jobs.updateOne({ id: id, claim }, { $set: { usage: data.usage, result: p } });
    await snapshot(job.actor, job.courseId, job.revisionTag, job.draftVersion);
    await prerequisites(job.actor, job.courseId, job.documentHash, job.model);
    if (!(await Jobs.exists({ id: id, state: 'running', claim }))) return;
    const identity = digest([job.identity, p.proposal_sha256]);
    const saved = await FormulaProposal.findOneAndUpdate(
      { identity },
      {
        $setOnInsert: {
          identity,
          courseId: job.courseId,
          revisionId: job.revisionId,
          revisionTag: job.revisionTag,
          draftVersion: job.draftVersion,
          documentId: job.documentId,
          documentHash: job.documentHash,
          regionId: job.regionId,
          page: region.page,
          bbox: region.bbox,
          sourceText: region.text,
          cropHash: region.cropHash,
          provider: p.provider,
          model: p.model,
          modelVersion: data.modelVersion,
          recognitionJobId: id,
          usage: data.usage,
          latex: p.response.content,
          warnings: p.validation.syntax_warnings,
          state: 'pending',
          reviewVersion: 0,
          history: []
        }
      },
      { upsert: true, new: true }
    );
    await Jobs.updateOne(
      { id: id, state: 'running', claim },
      {
        $set: {
          state: 'completed',
          proposalId: String(saved?.id),
          usage: data.usage,
          finishedAt: new Date()
        }
      }
    );
  } catch (e) {
    const status = (e as { status?: number }).status;
    await Jobs.updateOne(
      { id: id, state: 'running', claim },
      {
        $set: {
          state: status === 409 ? 'stale' : dispatched ? 'uncertain' : 'failed',
          error: status === 409 ? 'DRAFT_CHANGED' : 'RECOGNITION_UNAVAILABLE',
          finishedAt: new Date()
        }
      }
    );
  }
}
export async function recover() {
  // Never repeat a potentially charged call after a crash. Reconcile manually.
  await Jobs.updateMany(
    { state: 'running', startedAt: { $lt: new Date(Date.now() - 120000) } },
    { $set: { state: 'uncertain', error: 'WORKER_INTERRUPTED', finishedAt: new Date() } }
  );
  const queued = await Jobs.find({ state: 'queued' }).limit(100);
  for (const job of queued) await dispatch(String(job.id));
}
