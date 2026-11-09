/**
 * Durable LLM spend ledger (`llm_approval_budgets`), owned by the API.
 *
 * Every mutation is a single conditional UPDATE, so two concurrent callers can
 * never both win the last of a budget, and nothing is read-then-written. Both
 * the Node planner (`planningBudget.ts`) and the Python AI service — through the
 * `/internal/budget/*` routes — go through here, which keeps one writer for the
 * table instead of two services debiting it independently.
 *
 * Rules inherited from the Mongo-era ledger and kept as-is:
 *   - reserve *before* dispatch; an uncertain write never authorises a call
 *   - a reservation is never released on an uncertain outcome
 *   - an approval id is bound to its task, model, limit and expiry
 */
import { prisma } from '../../../../shared/database';

/** The operator approval as the AI service holds it (`LLM_APPROVALS_JSON`). */
export interface Approval {
  approvalId: string;
  task: string;
  model: string;
  maxRequests: number;
  expiresAt: number;
  maxTokens?: number;
  maxCostUsd?: number;
}

const nowSeconds = () => Date.now() / 1000;

/** An approval's identity: the columns that may never differ for one id. */
function identity(approval: Approval) {
  return {
    id: approval.approvalId,
    task: approval.task,
    model: approval.model,
    limitRequests: approval.maxRequests,
    expiresAt: approval.expiresAt,
    maxTokens: approval.maxTokens ?? null,
    maxCostUsd: approval.maxCostUsd ?? null
  };
}

/** Create the ledger row on first use; a concurrent creator is harmless. */
async function ensureRow(approval: Approval): Promise<void> {
  await prisma.llmApprovalBudget.createMany({
    data: [
      {
        ...identity(approval)
      }
    ],
    skipDuplicates: true
  });
}

/** Reserve one request. True only when this exact approval has room left. */
export async function reserveRequest(approval: Approval): Promise<boolean> {
  await ensureRow(approval);
  const result = await prisma.llmApprovalBudget.updateMany({
    where: {
      ...identity(approval),
      expiresAt: { equals: approval.expiresAt, gt: nowSeconds() },
      used: { lt: approval.maxRequests },
      revokedAt: null,
      ...(approval.maxTokens !== undefined && { usedTokens: { lt: approval.maxTokens } }),
      ...(approval.maxCostUsd !== undefined && { usedCostUsd: { lt: approval.maxCostUsd } })
    },
    data: { used: { increment: 1 } }
  });
  return result.count === 1;
}

/** Reserve a token allowance on an existing, live approval. */
export async function reserveTokens(approval: Approval, tokens: number): Promise<boolean> {
  if (!Number.isSafeInteger(tokens) || tokens <= 0) return false;
  if (!Number.isSafeInteger(approval.maxTokens) || (approval.maxTokens as number) < tokens)
    return false;
  const maxTokens = approval.maxTokens as number;
  const result = await prisma.llmApprovalBudget.updateMany({
    where: {
      id: approval.approvalId,
      task: approval.task,
      model: approval.model,
      limitRequests: approval.maxRequests,
      maxTokens,
      maxCostUsd: approval.maxCostUsd ?? null,
      expiresAt: { equals: approval.expiresAt, gt: nowSeconds() },
      revokedAt: null,
      usedTokens: { lte: maxTokens - tokens }
    },
    data: { usedTokens: { increment: tokens } }
  });
  return result.count === 1;
}

/** Record measured usage after a call. */
export async function recordUsage(
  approvalId: string,
  tokens: number,
  costUsd: number
): Promise<boolean> {
  const data: { usedTokens?: { increment: number }; usedCostUsd?: { increment: number } } = {};
  if (tokens > 0) data.usedTokens = { increment: tokens };
  if (costUsd > 0) data.usedCostUsd = { increment: costUsd };
  if (!data.usedTokens && !data.usedCostUsd) return true;
  await prisma.llmApprovalBudget.updateMany({ where: { id: approvalId }, data });
  return true;
}

/** Revoke an approval; true when it was live and is now revoked. */
export async function revoke(approvalId: string, reason: string): Promise<boolean> {
  const result = await prisma.llmApprovalBudget.updateMany({
    where: { id: approvalId, revokedAt: null },
    data: { revokedAt: nowSeconds(), revocationReason: reason }
  });
  return result.count > 0;
}

/** Whether a reserved approval is still live (checked before dispatch and delivery). */
export async function stillActive(approval: Approval): Promise<boolean> {
  const row = await prisma.llmApprovalBudget.findFirst({
    where: {
      ...identity(approval),
      expiresAt: { equals: approval.expiresAt, gt: nowSeconds() },
      used: { gte: 1 },
      revokedAt: null
    },
    select: { id: true }
  });
  return row !== null;
}

/** Usage and revocation state for diagnostics. Never contains credentials. */
export async function status(approvalId: string) {
  const row = await prisma.llmApprovalBudget.findUnique({ where: { id: approvalId } });
  if (!row) return null;
  return {
    approvalId: row.id,
    task: row.task,
    model: row.model,
    usedRequests: row.used,
    limitRequests: row.limitRequests,
    usedTokens: row.usedTokens,
    limitTokens: row.maxTokens,
    usedCostUsd: row.usedCostUsd,
    limitCostUsd: row.maxCostUsd,
    revoked: row.revokedAt !== null,
    revocationReason: row.revocationReason,
    expiresAt: row.expiresAt
  };
}
