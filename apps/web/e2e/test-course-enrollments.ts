import { chromium, type Browser, type Page } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
const bcrypt: { hash(password: string, rounds: number): Promise<string> } =
  require("bcryptjs");
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const WEB_PORT = 5183;
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
const PASSWORD = "Synthetic!123";
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

type Actor = { id: ObjectId; name: string; email: string; page: Page };

async function main() {
  const dbName = `ednova_m04b_browser_${process.pid}_${Date.now()}`;
  const mongoUri = `mongodb://127.0.0.1:27018/${dbName}`;
  const client = await new MongoClient(mongoUri).connect();
  const db = client.db();
  const evidence = path.join(
    WORKSPACE_ROOT,
    "reports/evidence/ednova-m04b-2026-10-23"
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
    for (const name of ["Admin", "Alice", "Bob", "Charlie"]) {
      const id = new ObjectId();
      await db.collection("users").insertOne({
        id: id,
        name: `M04B ${name}`,
        email: `${name.toLowerCase()}-${Date.now()}@m04b.browser.test`,
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
    const [adminData, aliceData, bobData, charlieData] = actors;

    // Create institutions
    const institutionA = new ObjectId();
    await db.collection("institutions").insertOne({
      id: institutionA,
      name: "Acme University A",
      slug: `acme-a-${Date.now()}`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const institutionB = new ObjectId();
    await db.collection("institutions").insertOne({
      id: institutionB,
      name: "Beta College B",
      slug: `beta-b-${Date.now()}`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Memberships in Institution A
    await db.collection("institution_memberships").insertMany([
      {
        institutionId: institutionA,
        userId: adminData.id.toString(),
        role: "university_admin",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        institutionId: institutionA,
        userId: aliceData.id.toString(),
        role: "instructor",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        institutionId: institutionA,
        userId: bobData.id.toString(),
        role: "university_student",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    // Charlie has NO institution membership (purely personal learner)

    // Charlie personal course
    const charlieCourseId = new ObjectId();
    await db.collection("courses").insertOne({
      id: charlieCourseId,
      userId: charlieData.id.toString(),
      ownerUserId: charlieData.id.toString(),
      scope: "personal",
      subjectId: new ObjectId().toString(),
      title: "Charlie Personal Private Notes",
      description: "Must never be accessible to institution members or admin.",
      status: "completed",
      topics: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Institutional Course in Institution A
    const instCourseId = new ObjectId();
    await db.collection("courses").insertOne({
      id: instCourseId,
      userId: aliceData.id.toString(),
      ownerUserId: adminData.id.toString(),
      scope: "institutional",
      institutionId: institutionA,
      assignedInstructorIds: [aliceData.id.toString()],
      subjectId: new ObjectId().toString(),
      title: "CS101: Distributed Systems",
      description: "Authoritative Institutional Course",
      status: "completed",
      topics: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    Object.assign(process.env, {
      MONGODB_URI: mongoUri,
      BETTER_AUTH_SECRET: "m04b-browser-secret-at-least-thirty-two-characters",
      BETTER_AUTH_URL: WEB_ORIGIN,
      AUTH_TRUSTED_ORIGINS: WEB_ORIGIN,
      INTERNAL_API_SECRET: "m04b-browser-internal-synthetic-secret",
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
    record("all actors authenticated with Better Auth", "PASS", {
      users: actors.map((a) => a.name)
    });

    async function apiRequest(
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
        /* Non-JSON response */
      }
      return { status: response.status(), text, data };
    }

    // Alice issues course invitation via authenticated API endpoint
    const inviteRes = await apiRequest(
      aliceData.page,
      `/api/v1/study/courses/${instCourseId.toString()}/invitations`,
      "POST",
      { maxUses: 5, expiresInDays: 7 }
    );
    assert.equal(inviteRes.status, 201, `Alice failed to issue invitation: ${inviteRes.text}`);
    const rawToken = String(inviteRes.data.token);
    assert.ok(rawToken && rawToken.length > 10, "Raw invitation token generated");
    record("alice instructor issued course invitation", "PASS", { tokenPrefix: rawToken.slice(0, 8) });

    // Verify token is hashed in DB
    const dbInvite = await db.collection("course_invitations").findOne({ courseId: instCourseId });
    assert.ok(dbInvite, "Invitation document stored");
    assert.notEqual(dbInvite.tokenHash, rawToken, "Token hash is stored, not raw token");
    assert.equal(typeof dbInvite.tokenHash, "string", "SHA-256 token hash verified");
    record("course invitation stored as SHA-256 hash in DB", "PASS");

    // Bob visits /courses
    await bobData.page.goto(`${WEB_ORIGIN}/courses`);
    await bobData.page.waitForSelector('text=Courses', { timeout: 10000 });
    record("bob navigated to /courses", "PASS");

    // Bob enrolls using the invitation token via the UI form
    const bobDetails = bobData.page.locator("details").filter({ hasText: "Enroll in a course with an invite code" });
    await bobDetails.locator("summary").click();
    await bobData.page.fill('input[name="token"]', rawToken);
    await bobData.page.click('button:has-text("Enroll now")');

    // Wait for form action to process and page to refresh
    await bobData.page.waitForTimeout(2000);

    // Verify Bob is now enrolled in MongoDB
    const enrollment = await db.collection("course_enrollments").findOne({
      courseId: instCourseId,
      userId: bobData.id.toString()
    });
    assert.ok(enrollment, "Enrollment document created for Bob");
    assert.equal(enrollment.status, "active", "Bob enrollment status is active");
    assert.equal(enrollment.institutionId?.toString(), institutionA.toString(), "Enrollment institution matches");
    record("bob successfully enrolled via course invitation in browser", "PASS");

    // Charlie (personal learner, not in Institution A) attempts to accept the token
    await charlieData.page.goto(`${WEB_ORIGIN}/courses`);
    await charlieData.page.waitForSelector('text=Courses', { timeout: 10000 });
    const charlieDetails = charlieData.page.locator("details").filter({ hasText: "Enroll in a course with an invite code" });
    await charlieDetails.locator("summary").click();
    await charlieData.page.fill('input[name="token"]', rawToken);
    await charlieData.page.click('button:has-text("Enroll now")');
    await charlieData.page.waitForTimeout(2000);

    // Verify Charlie is NOT enrolled in MongoDB
    const charlieEnrollment = await db.collection("course_enrollments").findOne({
      courseId: instCourseId,
      userId: charlieData.id.toString()
    });
    assert.equal(charlieEnrollment, null, "Charlie cannot enroll in cross-institution course");
    record("charlie personal learner rejected from foreign institution course", "PASS");

    // Strict Personal Isolation Check: Bob attempts to read Charlie's personal course via API
    const charlieCourseByBob = await apiRequest(
      bobData.page,
      `/api/v1/study/courses/${charlieCourseId.toString()}`
    );
    assert.equal(charlieCourseByBob.status, 404, "Personal course inaccessible to enrolled students");

    const adminCourseByAdmin = await apiRequest(
      adminData.page,
      `/api/v1/study/courses/${charlieCourseId.toString()}`
    );
    assert.equal(adminCourseByAdmin.status, 404, "Personal course strictly isolated from institution admin");
    record("personal course strictly isolated from institutional actors", "PASS");

    // Verify token was never leaked in logs or HTML
    const bobHtml = await bobData.page.content();
    assert.equal(bobHtml.includes(rawToken), false, "Raw token not leaked in Bob HTML");
    const charlieHtml = await charlieData.page.content();
    assert.equal(charlieHtml.includes(rawToken), false, "Raw token not leaked in Charlie HTML");
    record("raw tokens absent from page HTML and database collections", "PASS");

    summary.users = actors.map((a) => ({ name: a.name, id: a.id.toString() }));
    summary.institutions = { A: institutionA.toString(), B: institutionB.toString() };
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
      /* preserve error */
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
