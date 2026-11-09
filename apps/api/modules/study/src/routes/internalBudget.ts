import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { prisma } from '../../../../shared/database';
import * as ledger from '../services/llmBudget';

/**
 * Service-to-service access to the LLM spend ledger and to the reservation the
 * API already holds for an experience-planner attempt.
 *
 * The Python AI service used to debit `llm_approval_budgets` directly in its own
 * database. The API owns that table now, so every mutation is a request here and
 * the conditional UPDATE lives next to the schema. A transport or database
 * failure answers 503 and the caller treats that as "no" — an uncertain write
 * never authorises a call.
 */

const isText = (value: unknown, max = 200): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= max;
const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function parseApproval(body: unknown): ledger.Approval | null {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const approval = (
    input.approval && typeof input.approval === 'object' ? input.approval : {}
  ) as Record<string, unknown>;
  if (
    !isText(approval.approvalId) ||
    !isText(approval.task, 100) ||
    !isText(approval.model, 200) ||
    !isPositiveInt(approval.maxRequests) ||
    typeof approval.expiresAt !== 'number' ||
    !Number.isFinite(approval.expiresAt)
  )
    return null;
  if (approval.maxTokens !== undefined && !isPositiveInt(approval.maxTokens)) return null;
  if (
    approval.maxCostUsd !== undefined &&
    !(
      typeof approval.maxCostUsd === 'number' &&
      Number.isFinite(approval.maxCostUsd) &&
      approval.maxCostUsd > 0
    )
  )
    return null;
  return approval as unknown as ledger.Approval;
}

async function guarded(res: Response, run: () => Promise<unknown>) {
  try {
    return res.json(await run());
  } catch {
    return res.status(503).json({ error: 'Budget unavailable' });
  }
}

/** POST /internal/budget/reserve { approval } → { reserved } */
export async function reserve(req: DomainRequest, res: Response) {
  const approval = parseApproval(req.body);
  if (!approval) return res.status(400).json({ error: 'Invalid approval' });
  return guarded(res, async () => ({ reserved: await ledger.reserveRequest(approval) }));
}

/** POST /internal/budget/reserve-tokens { approval, tokens } → { reserved } */
export async function reserveTokens(req: DomainRequest, res: Response) {
  const approval = parseApproval(req.body);
  const tokens = (req.body as { tokens?: unknown } | undefined)?.tokens;
  if (!approval || !isPositiveInt(tokens))
    return res.status(400).json({ error: 'Invalid request' });
  return guarded(res, async () => ({ reserved: await ledger.reserveTokens(approval, tokens) }));
}

/** POST /internal/budget/active { approval } → { active } */
export async function active(req: DomainRequest, res: Response) {
  const approval = parseApproval(req.body);
  if (!approval) return res.status(400).json({ error: 'Invalid approval' });
  return guarded(res, async () => ({ active: await ledger.stillActive(approval) }));
}

/** POST /internal/budget/usage { approvalId, tokens, costUsd } → { recorded } */
export async function usage(req: DomainRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  const tokens = body.tokens === undefined ? 0 : body.tokens;
  const costUsd = body.costUsd === undefined ? 0 : body.costUsd;
  if (
    !isText(body.approvalId) ||
    typeof tokens !== 'number' ||
    !Number.isSafeInteger(tokens) ||
    tokens < 0 ||
    typeof costUsd !== 'number' ||
    !Number.isFinite(costUsd) ||
    costUsd < 0
  )
    return res.status(400).json({ error: 'Invalid request' });
  return guarded(res, async () => ({
    recorded: await ledger.recordUsage(body.approvalId as string, tokens, costUsd)
  }));
}

/** POST /internal/budget/revoke { approvalId, reason } → { revoked } */
export async function revoke(req: DomainRequest, res: Response) {
  const body = (req.body || {}) as Record<string, unknown>;
  if (!isText(body.approvalId)) return res.status(400).json({ error: 'Invalid request' });
  const reason = isText(body.reason, 200) ? body.reason : 'operator_revocation';
  return guarded(res, async () => ({
    revoked: await ledger.revoke(body.approvalId as string, reason)
  }));
}

/** GET /internal/budget/:approvalId → status or 404 */
export async function budgetStatus(req: DomainRequest, res: Response) {
  const approvalId = typeof req.params.approvalId === 'string' ? req.params.approvalId : '';
  if (!isText(approvalId)) return res.status(400).json({ error: 'approvalId is required' });
  try {
    const row = await ledger.status(approvalId);
    return row ? res.json(row) : res.status(404).json({ error: 'Approval not found' });
  } catch {
    return res.status(503).json({ error: 'Budget unavailable' });
  }
}

/**
 * GET /internal/experience/requests/:requestId/reservation
 * → { approvalId, reservedTokens, state } or 404
 *
 * The experience planner verifies, read-only, that this exact attempt already
 * holds a reservation. The answer comes from the API's own request row — never
 * from the caller.
 */
export async function experienceReservation(req: DomainRequest, res: Response) {
  const requestId = typeof req.params.requestId === 'string' ? req.params.requestId : '';
  if (!isText(requestId)) return res.status(400).json({ error: 'requestId is required' });
  try {
    const row = await prisma.experiencePlanRequest.findFirst({
      where: { requestId },
      select: { approvalId: true, reservedTokens: true, state: true }
    });
    return row ? res.json(row) : res.status(404).json({ error: 'Request not found' });
  } catch {
    return res.status(503).json({ error: 'Request unavailable' });
  }
}

export default {
  reserve,
  reserveTokens,
  active,
  usage,
  revoke,
  budgetStatus,
  experienceReservation
};
