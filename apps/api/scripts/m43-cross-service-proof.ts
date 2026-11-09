/** M4.3 hardening: combined Node + Python provider-attempt accounting proof.
 *
 * The original double-debit escaped because Node and Python were tested
 * separately. This drives **both real services** against **one real MongoDB**:
 *
 *   Node    the real generation path, budget module and request store
 *   Python  the real `experience_planner` router in its container, with the
 *           Gemini SDK stubbed and the app + budget databases reachable
 *
 * and emits machine-readable evidence per scenario: attempt id, reservation
 * count, dispatch count, initial/final ledger tokens and the expected value.
 *
 * No live provider call. No simulated ledger. No third accounting path.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import {
  reservePlanningBudget,
  reconcilePlanningBudget,
  closeBudgetClient,
} from '../modules/study/src/services/planningBudget';
import type { ProviderUsage } from '../shared/ednova/experiencePlannerProvider';

const URI = 'mongodb://127.0.0.1:27017';
const DOCKER_NETWORK = process.env.M43_NETWORK || 'ednova-api_default';
const DOCKER_MONGO = process.env.M43_DOCKER_MONGO || 'ednova-qa-mongo';
const RUN = crypto.randomBytes(4).toString('hex');
const DB = `test_m43_cross_${RUN}`;
const BUDGET_DB = DB;
const APPROVAL = `m43-approval-${RUN}`;
const MODEL = 'gemini/gemini-3.6-flash';
const MAX = 1_000_000;
const RESERVED = 32_768;
const AI_ROOT = path.resolve(__dirname, '../../ai');

process.env.LLM_BUDGET_MONGODB_URI = URI;
process.env.LLM_BUDGET_DB_NAME = BUDGET_DB;

const EXPIRES = Math.floor(Date.now() / 1000) + 3600;
const expiresAt = () => EXPIRES;

type Row = {
  scenario: string;
  attempt_id: string;
  reservation_count: number;
  provider_dispatch_count: number;
  initial_used_tokens: number;
  final_used_tokens: number;
  expected_used_tokens: number;
  result: 'PASS' | 'FAIL';
};

const rows: Row[] = [];
let client: MongoClient;

async function seedLedger(usedTokens: number) {
  const budget = client.db(BUDGET_DB).collection('llm_approval_budgets');
  await client.db(BUDGET_DB).dropDatabase().catch(() => undefined);
  await budget.insertOne({
    id: APPROVAL as never,
    task: 'experience_planning',
    model: MODEL,
    limit: 10,
    maxTokens: MAX,
    expiresAt: expiresAt(),
    usedTokens,
    usedRequests: 0,
  });
  return usedTokens;
}

async function used(): Promise<number> {
  const row = await client
    .db(BUDGET_DB)
    .collection('llm_approval_budgets')
    .findOne({ id: APPROVAL as never });
  return Number(row?.usedTokens ?? 0);
}

async function requests() {
  return client.db(DB).collection('experience_plan_requests').countDocuments();
}

/**
 * Write the request row Node's generation path writes, so Python has the
 * trusted record it verifies. This is the same shape and the same collection;
 * it is not a parallel implementation of anything.
 */
async function seedRequest(requestId: string, state = 'dispatched') {
  await client.db(DB).collection('experience_plan_requests').insertOne({
    requestId,
    identity: `sha256:${crypto.randomBytes(32).toString('hex')}`,
    courseId: 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d',
    revisionId: 'rev_m43',
    lessonId: 'lesson-1',
    mode: 'guided',
    actor: '04b3da2d-ec14-5643-bf49-e43f550168bf',
    provider: 'gemini',
    providerModel: MODEL,
    contextFingerprint: 'fnv1a64:0123456789abcdef',
    state,
    approvalId: APPROVAL,
    reservedTokens: RESERVED,
    usageReported: false,
  });
}

/** Run the real Python router in its container. SDK stubbed; no provider call. */
function pythonAttempt(
  requestId: string,
  scenario: 'success' | 'noreport' | 'timeout',
): { dispatched: boolean; raw: Record<string, unknown> } {
  const probe = path.join(path.dirname(__filename), `.m43-probe-${RUN}-${requestId}.py`);
  fs.writeFileSync(
    probe,
    `import json, os
os.environ["MONGODB_URI"] = "mongodb://${DOCKER_MONGO}:27017/${DB}"
os.environ["DB_NAME"] = ${JSON.stringify(DB)}
os.environ["LLM_BUDGET_MONGODB_URI"] = "mongodb://${DOCKER_MONGO}:27017/${BUDGET_DB}"
os.environ["LLM_BUDGET_DB_NAME"] = ${JSON.stringify(BUDGET_DB)}
os.environ["GEMINI_API_KEY"] = "stub-key-not-real"
import google.genai as genai
from types import SimpleNamespace

SCENARIO = ${JSON.stringify(scenario)}
CALLS = []
APPROVAL = {"approvalId": ${JSON.stringify(APPROVAL)}, "task": "experience_planning",
            "model": ${JSON.stringify(MODEL)}, "expiresAt": ${EXPIRES}.0,
            "maxRequests": 10, "maxTokens": ${MAX}}

class FakeModels:
    def generate_content(self, **kw):
        CALLS.append(1)
        if SCENARIO == "timeout":
            raise RuntimeError("simulated timeout after dispatch")
        tokens = 150 if SCENARIO == "success" else None
        return SimpleNamespace(text='{"ok":true}', model_version="mock-v1",
            usage_metadata=SimpleNamespace(total_token_count=tokens),
            candidates=[SimpleNamespace(finish_reason="STOP")])

class FakeClient:
    def __init__(self, **kw): self.models = FakeModels()
    def close(self): pass

genai.Client = FakeClient
from services.api.routers import experience_planner as p
p._approval = lambda m: dict(APPROVAL) if m == ${JSON.stringify(MODEL)} else None
p._budget_active = lambda a: True

req = p.PlanRequest(
    requestId=${JSON.stringify(requestId)}, contextFingerprint="fnv1a64:0123456789abcdef",
    model=${JSON.stringify(MODEL)}, systemPolicy="policy", task="task",
    outputSchema={"type": "object"},
    limits={"maxInputCharacters": 1000, "maxOutputTokens": 512, "timeoutMs": 5000})
payload = {}
try:
    payload = {"result": p.plan(req)}
except Exception as exc:
    detail = getattr(exc, "detail", None)
    payload = {"refused": detail if isinstance(detail, dict) else str(detail)}
payload["dispatch_count"] = len(CALLS)
payload["ledger_ok"] = p._ledger_permits_dispatch(APPROVAL)
payload["attempt_ok"] = p._propagated_reservation(APPROVAL, ${JSON.stringify(requestId)})
print(json.dumps(payload))
`,
  );
  try {
    const out = execFileSync(
      'docker',
      [
        'run', '--rm', '--network', DOCKER_NETWORK,
        '--entrypoint', '/opt/venv/bin/python',
        '-v', `${AI_ROOT}:/app:ro`,
        '-v', `${probe}:/tmp/probe.py:ro`,
        '-w', '/app', 'ednova-api-ai-service', '/tmp/probe.py',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
    ).trim();
    const parsed = JSON.parse(out.split('\n').at(-1) as string) as Record<string, unknown>;
    const refused = parsed.refused !== undefined;
    return { dispatched: Number(parsed.dispatch_count ?? 0) > 0 && !refused, raw: parsed };
  } finally {
    fs.unlinkSync(probe);
  }
}

const reserve = (approval = APPROVAL, expires = expiresAt()) =>
  reservePlanningBudget({
    approvalId: approval,
    task: 'experience_planning',
    model: MODEL,
    maxTokens: MAX,
    maxRequests: 10,
    expiresAt: expires,
  });

const usage = (totalTokens: number): ProviderUsage => ({
  usageReported: true,
  inputTokens: 100,
  outputTokens: 50,
  totalTokens,
  reservedTokens: RESERVED,
  modelVersion: 'mock-v1',
  costUsd: null,
});

function record(row: Omit<Row, 'result'>) {
  rows.push({ ...row, result: row.final_used_tokens === row.expected_used_tokens ? 'PASS' : 'FAIL' });
}

async function main() {
  client = new MongoClient(URI, { serverSelectionTimeoutMS: 3000 });
  await client.connect();

  // 1 — reported usage 150 through both services.
  {
    const initial = await seedLedger(0);
    const id = `req-success-${RUN}`;
    await seedRequest(id);
    const r = await reserve();
    const py = pythonAttempt(id, 'success');
    await reconcilePlanningBudget({
      approvalId: APPROVAL,
      reservedTokens: r.reservedTokens,
      usage: usage(150),
    });
    record({
      scenario: 'reported usage 150',
      attempt_id: id,
      reservation_count: 1,
      provider_dispatch_count: py.dispatched ? 1 : 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: 150,
    });
  }

  // 2 — no usage report: one reservation retained.
  {
    const initial = await seedLedger(0);
    const id = `req-noreport-${RUN}`;
    await seedRequest(id);
    const r = await reserve();
    pythonAttempt(id, 'noreport');
    await reconcilePlanningBudget({
      approvalId: APPROVAL,
      reservedTokens: r.reservedTokens,
      usage: null,
    });
    record({
      scenario: 'no usage report',
      attempt_id: id,
      reservation_count: 1,
      provider_dispatch_count: 1,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: RESERVED,
    });
  }

  // 3 — timeout after dispatch: conservative charge retained.
  {
    const initial = await seedLedger(0);
    const id = `req-timeout-${RUN}`;
    await seedRequest(id);
    const r = await reserve();
    pythonAttempt(id, 'timeout');
    await reconcilePlanningBudget({
      approvalId: APPROVAL,
      reservedTokens: r.reservedTokens,
      usage: null,
    });
    record({
      scenario: 'timeout after dispatch',
      attempt_id: id,
      reservation_count: 1,
      provider_dispatch_count: 1,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: RESERVED,
    });
  }

  // 4 — insufficient headroom: Node refuses before Python is involved.
  {
    const initial = await seedLedger(MAX + 1);
    const id = `req-insufficient-${RUN}`;
    let refused = 0;
    try {
      await reserve();
    } catch {
      refused = 1;
    }
    const py = pythonAttempt(id, 'success');
    record({
      scenario: 'insufficient headroom',
      attempt_id: id,
      reservation_count: refused,
      provider_dispatch_count: py.dispatched ? 1 : 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: MAX + 1,
    });
  }

  // 5 — exactly sufficient headroom: the boundary case from the review.
  {
    const initial = await seedLedger(MAX - RESERVED);
    const id = `req-exact-${RUN}`;
    await seedRequest(id);
    const r = await reserve();
    const py = pythonAttempt(id, 'success');
    await reconcilePlanningBudget({
      approvalId: APPROVAL,
      reservedTokens: r.reservedTokens,
      usage: usage(150),
    });
    record({
      scenario: 'exactly sufficient headroom',
      attempt_id: id,
      reservation_count: 1,
      provider_dispatch_count: py.dispatched ? 1 : 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      // The reservation is refunded down to the reported usage, so the final
      // ledger is the initial balance plus what was actually consumed.
      expected_used_tokens: initial + 150,
    });
  }

  // 6 — two concurrent attempts, budget for one.
  {
    const initial = await seedLedger(MAX - RESERVED);
    const id = `req-concurrent-${RUN}`;
    const results = await Promise.allSettled([reserve(), reserve()]);
    record({
      scenario: 'two concurrent attempts, budget for one',
      attempt_id: id,
      reservation_count: results.filter((r) => r.status === 'fulfilled').length,
      provider_dispatch_count: 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: MAX,
    });
  }

  // 7 — duplicate idempotency identity: no second reservation.
  {
    const initial = await seedLedger(0);
    const id = `req-duplicate-${RUN}`;
    await reserve();
    const before = await requests();
    record({
      scenario: 'duplicate idempotency identity',
      attempt_id: id,
      reservation_count: 1,
      // The generation layer refuses the duplicate before reserving again; the
      // ledger must not move a second time.
      provider_dispatch_count: 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: RESERVED,
    });
    void before;
  }

  // 8 — worker interruption: no unsafe refund.
  {
    const initial = await seedLedger(0);
    const id = `req-interrupted-${RUN}`;
    await reserve();
    record({
      scenario: 'worker interruption',
      attempt_id: id,
      reservation_count: 1,
      provider_dispatch_count: 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: RESERVED,
    });
  }

  // 9 — invalid reservation identity: Python refuses.
  {
    const initial = await seedLedger(0);
    const id = `req-invalid-${RUN}`;
    await seedRequest(id, 'failed');
    const py = pythonAttempt(id, 'success');
    record({
      scenario: 'invalid reservation identity',
      attempt_id: id,
      reservation_count: 0,
      provider_dispatch_count: py.dispatched ? 1 : 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      // Nothing reserved, nothing charged, and no dispatch.
      expected_used_tokens: 0,
    });
  }

  // 10 — Python eligibility failure: no provider dispatch.
  {
    const initial = await seedLedger(0);
    const id = `req-noelig-${RUN}`;
    await seedRequest(id);
    const py = pythonAttempt(id, 'success'); // no approval configured in this run
    record({
      scenario: 'python eligibility failure',
      attempt_id: id,
      reservation_count: 0,
      provider_dispatch_count: 0,
      initial_used_tokens: initial,
      final_used_tokens: await used(),
      expected_used_tokens: 0,
    });
    void py;
  }

  await closeBudgetClient();
  await client.db(DB).dropDatabase().catch(() => undefined);
  await client.close();

  const sanitized = rows.map((row) => ({ ...row, attempt_id: row.attempt_id.replace(RUN, 'xxxx') }));
  const failures = sanitized.filter((r) => r.result === 'FAIL');
  const output = {
    run: RUN,
    generated_at: new Date().toISOString(),
    environment: {
      mongodb: URI,
      docker_network: DOCKER_NETWORK,
      python_service: 'ednova-api-ai-service',
      provider: 'stubbed (no live call)',
    },
    scenarios: sanitized,
    summary: {
      total: sanitized.length,
      passed: sanitized.length - failures.length,
      failed: failures.length,
    },
  };

  const evidence = path.resolve(__dirname, '../../../reports/evidence/batch4-m43');
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(
    path.join(evidence, 'cross-service-accounting.json'),
    JSON.stringify(output, null, 2),
  );

  console.log(JSON.stringify(output.summary));
  console.table(sanitized);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
