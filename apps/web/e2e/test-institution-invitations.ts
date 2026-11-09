import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
const bcrypt: { hash(password: string, rounds: number): Promise<string> } =
  require("bcryptjs");
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

// Real Chromium + production Next + Nest + Mongo. Institution setup uses the
// authenticated API because no administrative invitation UI exists. The actual
// acceptance path is the real profile page and server action.
const WEB_PORT = 5181;
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
const PASSWORD = "Synthetic!123";
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

type Actor = { id: ObjectId; name: string; email: string; page: Page };

async function main() {
  const dbName = `ednova_m04a1_browser_${process.pid}_${Date.now()}`;
  const mongoUri = `mongodb://127.0.0.1:27018/${dbName}`;
  const client = await new MongoClient(mongoUri).connect();
  const db = client.db();
  const evidence = path.join(
    WORKSPACE_ROOT,
    "reports/evidence/ednova-m04a1-2026-10-23"
  );
  let browser: Browser | undefined;
  let next: ChildProcess | undefined;
  let runtime:
    | { stop: () => Promise<void>; server: import("node:http").Server }
    | undefined;
  const capturedLogs: string[] = [];
  const summary: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    webOrigin: WEB_ORIGIN,
    checks: []
  };
  const checks = summary.checks as Array<Record<string, unknown>>;
  const record = (name: string, result: string, details?: unknown) =>
    checks.push({ name, result, ...(details === undefined ? {} : { details }) });

  try {
    await mkdir(evidence, { recursive: true });
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const actors: Actor[] = [];
    for (const name of ["Admin", "Alice", "Bob"]) {
      const id = new ObjectId();
      await db.collection("users").insertOne({
        id: id,
        name: `M04A1 ${name}`,
        email: `${name.toLowerCase()}-${Date.now()}@m04a1.browser.test`,
        password: passwordHash,
        role: name === "Admin" ? "admin" : "student",
        isAdmin: name === "Admin",
        tier: "vip",
        isActive: true,
        isVerified: true
      });
      actors.push({ id, name, email: "", page: undefined as unknown as Page });
    }
    for (const actor of actors) {
      const row = await db.collection("users").findOne({ id: actor.id });
      actor.email = String(row!.email);
    }
    const [adminData, aliceData, bobData] = actors;

    const courseId = new ObjectId();
    await db.collection("courses").insertOne({
      id: courseId,
      userId: String(aliceData.id),
      subjectId: new ObjectId().toString(),
      title: "Alice personal reliability course",
      description: "Personal workspace must survive institution membership.",
      status: "completed",
      topics: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    Object.assign(process.env, {
      MONGODB_URI: mongoUri,
      BETTER_AUTH_SECRET: "m04a1-browser-secret-at-least-thirty-two-characters",
      BETTER_AUTH_URL: WEB_ORIGIN,
      AUTH_TRUSTED_ORIGINS: WEB_ORIGIN,
      INTERNAL_API_SECRET: "m04a1-browser-internal-synthetic-secret",
      AI_SERVICE_URL: "http://127.0.0.1:1",
      RABBITMQ_URL: "amqp://127.0.0.1:1",
      REDIS_URL: "",
      NODE_ENV: "test"
    });
    const { migrateAuth } = await import("../../api/scripts/migrate-auth");
    await migrateAuth(db, { apply: true });
    const { start } = await import("../../api/src/main");
    runtime = await start({ port: 0, workers: false });
    const address = runtime.server.address();
    assert.ok(address && typeof address === "object");
    const apiPort = address.port;
    const apiOrigin = `http://localhost:${apiPort}`;

    next = spawn("node", [".next/standalone/apps/web/server.js"], {
      cwd: path.join(WORKSPACE_ROOT, "apps/web"),
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(WEB_PORT),
        HOSTNAME: "127.0.0.1",
        BACKEND_URL: `http://127.0.0.1:${apiPort}`,
        BETTER_AUTH_URL: WEB_ORIGIN,
        AUTH_TRUSTED_ORIGINS: WEB_ORIGIN,
        NEXT_PUBLIC_WS_URL: `ws://127.0.0.1:${apiPort}`
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    next.stdout?.on("data", (data) => capturedLogs.push(String(data)));
    next.stderr?.on("data", (data) => capturedLogs.push(String(data)));
    let nextFailure: Error | undefined;
    next.on("error", (error) => {
      nextFailure = error;
    });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (nextFailure) throw nextFailure;
      try {
        ready = (await fetch(`${WEB_ORIGIN}/login`)).status === 200;
      } catch {
        /* Poll owned startup. */
      }
      if (ready) break;
      if (next.exitCode !== null) throw new Error("Owned Next server exited");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Production Next server ready");
    record("production Next server ready", "PASS");

    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {})
    });
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    for (let i = 0; i < actors.length; i++) {
      actors[i].page = await contexts[i].newPage();
    }
    const consoleMessages: string[] = [];
    for (const actor of actors) {
      actor.page.on("console", (message) =>
        consoleMessages.push(`${actor.name}:${message.type()}:${message.text()}`)
      );
    }

    async function login(actor: Actor) {
      await actor.page.goto(`${WEB_ORIGIN}/login`);
      await actor.page.locator('input[name="email"]').fill(actor.email);
      await actor.page.locator('input[name="password"]').fill(PASSWORD);
      await actor.page.locator('button[type="submit"]').click();
      await actor.page.waitForURL(/dashboard/);
    }
    await Promise.all(actors.map(login));
    record("two independent user accounts authenticate with Better Auth", "PASS", {
      users: actors.map((actor) => actor.name)
    });

    async function request(
      page: Page,
      route: string,
      method = "GET",
      body?: unknown
    ) {
      const response = await page.context().request.fetch(`${apiOrigin}${route}`, {
        method,
        headers: { origin: WEB_ORIGIN },
        ...(body === undefined ? {} : { data: body })
      });
      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text);
      } catch {
        /* Non-JSON error body. */
      }
      return { status: response.status(), text, data };
    }

    const admin = actors[0];
    const alice = actors[1];
    const bob = actors[2];
    const bootstrapA = await request(admin.page, "/api/v1/study/institutions/bootstrap", "POST", {
      name: "Invitation Reliability University",
      slug: "invitation-reliability-browser"
    });
    assert.equal(bootstrapA.status, 201, bootstrapA.text);
    const institutionA = String((bootstrapA.data.institution as { id: string }).id);
    const bootstrapB = await request(admin.page, "/api/v1/study/institutions/bootstrap", "POST", {
      name: "Second Reliability University",
      slug: "second-reliability-browser"
    });
    assert.equal(bootstrapB.status, 201, bootstrapB.text);
    const institutionB = String((bootstrapB.data.institution as { id: string }).id);
    record("two synthetic institutions created through authenticated API", "PASS");

    async function issue(institutionId: string, role: string) {
      const response = await request(
        admin.page,
        `/api/v1/study/institutions/${institutionId}/invitations`,
        "POST",
        { role }
      );
      assert.equal(response.status, 201, response.text);
      return {
        id: String((response.data.invitation as { id: string }).id),
        token: String(response.data.token)
      };
    }
    const aliceInvite = await issue(institutionA, "university_student");
    const bobInvite = await issue(institutionB, "instructor");
    const expiredInvite = await issue(institutionA, "university_student");
    const revokedInvite = await issue(institutionA, "university_student");
    await db.collection("institution_invitations").updateOne(
      { id: new ObjectId(expiredInvite.id) },
      { $set: { expiresAt: new Date(Date.now() - 60_000) } }
    );
    const revoked = await request(
      admin.page,
      `/api/v1/study/institutions/${institutionA}/invitations/${revokedInvite.id}`,
      "DELETE"
    );
    assert.equal(revoked.status, 200, revoked.text);
    record("valid, expired and revoked capabilities prepared without admin UI", "PASS");

    async function openInvitationForm(page: Page) {
      const details = page
        .locator("details")
        .filter({ hasText: "Have an institution invitation?" });
      if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
        await details.locator("summary").click();
      }
      return details;
    }

    async function submitToken(page: Page, token: string) {
      await openInvitationForm(page);
      await page.getByLabel("Invitation token").fill(token);
      await page.getByRole("button", { name: "Accept invitation" }).click();
      // A server-action response may replace the server component and reset
      // the native <details> open state. The action result is still rendered;
      // reopen the disclosure before asserting its visible alert/status.
      await page.waitForFunction(
        () =>
          Boolean(
            document.querySelector('[role="alert"], [role="status"]')
          ),
        undefined,
        { timeout: 15000 }
      );
      await openInvitationForm(page);
    }

    await bob.page.goto(`${WEB_ORIGIN}/profile`);
    await expect(bob.page.getByText("Institutional contexts")).toBeVisible();
    await expect(
      bob.page.getByText("You are using a personal workspace with no active institutional membership.")
    ).toBeVisible();
    record("authenticated profile loads the real personal workspace", "PASS");

    await submitToken(bob.page, "x".repeat(43));
    await expect(bob.page.getByRole("alert")).toContainText("Invitation not found");
    assert.equal(
      await db.collection("institution_memberships").countDocuments({
        userId: String(bob.id)
      }),
      0
    );
    await bob.page.screenshot({ path: path.join(evidence, "bob-invalid-token.png"), fullPage: true });
    record("invalid token produces a truthful error and no membership", "PASS");

    await submitToken(bob.page, expiredInvite.token);
    await expect(bob.page.getByRole("alert")).toContainText("Invitation has expired");
    assert.equal(
      await db.collection("institution_memberships").countDocuments({
        userId: String(bob.id)
      }),
      0
    );
    await bob.page.screenshot({ path: path.join(evidence, "bob-expired-token.png"), fullPage: true });
    record("expired token produces a truthful error and no membership", "PASS");

    await submitToken(bob.page, revokedInvite.token);
    await expect(bob.page.getByRole("alert")).toContainText(
      "Invitation is no longer available"
    );
    assert.equal(
      await db.collection("institution_memberships").countDocuments({
        userId: String(bob.id)
      }),
      0
    );
    record("revoked token produces a truthful error and no membership", "PASS");

    await submitToken(bob.page, bobInvite.token);
    await expect(bob.page.getByRole("status")).toContainText(
      "Institution membership accepted."
    );
    await expect(bob.page.getByText("Second Reliability University", { exact: true })).toBeVisible();
    await bob.page.reload();
    await expect(bob.page.getByText("Second Reliability University", { exact: true })).toBeVisible();
    await expect(
      bob.page.getByText("Invitation Reliability University", { exact: true })
    ).toHaveCount(0);
    assert.equal(
      await db.collection("institution_memberships").countDocuments({
        userId: String(bob.id),
        institutionId: new ObjectId(institutionB),
        role: "instructor",
        status: "active"
      }),
      1
    );
    record("valid Bob acceptance renders an authoritative persisted membership", "PASS", {
      institution: "Second Reliability University",
      role: "instructor"
    });

    await alice.page.goto(`${WEB_ORIGIN}/profile`);
    await submitToken(alice.page, aliceInvite.token);
    await expect(alice.page.getByRole("status")).toContainText(
      "Institution membership accepted."
    );
    await expect(
      alice.page.getByText("Invitation Reliability University", { exact: true })
    ).toBeVisible();
    await alice.page.reload();
    await expect(
      alice.page.getByText("Invitation Reliability University", { exact: true })
    ).toBeVisible();
    await expect(alice.page.getByText("Second Reliability University", { exact: true })).toHaveCount(0);
    assert.equal(
      await db.collection("institution_memberships").countDocuments({
        userId: String(alice.id),
        institutionId: new ObjectId(institutionA),
        role: "university_student",
        status: "active"
      }),
      1
    );
    await alice.page.screenshot({ path: path.join(evidence, "alice-profile-after-acceptance.png"), fullPage: true });
    record("valid Alice acceptance renders only her institution after refresh", "PASS", {
      institution: "Invitation Reliability University",
      role: "university_student"
    });

    // The single-use capability is not reusable by a different actor. Replaying
    // as the same actor is intentionally idempotent and is covered by API tests.
    await bob.page.goto(`${WEB_ORIGIN}/profile`);
    await submitToken(bob.page, aliceInvite.token);
    await expect(bob.page.getByRole("alert")).toContainText("Invitation has already been used");
    await expect(bob.page.getByText("Second Reliability University", { exact: true })).toBeVisible();
    await expect(
      bob.page.getByText("Invitation Reliability University", { exact: true })
    ).toHaveCount(0);
    assert.equal(
      await db.collection("institution_memberships").countDocuments({
        userId: String(bob.id),
        institutionId: new ObjectId(institutionA)
      }),
      0
    );
    await bob.page.screenshot({ path: path.join(evidence, "bob-reused-token.png"), fullPage: true });
    record("another actor cannot reuse an accepted token", "PASS");

    const aliceCourses = await request(alice.page, "/api/v1/study/courses");
    assert.equal(aliceCourses.status, 200, aliceCourses.text);
    const aliceCourseRows = aliceCourses.data.courses as Array<{ id: string; title: string }>;
    assert.ok(aliceCourseRows.some((course) => course.id === courseId.toString()));
    const bobForeignCourse = await request(
      bob.page,
      `/api/v1/study/courses/${courseId.toString()}`
    );
    assert.equal(bobForeignCourse.status, 404);
    await alice.page.goto(`${WEB_ORIGIN}/courses`);
    await expect(alice.page.getByText("Alice personal reliability course", { exact: true })).toBeVisible();
    await alice.page.screenshot({ path: path.join(evidence, "alice-personal-course-preserved.png"), fullPage: true });
    record("personal course remains available to Alice and private to Bob", "PASS");

    const bobPrivateMetadata = await request(
      bob.page,
      `/api/v1/study/institutions/${institutionA}`
    );
    assert.equal(bobPrivateMetadata.status, 404);
    assert.equal(bobPrivateMetadata.text.includes(aliceInvite.token), false);
    record("cross-institution metadata remains denied", "PASS");

    await alice.page.goto(`${WEB_ORIGIN}/profile`);
    const aliceHtml = await alice.page.content();
    assert.equal(aliceHtml.includes(aliceInvite.token), false);
    const bobHtml = await bob.page.content();
    assert.equal(bobHtml.includes(bobInvite.token), false);
    assert.equal(consoleMessages.some((line) => line.includes(aliceInvite.token)), false);
    assert.equal(consoleMessages.some((line) => line.includes(bobInvite.token)), false);
    const invitationRows = await db.collection("institution_invitations").find({}).toArray();
    assert.equal(JSON.stringify(invitationRows).includes(aliceInvite.token), false);
    assert.equal(JSON.stringify(invitationRows).includes(bobInvite.token), false);
    record("tokens are absent from page HTML, browser console, and stored documents", "PASS");

    const leaked = [...capturedLogs, ...consoleMessages].find(
      (line) => line.includes(aliceInvite.token) || line.includes(bobInvite.token)
    );
    assert.equal(leaked, undefined, "invitation token appeared in captured runtime logs");
    record("tokens are absent from captured Next runtime logs", "PASS");

    summary.users = actors.map((actor) => ({ name: actor.name, id: actor.id.toString() }));
    summary.institutions = { A: institutionA, B: institutionB };
    summary.status = "PASS";
    await writeFile(
      path.join(evidence, "browser-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`
    );
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    summary.status = "FAIL";
    summary.error = error instanceof Error ? error.message : String(error);
    try {
      await writeFile(
        path.join(evidence, "browser-summary.json"),
        `${JSON.stringify(summary, null, 2)}\n`
      );
    } catch {
      /* Preserve the original failure. */
    }
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
    if (next && next.exitCode === null) {
      next.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (next.exitCode === null) next.kill("SIGKILL");
    }
    await runtime?.stop().catch(() => undefined);
    await db.dropDatabase().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
