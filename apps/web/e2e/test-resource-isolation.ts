import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
const bcrypt: { hash(password: string, rounds: number): Promise<string> } =
  require("bcryptjs");
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

// Real Chromium + production Next + Nest + Mongo; synthetic source revocation.
// No provider service, inference, microphone or GPU is used.
async function main() {
  const dbName = `ednova_m02_browser_${process.pid}_${Date.now()}`;
  const mongoUri = `mongodb://127.0.0.1:27018/${dbName}`;
  const client = await new MongoClient(mongoUri).connect();
  const db = client.db();
  let runtime: { stop: () => Promise<void> } | undefined;
  let next: ChildProcess | undefined;
  let browser: Browser | undefined;
  const courseId = new ObjectId();
  const sourceDirectory = path.resolve("uploads/courses", String(courseId));
  const evidence = path.resolve("reports/evidence/ednova-m02-2026-10-23");
  try {
    const users = ["Owner", "Peer"].map((name) => ({
      id: new ObjectId(),
      name: `M02 ${name}`,
      email: `${name.toLowerCase()}-${Date.now()}@m02.test`,
    }));
    const password = await bcrypt.hash("Synthetic!123", 12);
    for (const user of users)
      await db.collection("users").insertOne({
        _id: user.id,
        name: user.name,
        email: user.email,
        password,
        role: "student",
        tier: "vip_plus",
        isActive: true,
        isVerified: true,
      });
    const [owner, peer] = users;
    await mkdir(sourceDirectory, { recursive: true });
    await mkdir(evidence, { recursive: true });
    await writeFile(
      path.join(sourceDirectory, "private.pdf"),
      "M02_PRIVATE_BROWSER_SOURCE",
    );
    await db.collection("courses").insertOne({
      _id: courseId,
      userId: String(owner.id),
      subjectId: String(new ObjectId()),
      title: "M02 private browser course",
      status: "completed",
      files: [
        { filename: "private.pdf", originalName: "private.pdf", size: 26 },
      ],
      topics: [],
    });
    Object.assign(process.env, {
      MONGODB_URI: mongoUri,
      BETTER_AUTH_SECRET: "m02-browser-secret-at-least-thirty-two-characters",
      BETTER_AUTH_URL: "http://localhost:5173",
      AUTH_TRUSTED_ORIGINS: "http://localhost:5173",
      INTERNAL_API_SECRET: "m02-browser-internal-synthetic-secret",
      AI_SERVICE_URL: "http://127.0.0.1:1",
      RABBITMQ_URL: "amqp://127.0.0.1:1",
      REDIS_URL: "",
      NODE_ENV: "test",
    });
    const { migrateAuth } = await import("../../api/scripts/migrate-auth");
    await migrateAuth(db, { apply: true });
    const { start } = await import("../../api/src/main");
    const api = await start({ port: 0, workers: false });
    runtime = api;
    const address = api.server.address();
    assert.ok(address && typeof address === "object");
    const apiPort = address.port;
    next = spawn("node", [".next/standalone/apps/web/server.js"], {
      cwd: path.resolve("apps/web"),
      env: {
        ...process.env,
        PORT: "5173",
        HOSTNAME: "127.0.0.1",
        BACKEND_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_PUBLIC_WS_URL: `ws://127.0.0.1:${apiPort}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    next.stderr?.on("data", (data) => process.stderr.write(data));
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        ready = (await fetch("http://localhost:5173/login")).status === 200;
      } catch {
        /* Poll owned startup. */
      }
      if (ready) break;
      if (next.exitCode !== null) throw new Error("Owned Next server exited");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Production Next server ready");
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    });
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [a1, a2, b] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const urls: string[] = [];
    const receivedA2: Array<Record<string, unknown>> = [];
    for (const page of [a1, a2, b])
      page.on("websocket", (socket) => {
        urls.push(socket.url());
        if (page === a2)
          socket.on("framereceived", ({ payload }) => {
            try {
              receivedA2.push(JSON.parse(String(payload)));
            } catch {
              /* Ignore malformed fixtures. */
            }
          });
      });
    async function login(page: Page, user: typeof owner) {
      await page.goto("http://localhost:5173/login");
      await page.locator('input[name="email"]').fill(user.email);
      await page.locator('input[name="password"]').fill("Synthetic!123");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/dashboard/);
    }
    await login(a1, owner);
    await login(a2, owner);
    await login(b, peer);
    async function request(
      page: Page,
      route: string,
      method = "GET",
      body?: unknown,
    ) {
      // Use this browser context's real HttpOnly cookie jar for direct backend
      // probes; keep the application's same-origin CSP unchanged.
      const response = await page
        .context()
        .request.fetch(`http://localhost:${apiPort}${route}`, {
          method,
          headers: { origin: "http://localhost:5173" },
          ...(body === undefined ? {} : { data: body }),
        });
      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text);
      } catch {
        /* Source bytes are not JSON. */
      }
      return { status: response.status(), text, data };
    }
    const shared = await request(a1, "/api/v1/study/rooms", "POST", {
      title: "M02 unaffected peer room",
      enableVoice: false,
    });
    assert.equal(shared.status, 201);
    const sharedId = String(shared.data.roomId);
    assert.equal(
      (
        await request(b, "/api/v1/study/rooms/join", "POST", {
          inviteCode: shared.data.inviteCode,
        })
      ).status,
      200,
    );
    for (const page of [a1, a2, b])
      await page.goto(`http://localhost:5173/study-together/${sharedId}`);
    for (const page of [a1, a2, b]) {
      await expect(
        page
          .getByTestId(`participant-${owner.id}`)
          .getByLabel("Online", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByTestId(`participant-${peer.id}`)
          .getByLabel("Online", { exact: true }),
      ).toBeVisible();
    }
    console.log(
      "PASS A1/A2/B independent authenticated contexts share legitimate room presence",
    );
    const source = `/api/v1/study/courses/${courseId}`;
    assert.equal(
      (await request(a1, source + "/files/private.pdf")).status,
      200,
    );
    for (const suffix of ["", "/ingest-status", "/files/private.pdf"]) {
      const denied = await request(b, source + suffix);
      assert.equal(denied.status, 404);
      assert.ok(!denied.text.includes("M02_PRIVATE_BROWSER_SOURCE"));
    }
    assert.equal(
      (await request(b, `/uploads/courses/${courseId}/private.pdf`)).status,
      404,
    );
    const privateRoom = await request(a1, "/api/v1/study/rooms", "POST", {
      title: "M02 revoked private room",
      courseId: String(courseId),
      enableVoice: false,
    });
    assert.equal(privateRoom.status, 201);
    const privateId = String(privateRoom.data.roomId);
    assert.equal(
      (
        await request(b, "/api/v1/study/rooms/join", "POST", {
          inviteCode: privateRoom.data.inviteCode,
        })
      ).status,
      403,
    );
    assert.equal(
      (await request(b, `/api/v1/session-chat/${privateId}/history?kind=peer`))
        .status,
      403,
    );
    await a2.goto(`http://localhost:5173/study-together/${privateId}`);
    await expect(
      a2
        .getByTestId(`participant-${owner.id}`)
        .getByLabel("Online", { exact: true }),
    ).toBeVisible();
    console.log(
      "PASS private source/download/history and invite source bypass are denied by backend",
    );
    await db
      .collection("courses")
      .updateOne({ _id: courseId }, { $set: { userId: String(peer.id) } });
    // The new actual course owner can use the explicit room invite. This real
    // membership mutation triggers recipient validation of the revoked owner.
    assert.equal(
      (
        await request(b, "/api/v1/study/rooms/join", "POST", {
          inviteCode: privateRoom.data.inviteCode,
        })
      ).status,
      200,
    );
    await expect(
      a2
        .getByRole("alert")
        .filter({ hasText: "Course access is no longer available" }),
    ).toBeVisible();
    await expect(a2.getByTestId(`participant-${owner.id}`)).toHaveCount(0);
    assert.equal(
      (await request(a2, `/api/v1/study/rooms/${privateId}`)).status,
      403,
    );
    assert.equal(
      (await request(a2, `/api/v1/session-chat/${privateId}/history?kind=peer`))
        .status,
      403,
    );
    assert.equal(
      (await request(a2, source + "/files/private.pdf")).status,
      404,
    );
    assert.equal(
      (
        await request(b, `/api/v1/session-chat/${privateId}/messages`, "POST", {
          submissionId: randomUUID(),
          text: "M02_AFTER_REVOCATION_PRIVATE_MARKER",
        })
      ).status,
      201,
    );
    assert.ok(
      !JSON.stringify(receivedA2).includes(
        "M02_AFTER_REVOCATION_PRIVATE_MARKER",
      ),
    );
    await a2.reload();
    await expect(
      a2
        .getByRole("alert")
        .filter({ hasText: "Course access is no longer available" }),
    ).toBeVisible();
    await a2.screenshot({
      path: path.join(evidence, "source-revoked-browser.png"),
      fullPage: true,
    });
    console.log(
      "PASS source revocation ejects old recipient, clears protected UI, denies HTTP and refresh",
    );
    await a1
      .getByLabel("Message to room", { exact: true })
      .fill("M02 legitimate room still works");
    await a1.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(
      a1
        .getByRole("list", { name: "Accepted peer messages" })
        .getByText("M02 legitimate room still works", { exact: true }),
    ).toBeVisible();
    for (const context of contexts) {
      const cookies = await context.cookies();
      assert.ok(cookies.some((cookie) => cookie.httpOnly));
      for (const page of context.pages()) {
        const html = await page.content();
        for (const cookie of cookies.filter((cookie) => cookie.httpOnly))
          assert.ok(
            !html.includes(cookie.value),
            "HttpOnly cookie absent from serialized HTML",
          );
      }
    }
    for (const url of urls)
      for (const key of ["token", "cookie", "authorization"])
        assert.ok(!new URL(url).searchParams.has(key));
    console.log(
      "PASS unaffected authorized flow and credential isolation; M02 browser security scenario complete",
    );
  } finally {
    await browser?.close();
    if (next && next.exitCode === null) {
      const exited = new Promise<void>((resolve) =>
        next!.once("exit", () => resolve()),
      );
      next.kill("SIGTERM");
      const timer = setTimeout(() => next?.kill("SIGKILL"), 10000);
      await exited;
      clearTimeout(timer);
    }
    await runtime?.stop();
    const { closeAuth } = await import("../../api/shared/betterAuth");
    await closeAuth();
    await db.dropDatabase();
    await client.close();
    await rm(sourceDirectory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
