/** Batch 4 M4.5 Phase E: cross-process idempotency evidence.
 *
 * The M4.3 accounting defect escaped because each layer was tested alone. This
 * goes one step further than concurrent promises: it spawns **independent Node
 * processes** that each claim the same request identity against one real
 * MongoDB. A process-local mutex would pass a single-process test and fail
 * here; the unique identity index is what actually holds.
 *
 * Requires the API to be built (`pnpm --filter api build`), because the workers
 * import the compiled modules.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { MongoClient } from 'mongodb';

const URI = process.env.M45_MONGO || 'mongodb://127.0.0.1:27017';
const RUN = crypto.randomBytes(4).toString('hex');
const DB = `test_m45_conc_${RUN}`;
const APPROVAL = `m45-approval-${RUN}`;
const MODEL = 'gemini/gemini-3.6-flash';
const MAX = 1_000_000;
const RESERVED = 32_768;
const EXPIRES = Math.floor(Date.now() / 1000) + 3600;

type Row = {
  scenario: string;
  processes: number;
  reserved: number;
  duplicate: number;
  request_rows: number;
  used_tokens: number;
  expected_used_tokens: number;
  result: 'PASS' | 'FAIL';
};

const rows: Row[] = [];
let client: MongoClient;

async function reset() {
  await client
    .db(DB)
    .dropDatabase()
    .catch(() => undefined);
  await client
    .db(DB)
    .collection('llm_approval_budgets')
    .insertOne({
      id: APPROVAL as never,
      task: 'experience_planning',
      model: MODEL,
      limit: 10,
      maxTokens: MAX,
      expiresAt: EXPIRES,
      usedTokens: 0,
      usedRequests: 0
    });
}

const used = async (): Promise<number> => {
  const row = await client
    .db(DB)
    .collection('llm_approval_budgets')
    .findOne({ id: APPROVAL as never });
  return Number(row?.usedTokens ?? 0);
};
const requestRows = (): Promise<number> =>
  client.db(DB).collection('experience_plan_requests').countDocuments();

/** The worker is a real file, spawned with `--import tsx`. Generating it as a
 * string was fragile and is not what production runs. */
const WORKER = path.join(__dirname, 'm45-identity-worker.ts');

function runWorker(identity: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['--import', 'tsx', '--no-warnings', WORKER], {
      env: {
        ...process.env,
        M45_IDENTITY: identity,
        M45_MONGO: URI,
        M45_DB: DB,
        M45_APPROVAL: APPROVAL,
        M45_EXPIRES: String(EXPIRES)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    proc.stdout.on('data', (chunk: Buffer) => (out += String(chunk)));
    proc.stderr.on('data', (chunk: Buffer) => (err += String(chunk)));
    proc.once('error', reject);
    proc.once('exit', () => {
      const verdict = out.trim();
      if (verdict) resolve(verdict);
      else reject(new Error(err.slice(0, 400) || 'worker produced no verdict'));
    });
  });
}

async function scenario(count: number) {
  await reset();
  const identity = `sha256:${crypto.randomBytes(32).toString('hex')}`;
  // Spawn every process before awaiting any — genuinely parallel.
  const results = await Promise.all(Array.from({ length: count }, () => runWorker(identity)));
  const reserved = results.filter((entry) => entry === 'reserved').length;
  const duplicate = results.filter((entry) => entry === 'duplicate').length;
  const request_rows = await requestRows();
  const used_tokens = await used();
  rows.push({
    scenario: `${count} independent processes, same identity`,
    processes: count,
    reserved,
    duplicate,
    request_rows,
    used_tokens,
    expected_used_tokens: RESERVED,
    result: reserved === 1 && request_rows === 1 && used_tokens === RESERVED ? 'PASS' : 'FAIL'
  });
}

async function main() {
  client = new MongoClient(URI, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  try {
    await scenario(2);
    await scenario(5);
  } finally {
    await client
      .db(DB)
      .dropDatabase()
      .catch(() => undefined);
    await client.close();
  }

  console.table(rows);
  const failures = rows.filter((row) => row.result === 'FAIL');
  console.log(
    JSON.stringify({
      run: RUN,
      scenarios: rows.length,
      passed: rows.length - failures.length,
      failed: failures.length
    })
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
