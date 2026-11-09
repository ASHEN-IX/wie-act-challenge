import { chromium, type Browser } from "@playwright/test";
import SessionChat from "../../api/modules/notification/src/models/SessionChat";
import { MongoClient, ObjectId } from "mongodb";
// @ts-ignore
import bcrypt from "bcryptjs";
import { spawn, ChildProcess } from "child_process";
import assert from "node:assert/strict";

// Self-contained, fully automated Presence Browser E2E Test Runner
async function main() {
  console.log("--- Starting ED-07 Browser E2E Verification ---");

  const testDbName = `ed07_peer_text_browser_${Date.now()}`;
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
    const urls: string[] = [];
    const eventsB: Array<{ type: string; message?: { text: string } }> = [];
    const dialogs: string[] = [];
    for (const page of [pageA, pageA2, pageB]) {
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });
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
        urls.push(socket.url());
        if (page === pageB)
          socket.on("framereceived", ({ payload }) => {
            try {
              eventsB.push(JSON.parse(String(payload)));
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
    const rows = (page: typeof pageA) =>
      page.locator('[data-testid^="peer-message-"]');
    const count = async (page: typeof pageA, expected: number) => {
      const until = Date.now() + 15000;
      while ((await rows(page).count()) !== expected && Date.now() < until)
        await page.waitForTimeout(50);
      assert.equal(await rows(page).count(), expected);
    };
    const sendUI = async (page: typeof pageA, text: string) => {
      await page.getByLabel("Message to room", { exact: true }).fill(text);
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
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
      await page.getByText("History recovered", { exact: true }).waitFor();
      await page
        .getByTestId(`participant-${userA.id}`)
        .getByLabel("Online", { exact: true })
        .waitFor();
      assert.equal(
        await page.getByTestId(`participant-${userA.id}`).count(),
        1,
      );
    }
    const initialRoom = await db.collection("study_rooms").findOne({ roomId });
    let droppedHttpAcknowledgement = false;
    await pageA.route("**/study-together/room_*", async (route) => {
      if (
        !droppedHttpAcknowledgement &&
        route.request().method() === "POST" &&
        route.request().headers()["next-action"]
      ) {
        droppedHttpAcknowledgement = true;
        await route.fetch(); // Real Next action/Nest persistence completes.
        await route.abort("failed"); // Browser loses the actual HTTP response.
      } else await route.continue();
    });
    await sendUI(pageA, "Browser public message one");
    for (const page of [pageA, pageA2, pageB]) await count(page, 1);
    assert.equal(droppedHttpAcknowledgement, true);
    assert.equal(await pageA.getByTestId("peer-outbox").count(), 0);
    await pageA.unroute("**/study-together/room_*");
    console.log(
      "PASS actual browser HTTP acknowledgement loss reconciles the authoritative WS acceptance",
    );
    const journal = () =>
      db
        .collection("sessionchats")
        .findOne({ sessionId: roomId, messageType: "peer_stream" });
    const first = (await journal())!.peerMessages[0];
    assert.equal(first.senderUserId, userA.id.toString());
    assert.equal(first.seq, 1);
    const endpoint = `http://localhost:${apiPort}/api/v1/session-chat/${roomId}`;
    const duplicate = await contextA2.request.post(endpoint + "/messages", {
      headers: { origin: `http://localhost:${webPort}` },
      data: { submissionId: first.submissionId, text: first.text },
    });
    assert.equal(duplicate.status(), 201);
    assert.equal((await journal())!.peerSeq, 1);
    for (const page of [pageA, pageA2, pageB]) await count(page, 1);
    console.log(
      "PASS three independently signed-in contexts, sender identity, durable acceptance and cross-tab duplicate replay",
    );
    await contextA.close();
    await pageB
      .getByTestId(`participant-${userA.id}`)
      .getByLabel("Online", { exact: true })
      .waitFor();
    await contextB.setOffline(true);
    await pageB.evaluate(() =>
      (window as unknown as { ed07Sockets: WebSocket[] }).ed07Sockets.forEach(
        (socket) => socket.close(),
      ),
    );
    await pageA2
      .getByTestId(`participant-${userB.id}`)
      .getByLabel("Offline", { exact: true })
      .waitFor();
    await sendUI(pageA2, "Accepted while B offline");
    await count(pageA2, 2);
    await sendUI(pageA2, "Another ordered contribution");
    await count(pageA2, 3);
    await contextB.setOffline(false);
    await pageB.getByText("History recovered", { exact: true }).waitFor();
    await count(pageB, 3);
    assert.deepEqual(
      await rows(pageB).evaluateAll((elements) =>
        elements.map((e) => Number(e.getAttribute("data-message-seq"))),
      ),
      [1, 2, 3],
    );
    console.log(
      "PASS one-tab closure preserves A presence; B reconnect recovers ordered messages without duplicates",
    );
    await pageB.reload();
    await pageB.getByText("History recovered", { exact: true }).waitFor();
    await count(pageB, 3);
    const xss =
      '<img src=x onerror="alert(123)"><script>alert(456)</script> [run](javascript:alert(789))';
    await sendUI(pageB, xss);
    await count(pageA2, 4);
    await count(pageB, 4);
    const last = rows(pageA2).last();
    assert.ok((await last.innerText()).includes(xss));
    assert.equal(await last.locator("script,img,a").count(), 0);
    assert.equal(dialogs.length, 0);
    console.log(
      "PASS participant send, refresh recovery and inert HTML/script/unsafe-link rendering",
    );

    // Commit at the real server, then inject a missing Mongo write acknowledgement.
    // The caller gets uncertainty (503) with no live event and retries the exact ID.
    const original = SessionChat.collection.findOneAndUpdate;
    let injected = false;
    SessionChat.collection.findOneAndUpdate = (async (
      ...args: Parameters<typeof original>
    ) => {
      const updated = await original.apply(SessionChat.collection, args);
      if (!injected) {
        injected = true;
        throw new Error("Synthetic lost write acknowledgement");
      }
      return updated;
    }) as typeof original;
    try {
      await sendUI(pageA2, "Retry after uncertain acceptance");
      await pageA2
        .getByText("Retryable — acceptance uncertain", { exact: true })
        .waitFor();
      const saved = (await journal())!.peerMessages.at(-1);
      assert.equal(saved.text, "Retry after uncertain acceptance");
      assert.equal(
        await pageA2
          .getByLabel("Message to room", { exact: true })
          .inputValue(),
        saved.text,
      );
      await pageA2
        .getByRole("button", { name: "Retry same message", exact: true })
        .click();
      await count(pageA2, 5);
      assert.equal(
        (await journal())!.peerMessages.filter(
          (m: { submissionId: string }) =>
            m.submissionId === saved.submissionId,
        ).length,
        1,
      );
      assert.equal(await pageA2.getByTestId("peer-outbox").count(), 0);
    } finally {
      SessionChat.collection.findOneAndUpdate = original;
    }
    // B missed a best-effort event after the injected commit; explicit existing
    // history recovery proves persistence, rather than pretending it was broadcast.
    await pageB
      .getByRole("button", { name: "Recover messages", exact: true })
      .click();
    await pageB.getByText("History recovered", { exact: true }).waitFor();
    await count(pageB, 5);
    console.log(
      "PASS uncertain acceptance preserves draft and stable-ID retry; missing publication recovers from durable history",
    );
    assert.deepEqual(
      await db.collection("study_rooms").findOne({ roomId }),
      initialRoom,
    );
    await pageA2.screenshot({
      path: "/tmp/ed07-peer-text/three-context-peer-text.png",
      fullPage: true,
    });
    const current = await db.collection("study_rooms").findOne({ roomId });
    const leave = await contextB.request.post(
      `http://localhost:${apiPort}/api/v1/study/rooms/${roomId}/leave`,
      {
        headers: { origin: `http://localhost:${webPort}` },
        data: { commandId: crypto.randomUUID(), expectedSeq: current!.seq },
      },
    );
    assert.equal(leave.status(), 200);
    await pageA2
      .getByTestId(`participant-${userB.id}`)
      .waitFor({ state: "detached" });
    assert.equal(
      (
        await contextB.request.post(endpoint + "/messages", {
          headers: { origin: `http://localhost:${webPort}` },
          data: {
            submissionId: crypto.randomUUID(),
            text: "Denied after leave",
          },
        })
      ).status(),
      403,
    );
    assert.equal(
      (await contextB.request.get(endpoint + "/history?kind=peer")).status(),
      403,
    );
    await sendUI(pageA2, "Protected after B revocation");
    await count(pageA2, 6);
    assert.equal(
      eventsB.some(
        (e) =>
          e.type === "ROOM_PEER_MESSAGE" &&
          e.message?.text === "Protected after B revocation",
      ),
      false,
    );
    for (const url of urls)
      assert.equal(new URL(url).searchParams.has("token"), false);
    for (const cookie of await contextA2.cookies())
      if (cookie.name.includes("session_token")) {
        assert.equal(cookie.httpOnly, true);
        assert.equal((await pageA2.content()).includes(cookie.value), false);
      }
    console.log(
      "PASS revoked B cannot send/read/receive; A continues; credentials remain private; no AI service was started",
    );
    console.log(
      "PASS isolated ED-07 peer-text browser gate; full ED-07 remains PARTIAL",
    );
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
