import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { prisma } from '../../../../shared/database';

/**
 * Controls the Python recognition transport must confirm before it contacts the
 * provider: the running job, the provider's free-tier eligibility and the owner's
 * source consent. They live in the API's tables; the transport used to read them
 * from MongoDB directly. Answers carry only what the transport needs.
 */

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

async function eligibility(where: { id?: string; model: string; keySha256?: string }) {
  return prisma.formulaProviderEligibility.findFirst({
    where: {
      ...where,
      provider: 'gemini',
      freeTier: true,
      billingAttached: false,
      expiresAt: { gt: new Date() },
      NOT: { revoked: true }
    }
  });
}

async function consentFor(match: (payload: Record<string, unknown>) => boolean, id?: string) {
  const rows = id
    ? await prisma.formulaSourceConsent.findMany({ where: { id } })
    : await prisma.formulaSourceConsent.findMany();
  return rows.find((row) => match((row.payload ?? {}) as Record<string, unknown>));
}

/**
 * POST /internal/formula/recognition-context
 * { jobId, courseId, revisionId, documentId, regionId }
 * → { job: { model, documentHash, cropHash }, eligibleId, keySha256, consentId }
 *   409 when the job is not the running one for that region, 503 when the
 *   eligibility or consent controls are missing.
 */
export async function recognitionContext(req: DomainRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  const jobId = text(body.jobId);
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });
  try {
    const job = await prisma.formulaRecognitionJob.findFirst({
      where: { id: jobId, state: 'running' }
    });
    if (
      !job ||
      job.courseId !== text(body.courseId) ||
      job.revisionTag !== text(body.revisionId) ||
      job.documentId !== text(body.documentId) ||
      job.regionId !== text(body.regionId)
    )
      return res.status(409).json({ error: 'Recognition job unavailable' });

    const eligible = await eligibility({ model: job.model });
    const consent = await consentFor(
      (payload) =>
        payload.courseId === job.courseId &&
        payload.documentHash === job.documentHash &&
        payload.provider === 'gemini' &&
        payload.revoked === false
    );
    if (!eligible || !consent)
      return res.status(503).json({ error: 'Recognition controls unavailable' });

    return res.json({
      job: { model: job.model, documentHash: job.documentHash, cropHash: job.cropHash },
      eligibleId: eligible.id,
      keySha256: eligible.keySha256,
      consentId: consent.id
    });
  } catch {
    return res.status(503).json({ error: 'Recognition controls unavailable' });
  }
}

/**
 * POST /internal/formula/recognition-recheck
 * { jobId, model, eligibleId, keySha256, consentId } → { jobRunning, controlsHold }
 *
 * Crop rendering takes time; a cancellation or a revocation meanwhile must block
 * dispatch, so the transport asks again immediately before it.
 */
export async function recognitionRecheck(req: DomainRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  const jobId = text(body.jobId);
  const consentId = text(body.consentId);
  const eligibleId = text(body.eligibleId);
  if (!jobId || !consentId || !eligibleId)
    return res.status(400).json({ error: 'jobId, consentId and eligibleId are required' });
  try {
    const job = await prisma.formulaRecognitionJob.findFirst({
      where: { id: jobId, state: 'running' },
      select: { id: true }
    });
    const consent = await consentFor((payload) => payload.revoked === false, consentId);
    const eligible = await eligibility({
      id: eligibleId,
      model: text(body.model),
      keySha256: text(body.keySha256)
    });
    return res.json({ jobRunning: Boolean(job), controlsHold: Boolean(consent && eligible) });
  } catch {
    return res.status(503).json({ error: 'Recognition controls unavailable' });
  }
}

export default { recognitionContext, recognitionRecheck };
