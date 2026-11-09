import { chromium, type Browser } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
// @ts-ignore
import bcrypt from "bcryptjs";
import { spawn, ChildProcess } from "child_process";
import assert from "node:assert/strict";

// Self-contained, fully automated Presence Browser E2E Test Runner
async function main() {
  console.log("--- Starting ED-07 Browser E2E Verification ---");

  const testDbName = `ed07_presence_browser_${Date.now()}`;
  const mongoUri = `mongodb://127.0.0.1:27018/${testDbName}`;
  const authSecret = "isolated-browser-test-secret-at-least-32-characters";
  const apiPort = 3005;
  const webPort = 5173;

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db();

  let apiRuntime: { stop: () => Promise<void> } | undefined;
  let nextProc: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    // Create 2 test users in MongoDB
    const hashedPw = await bcrypt.hash("Password!123", 12);
    const userA = {
      id: new ObjectId(),
      email: `habib_e2e_${Date.now()}@ednova.test`,
      name: "Habib S.",
    };
    const userB = {
      id: new ObjectId(),
      email: `tasnim_e2e_${Date.now()}@ednova.test`,
      name: "Tasnim K.",
    };

    for (const u of [userA, userB]) {
      await db.collection("users").insertOne({
        id: u.id,
        email: u.email,
        name: u.name,
        password: hashedPw,
        isVerified: true,
        isActive: true,
        role: "student",
        tier: "standard",
      });
    }

    // Import and run Better Auth migration
    const { migrateAuth } = await import("../../api/scripts/migrate-auth");
    await migrateAuth(db, { apply: true });

    // 1. Start NestJS API Server on port 3005
    console.log(`Starting API server on port ${apiPort}...`);
    process.env.PORT = String(apiPort);
    process.env.MONGODB_URI = mongoUri;
    process.env.BETTER_AUTH_SECRET = authSecret;
    process.env.BETTER_AUTH_URL = `http://localhost:${webPort}`;
    process.env.AUTH_TRUSTED_ORIGINS = `http://localhost:${webPort}`;
    process.env.INTERNAL_API_SECRET = "isolated-browser-test-internal-secret";
    process.env.RABBITMQ_URL = "amqp://localhost";
    process.env.REDIS_URL = "";
    (process.env as any).NODE_ENV = "test";

    const { start: startApi } = await import("../../api/src/main");
    apiRuntime = await startApi({ port: apiPort, workers: false });
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
      AUTH_TRUSTED_ORIGINS: `http://localhost:${webPort}`,
    };

    nextProc = spawn("node", [".next/standalone/apps/web/server.js"], {
      cwd: `${process.cwd()}/apps/web`,
      env: webEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    nextProc.stdout?.on("data", (d) => {
      const line = d.toString().trim();
      if (line) console.log(`[Next.js stdout] ${line}`);
    });
    nextProc.stderr?.on("data", (d) => {
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
      throw new Error("Next.js web server failed to become ready");
    }
    console.log(`Next.js web server ready on http://127.0.0.1:${webPort}`);

    // 3. Launch Playwright with two independent browser contexts
    console.log("Launching Playwright Chromium browser...");
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    });
    const contextA = await browser.newContext();
    const contextA2 = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageA2 = await contextA2.newPage();
    const pageB = await contextB.newPage();
    const socketUrls: string[] = [];
    const messagesB: Array<{ type?: string; seq?: number }> = [];
    for (const page of [pageA, pageA2, pageB]) {
      await page.addInitScript(() => {
        const Native = window.WebSocket;
        const sockets: WebSocket[] = [];
        Object.assign(window, { ed07Sockets: sockets });
        window.WebSocket = class extends Native {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            sockets.push(this);
          }
        };
      });
      page.on("websocket", (socket) => {
        socketUrls.push(socket.url());
        if (page === pageB)
          socket.on("framereceived", ({ payload }) => {
            try {
              messagesB.push(JSON.parse(String(payload)));
            } catch {}
          });
      });
    }
    const login = async (page: typeof pageA, actor: typeof userA) => {
      await page.goto(`http://localhost:${webPort}/login`);
      await page.locator('input[name="email"]').fill(actor.email);
      await page.locator('input[name="password"]').fill("Password!123");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/dashboard/);
    };
    const presence = async (
      page: typeof pageA,
      id: ObjectId,
      status: string,
    ) => {
      await page
        .getByTestId(`participant-${id}`)
        .getByLabel(status, { exact: true })
        .waitFor({ timeout: 10000 });
    };
    await login(pageA, userA);
    await login(pageA2, userA);
    await login(pageB, userB);
    await pageA.goto(`http://localhost:${webPort}/study-together`);
    await pageA
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await pageA.waitForURL(/\/study-together\/room_/);
    const roomUrl = pageA.url();
    const roomId = roomUrl.split("/").pop()!;
    const inviteCode = (await pageA
      .getByTestId("invite-code")
      .textContent())!.trim();
    await pageB.goto(`http://localhost:${webPort}/study-together`);
    await pageB.locator('input[name="code"]').fill(inviteCode);
    await pageB.getByRole("button", { name: "Join room", exact: true }).click();
    await pageB.waitForURL(roomUrl);
    await pageA2.goto(roomUrl);
    for (const page of [pageA, pageA2, pageB]) {
      await presence(page, userA.id, "Online");
      await presence(page, userB.id, "Online");
      assert.equal(
        await page.getByTestId(`participant-${userA.id}`).count(),
        1,
      );
    }
    await pageB.screenshot({
      path: "/tmp/ed07-presence/three-contexts.png",
      fullPage: true,
    });
    const initial = await db.collection("study_rooms").findOne({ roomId });
    console.log(
      "PASS three independent authenticated contexts; two users; one roster row per user",
    );
    await pageA2.reload();
    await presence(pageA2, userA.id, "Online");
    assert.deepEqual(
      await db.collection("study_rooms").findOne({ roomId }),
      initial,
    );
    console.log(
      "PASS refresh preserves membership, presenter, durable sequence and receipts",
    );
    await contextA.close();
    await presence(pageB, userA.id, "Online");
    await contextA2.close();
    await presence(pageB, userA.id, "Offline");
    assert.deepEqual(
      await db.collection("study_rooms").findOne({ roomId }),
      initial,
    );
    await pageB.screenshot({
      path: "/tmp/ed07-presence/final-tab-offline.png",
      fullPage: true,
    });
    console.log(
      "PASS first closure keeps A online; final closure marks A offline without durable mutation",
    );
    const replacement = await browser.newContext();
    const pageReplacement = await replacement.newPage();
    await login(pageReplacement, userA);
    await pageReplacement.goto(roomUrl);
    await presence(pageB, userA.id, "Online");
    await presence(pageReplacement, userB.id, "Online");
    console.log(
      "PASS independently authenticated reopened A restores presence for B",
    );
    await contextB.setOffline(true);
    await pageB.evaluate(() => {
      (window as unknown as { ed07Sockets: WebSocket[] }).ed07Sockets.forEach(
        (socket) => socket.close(),
      );
    });
    await presence(pageReplacement, userB.id, "Offline");
    await pageReplacement
      .getByRole("button", { name: "Start Peer Discussion", exact: true })
      .click();
    await pageReplacement
      .getByText("Peer Discussion", { exact: true })
      .waitFor();
    await contextB.setOffline(false);
    await presence(pageB, userB.id, "Online");
    await pageB.getByText("Peer Discussion", { exact: true }).waitFor();
    console.log(
      "PASS offline transport loss and reconnect recover phase and presence",
    );
    const current = await db.collection("study_rooms").findOne({ roomId });
    const revoked = await contextB.request.post(
      `http://localhost:${apiPort}/api/v1/study/rooms/${roomId}/leave`,
      {
        headers: { origin: `http://localhost:${webPort}` },
        data: { commandId: crypto.randomUUID(), expectedSeq: current!.seq },
      },
    );
    assert.equal(revoked.status(), 200);
    await pageReplacement
      .getByTestId(`participant-${userB.id}`)
      .waitFor({ state: "detached" });
    await pageReplacement
      .getByRole("button", { name: "Open Individual Attempt", exact: true })
      .click();
    await pageReplacement
      .getByText("Individual Practice", { exact: true })
      .waitFor();
    assert.equal(
      messagesB.some(
        (event) =>
          event.type === "ROOM_STATE_SYNC" && (event.seq ?? 0) > current!.seq,
      ),
      false,
    );
    for (const url of socketUrls)
      assert.equal(new URL(url).searchParams.has("token"), false);
    for (const cookie of await replacement.cookies())
      if (cookie.name.includes("session_token")) {
        assert.equal(cookie.httpOnly, true);
        assert.equal(
          (await pageReplacement.content()).includes(cookie.value),
          false,
        );
      }
    console.log(
      "PASS revoked B receives no later room snapshots; credentials stay HttpOnly",
    );
    console.log("PASS ED-07 presence browser gate; full ED-07 remains PARTIAL");
  } finally {
    await browser?.close();
    nextProc?.kill("SIGTERM");
    await apiRuntime?.stop();
    await db.dropDatabase();
    await mongoClient.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
