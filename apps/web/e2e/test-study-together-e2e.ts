import { chromium } from '@playwright/test';
import { MongoClient, ObjectId } from 'mongodb';
// @ts-ignore
import bcrypt from 'bcryptjs';
import { spawn, ChildProcess } from 'child_process';
import assert from 'node:assert/strict';

// Self-contained, fully automated Phase E Browser E2E Test Runner
async function main() {
  console.log('--- Starting ED-07 Browser E2E Verification ---');

  const testDbName = `ed07_e2e_browser_${Date.now()}`;
  const mongoUri = `mongodb://127.0.0.1:27018/${testDbName}`;
  const authSecret = 'isolated-browser-test-secret-at-least-32-characters';
  const apiPort = 3005;
  const webPort = 5173;

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db();

  // Create 2 test users in MongoDB
  const hashedPw = await bcrypt.hash('Password!123', 12);
  const userA = {
    id: new ObjectId(),
    email: `habib_e2e_${Date.now()}@ednova.test`,
    name: 'Habib S.'
  };
  const userB = {
    id: new ObjectId(),
    email: `tasnim_e2e_${Date.now()}@ednova.test`,
    name: 'Tasnim K.'
  };

  for (const u of [userA, userB]) {
    await db.collection('users').insertOne({
      _id: u.id,
      email: u.email,
      name: u.name,
      password: hashedPw,
      isVerified: true,
      isActive: true,
      role: 'student',
      tier: 'standard'
    });
  }

  // Import and run Better Auth migration
  const { migrateAuth } = await import('../../api/scripts/migrate-auth');
  await migrateAuth(db, { apply: true });

  // 1. Start NestJS API Server on port 3005
  console.log(`Starting API server on port ${apiPort}...`);
  process.env.PORT = String(apiPort);
  process.env.MONGODB_URI = mongoUri;
  process.env.BETTER_AUTH_SECRET = authSecret;
  process.env.BETTER_AUTH_URL = `http://localhost:${webPort}`;
  process.env.AUTH_TRUSTED_ORIGINS = `http://localhost:${webPort}`;
  process.env.INTERNAL_API_SECRET = 'isolated-browser-test-internal-secret';
  process.env.RABBITMQ_URL = 'amqp://localhost';
  process.env.REDIS_URL = '';
  (process.env as any).NODE_ENV = 'test';

  const { start: startApi } = await import('../../api/src/main');
  const apiRuntime = await startApi({ port: apiPort, workers: false });
  console.log(`API server running on http://127.0.0.1:${apiPort}`);

  // 2. Start Next.js Server on port 5173
  console.log(`Starting Next.js server on port ${webPort}...`);
  const webEnv = {
    ...process.env,
    PORT: String(webPort),
    BACKEND_URL: `http://127.0.0.1:${apiPort}`,
    NEXT_PUBLIC_WS_URL: `ws://127.0.0.1:${apiPort}`,
    MONGODB_URI: mongoUri,
    BETTER_AUTH_SECRET: authSecret,
    BETTER_AUTH_URL: `http://localhost:${webPort}`,
    AUTH_TRUSTED_ORIGINS: `http://localhost:${webPort}`
  };

  const nextProc: ChildProcess = spawn(
    'node',
    ['.next/standalone/apps/web/server.js'],
    {
      cwd: '/home/ashenix/Projects/mindflow/apps/web',
      env: webEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  nextProc.stdout?.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[Next.js stdout] ${line}`);
  });
  nextProc.stderr?.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.warn(`[Next.js stderr] ${line}`);
  });

  // Wait for Next.js server to respond
  let webReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${webPort}/login`);
      if (res.status === 200 || res.status === 302 || res.status === 404) {
        webReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!webReady) {
    throw new Error('Next.js web server failed to become ready');
  }
  console.log(`Next.js web server ready on http://127.0.0.1:${webPort}`);

  // 3. Launch Playwright with two independent browser contexts
  console.log('Launching Playwright Chromium browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/ashenix/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });

  try {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await pageB.addInitScript(() => {
      const NativeSocket = window.WebSocket;
      const sockets: WebSocket[] = [];
      Object.assign(window, { ed07Sockets: sockets });
      window.WebSocket = class extends NativeSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          sockets.push(this);
        }
      };
    });
    const socketUrls: string[] = [];
    pageA.on('websocket', (socket) => socketUrls.push(socket.url()));
    pageB.on('websocket', (socket) => socketUrls.push(socket.url()));

    pageA.on('console', (msg) => console.log('[Browser A console]', msg.text()));
    pageA.on('pageerror', (err) => console.error('[Browser A pageerror]', err));
    pageB.on('console', (msg) => console.log('[Browser B console]', msg.text()));
    pageB.on('pageerror', (err) => console.error('[Browser B pageerror]', err));

    // Helper: Login User via Better Auth
    const loginUser = async (page: any, user: { email: string; name: string }) => {
      await page.goto(`http://localhost:${webPort}/login`);
      await page.locator('input[name="email"]').fill(user.email);
      await page.locator('input[name="password"]').fill('Password!123');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/dashboard/, { timeout: 15000 });
    };

    console.log('Logging in User A (Habib S.)...');
    await loginUser(pageA, userA);

    console.log('Logging in User B (Tasnim K.)...');
    await loginUser(pageB, userB);

    // ── Phase 1: User A Creates Room ──────────────────────────────────────────
    console.log('Step 1: User A navigates to /study-together and creates room...');
    await pageA.goto(`http://localhost:${webPort}/study-together`);
    await pageA.waitForSelector('text=Better questions, together');

    // Click "Create room" button
    await pageA.locator('button:has-text("Create room")').click();

    // Verify redirected to /study-together/[sessionId]
    await pageA.waitForURL(/\/study-together\/room_/, { timeout: 15000 });
    const roomUrl = pageA.url();
    const roomId = roomUrl.split('/').pop();
    console.log(`Room created: ${roomId}`);

    // Print rendered text for debugging
    const pageText = await pageA.locator('body').innerText();
    console.log('User A page content after creation:\n' + pageText);

    // Wait for WebSocket connection badge
    await pageA.waitForSelector('text=connected', { timeout: 10000 });
    console.log('User A connected to room WebSocket');

    // Extract the 6-character invite code from the top state bar
    const inviteCodeElement = await pageA.waitForSelector('code', { timeout: 5000 });
    const inviteCode = (await inviteCodeElement.textContent())?.trim();
    assert.ok(inviteCode, 'Invite code must be displayed on screen');
    assert.match(inviteCode, /^[A-Z0-9]{6}$/, 'Invite code must be 6 uppercase alphanumeric chars');
    console.log(`Extracted Invite Code: ${inviteCode}`);

    // Verify User A sees Presenter Controls
    await pageA.waitForSelector('text=Presenter Controls');
    console.log('User A has Presenter Controls verified');

    // ── Phase 2: User B Joins Room via Invite Code ───────────────────────────
    console.log('Step 2: User B joins room using invite code...');
    await pageB.goto(`http://localhost:${webPort}/study-together`);
    await pageB.waitForSelector('input[name="code"]');
    await pageB.locator('input[name="code"]').fill(inviteCode);
    await pageB.locator('button:has-text("Join room")').click();

    // Verify User B is redirected to the same room URL
    await pageB.waitForURL(new RegExp(`/study-together/${roomId}`), { timeout: 15000 });
    await pageB.waitForSelector('text=connected', { timeout: 10000 });
    console.log('User B connected to room WebSocket');

    // Authorization check: User B (peer) must NOT see Presenter Controls
    const presenterControlsOnB = await pageB.locator('text=Presenter Controls').count();
    assert.equal(presenterControlsOnB, 0, 'Peer User B must NOT have Presenter Controls rendered');
    console.log('Security check passed: User B cannot access Presenter Controls');

    console.log('User A page content after User B join:\n' + await pageA.locator('body').innerText());

    // Check participant list sync without page refresh on User A
    await pageA.waitForSelector(`text=${userB.name}`, { timeout: 5000 });
    console.log('Real-time sync verified: User A sees User B join without refresh');

    // ── Phase 3: Presenter advances to Peer Discussion ───────────────────────
    console.log('Step 3: User A advances to Peer Discussion...');
    await pageA.locator('button:has-text("Start Peer Discussion")').click();

    // Verify User A updates
    await pageA.waitForSelector('text=Peer Discussion', { timeout: 5000 });

    // Verify User B receives update via WebSocket WITHOUT REFRESH
    await pageB.waitForSelector('text=Peer Discussion', { timeout: 5000 });
    await pageB.waitForSelector('text=Discuss the concept with your peers', { timeout: 5000 });
    console.log('Real-time sync verified: User B received Peer Discussion phase via WebSocket without refresh');

    // ── Phase 4: Presenter advances to Individual Practice ───────────────────
    console.log('Step 4: User A opens Individual Attempt...');
    await pageA.locator('button:has-text("Open Individual Attempt")').click();

    // Both users should update to Individual Practice without refresh
    await pageA.waitForSelector('text=Individual Practice', { timeout: 5000 });
    await pageB.waitForSelector('text=Individual Practice', { timeout: 5000 });
    console.log('Both participants transitioned to Individual Practice');

    // Verify initial submission progress: 0 / 2
    await pageA.waitForSelector('text=0 / 2', { timeout: 5000 });
    await pageB.waitForSelector('text=0 / 2', { timeout: 5000 });

    // Verify privacy: No private answers or solutions leaked in DOM
    const bodyA = await pageA.content();
    const bodyB = await pageB.content();
    assert.ok(!bodyA.includes('solutionKey'), 'No solution keys in User A DOM');
    assert.ok(!bodyB.includes('solutionKey'), 'No solution keys in User B DOM');

    // Missing learning integration must be explicit, with no fake accepted attempt.
    console.log('Step 5: Verify unavailable assessment, presenter denial, and reconnect...');
    await pageB.getByText('Private activity submission is unavailable', { exact: false }).waitFor();
    assert.equal(await pageB.getByRole('button', { name: 'Submit My Answer', exact: true }).count(), 0);
    const denied = await contextB.request.put(`http://localhost:${apiPort}/api/v1/study/rooms/${roomId}/phase`, {
      headers: { origin: `http://localhost:${webPort}` }, data: { currentPhase: 'debrief' }
    });
    assert.equal(denied.status(), 403, 'Peer HTTP command must be rejected by NestJS');
    await contextB.setOffline(true);
    await pageB.evaluate(() => {
      const state = window as unknown as { ed07Sockets: WebSocket[] };
      state.ed07Sockets.forEach((socket) => socket.close());
    });
    await pageA.getByRole('button', { name: 'Start Peer Discussion', exact: true }).click();
    await pageA.getByText('Peer Discussion', { exact: true }).waitFor();
    await contextB.setOffline(false);
    await pageB.getByText('Peer Discussion', { exact: true }).waitFor({ timeout: 15000 });
    await pageB.getByText('connected', { exact: true }).waitFor();
    for (const url of socketUrls) assert.equal(new URL(url).searchParams.has('token'), false);
    for (const cookie of await contextA.cookies()) {
      if (cookie.name.includes('session_token')) {
        assert.equal(cookie.httpOnly, true);
        assert.ok(!(await pageA.content()).includes(cookie.value), 'Session cookie must not appear in serialized page props');
        assert.ok(!(await pageA.evaluate(() => document.cookie)).includes(cookie.value));
      }
    }
    const persisted = await db.collection('study_rooms').findOne({ roomId });
    assert.ok(persisted?.participants.every((p: { hasSubmitted: boolean }) => !p.hasSubmitted));
    assert.equal(persisted?.commandReceipts.length, 5, 'Create, join and three phase commands must use durable receipts');
    assert.ok(persisted?.commandReceipts.every((r: { payloadHash: string }) => /^[a-f0-9]{64}$/.test(r.payloadHash)));
    console.log('PASS: backend presenter denial, actual browser reconnect, no session cookie disclosure, no false completion');

    // ── Phase 6: Move to Debrief ─────────────────────────────────────────────
    console.log('Step 6: User A transitions to Group Debrief...');
    await pageA.locator('button:has-text("Move to Debrief")').click();

    await pageA.waitForSelector('text=Group Debrief', { timeout: 5000 });
    await pageB.waitForSelector('text=Group Debrief', { timeout: 5000 });
    console.log('Real-time sync verified: Group Debrief active on both clients without refresh');

    // ── Phase 7: Leave Room ──────────────────────────────────────────────────
    console.log('Step 7: User A leaves the room...');
    await pageA.locator('button:has-text("Leave room")').click();
    await pageA.waitForURL(/\/study-together$/, { timeout: 10000 });
    console.log('User A cleanly left room and navigated to /study-together');

    console.log('PASS: ED-07 room stabilization browser scenario. Activity/source/assessment acceptance remains BLOCKED.');
  } finally {
    await browser.close();
    nextProc.kill('SIGTERM');
    await apiRuntime.stop();
    await db.dropDatabase();
    await mongoClient.close();
  }
}

main().catch((err) => {
  console.error('❌ Browser E2E Test Failed:', err);
  process.exit(1);
});
