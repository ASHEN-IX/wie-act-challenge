/** Real isolated browser acceptance. No API/WS mocks; deterministic local embeddings/inference only. */
import {
  chromium,
  type Browser,
  type Page,
  expect as baseExpect,
} from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  writeFile,
  rm,
  readFile,
  rename,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const bcrypt: {
  hash(p: string, n: number): Promise<string>;
} = require("bcryptjs");
const ROOT = path.resolve(__dirname, "../../.."),
  EVIDENCE = process.env.P0R3_EVIDENCE_DIR
    ? path.resolve(process.env.P0R3_EVIDENCE_DIR)
    : path.join(ROOT, "reports/evidence/ednova-p0-r3");
const expect = baseExpect.configure({ timeout: 30000 });
const webPort = 5191,
  webOrigin = `http://localhost:${webPort}`,
  password = "Synthetic!123";
async function main() {
  const webDirectory = process.env.P0R3_WEB_DIR
    ? path.resolve(process.env.P0R3_WEB_DIR)
    : path.join(ROOT, "apps/web");
  const temp = await mkdtemp(path.join(os.tmpdir(), "ednova-p0r3-browser-"));
  const database = "ednova_p0r3_browser_" + Date.now(),
    uri = "mongodb://127.0.0.1:27018/" + database;
  const client = await new MongoClient(uri).connect(),
    db = client.db();
  let runtime:
      | Awaited<ReturnType<(typeof import("../../api/src/main"))["start"]>>
      | undefined,
    browser: Browser | undefined;
  const children: ChildProcess[] = [],
    logs: string[] = [],
    events: unknown[] = [],
    checks: string[] = [];
  let completed = false;
  const record = (s: string) => {
    checks.push(s);
    console.log("PASS " + s);
  };
  const configFile = path.join(webDirectory, "tsconfig.json"),
    configBefore = await readFile(configFile);
  try {
    await mkdir(EVIDENCE, { recursive: true });
    const aiPort = 3197;
    Object.assign(process.env, {
      NODE_ENV: "test",
      MONGODB_URI: uri,
      DB_NAME: database,
      BETTER_AUTH_SECRET: "p0r3-browser-secret-at-least-32-characters",
      BETTER_AUTH_URL: webOrigin,
      AUTH_TRUSTED_ORIGINS: webOrigin,
      INTERNAL_API_SECRET: "p0r3-browser-internal-secret",
      AI_SERVICE_API_KEY: "p0r3-browser-ai-secret-at-least-32-characters",
      AI_SERVICE_URL: "http://127.0.0.1:" + aiPort,
      LLM_MOCK: "1",
      LLM_APPROVALS_JSON: "{}",
      INGEST_UPLOADS_DIR: path.join(temp, "uploads"),
      FAISS_INDEX_DIR: path.join(temp, "faiss"),
      RABBITMQ_URL:
        process.env.P0R3_BROKER_URL || "amqp://guest:guest@127.0.0.1:5678/",
      REDIS_URL: "",
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      LITELLM_LOCAL_MODEL_COST_MAP: "True",
      CUDA_VISIBLE_DEVICES: "-1",
    });
    const pyEnv = {
      ...process.env,
      P0R2_AI_PORT: String(aiPort),
      PYTHONPATH: [
        path.join(ROOT, "apps/api/tests/helpers/python_guard"),
        path.join(ROOT, "apps/ai"),
      ].join(":"),
    };
    function child(
      command: string,
      args: string[],
      cwd: string,
      env: NodeJS.ProcessEnv,
    ) {
      const p = spawn(command, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      children.push(p);
      p.stdout?.on("data", (d) => logs.push(String(d)));
      p.stderr?.on("data", (d) => logs.push(String(d)));
      return p;
    }
    const python = process.env.P0R2_PYTHON;
    assert.ok(python, "P0R2_PYTHON required");
    const ai = child(
      python,
      [path.join(ROOT, "apps/api/tests/helpers/p0r2-ai-server.py")],
      path.join(ROOT, "apps/ai"),
      pyEnv,
    );
    async function waitFor(url: string, proc: ChildProcess) {
      for (let i = 0; i < 160; i++) {
        try {
          if ((await fetch(url)).ok) return;
        } catch {}
        if (proc.exitCode !== null)
          throw new Error("Child exited " + logs.join(""));
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("Readiness timeout " + url);
    }
    await waitFor(process.env.AI_SERVICE_URL + "/health", ai);
    const hashed = await bcrypt.hash(password, 12);
    const actors = [];
    const actorNames =
      process.env.P0R3_FOUR_LEARNERS === "1"
        ? [
            "Admin",
            "Instructor",
            "Learner",
            "Peer",
            "Peer2",
            "Peer3",
            "Outsider",
          ]
        : ["Admin", "Instructor", "Learner", "Peer", "Outsider"];
    for (const name of actorNames) {
      const id = new ObjectId(),
        email = name.toLowerCase() + "@p0r3.browser.test";
      await db.collection("users").insertOne({
        _id: id,
        name: "R3 " + name,
        email,
        password: hashed,
        role: name === "Admin" ? "admin" : "student",
        isAdmin: name === "Admin",
        tier: "vip",
        isActive: true,
        isVerified: true,
      });
      actors.push({ id, email, name, page: undefined as unknown as Page });
    }
    const { migrateAuth } = await import("../../api/scripts/migrate-auth");
    await migrateAuth(db, { apply: true });
    runtime = await (
      await import("../../api/src/main")
    ).start({ port: 0, workers: false });
    const apiOrigin =
      "http://127.0.0.1:" + (runtime.server.address() as { port: number }).port;
    const next = child(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--webpack",
        "--port",
        String(webPort),
      ],
      webDirectory,
      {
        ...process.env,
        NODE_ENV: "development",
        BACKEND_URL: apiOrigin,
        NEXT_PUBLIC_WS_URL: apiOrigin.replace("http", "ws"),
      },
    );
    await waitFor(webOrigin + "/login", next);
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    });
    for (const a of actors) {
      const context = await browser.newContext();
      a.page = await context.newPage();
      a.page.setDefaultTimeout(30000);
      await a.page.addInitScript(() => {
        const Native = window.WebSocket;
        const sockets: WebSocket[] = [];
        Object.assign(window, { r3Sockets: sockets });
        window.WebSocket = class extends Native {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            sockets.push(this);
          }
        };
      });
      a.page.on("pageerror", (e) =>
        logs.push("BROWSER " + a.name + " " + e.message),
      );
      a.page.on("console", (message) => {
        if (message.type() === "error")
          logs.push("CONSOLE " + a.name + " " + message.text());
      });
      a.page.on("requestfailed", (request) =>
        logs.push(
          "FAILED_REQUEST " +
            a.name +
            " " +
            request.url() +
            " " +
            request.failure()?.errorText,
        ),
      );
      a.page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.pathname.startsWith("/study-together"))
          logs.push(
            "ROOM_RESPONSE " +
              a.name +
              " " +
              response.status() +
              " " +
              url.pathname +
              " " +
              (response.request().headers()["rsc"] || "document"),
          );
      });
      a.page.on("websocket", (ws) =>
        ws.on("framereceived", (f) => {
          try {
            events.push({
              actor: a.name,
              frame: JSON.parse(String(f.payload)),
            });
          } catch {}
        }),
      );
      await a.page.goto(webOrigin + "/login");
      await a.page.locator("[name=email]").fill(a.email);
      await a.page.locator("[name=password]").fill(password);
      await a.page.locator("button[type=submit]").click();
      await a.page.waitForURL(/dashboard/);
    }
    const [admin, instructor, learner, peer] = actors;
    const outsider = actors.find((a) => a.name === "Outsider")!;
    const extraPeers = actors.filter(
      (a) => a.name === "Peer2" || a.name === "Peer3",
    );
    const roomLearners = [learner, peer, ...extraPeers];
    async function acknowledgeRoomAction(actor: typeof admin, label: string) {
      const [response] = await Promise.all([
        actor.page.waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            new URL(r.url()).pathname === "/study-together",
        ),
        actor.page.getByRole("button", { name: label, exact: true }).click(),
      ]);
      assert.equal(response.status(), 200);
      await expect(
        actor.page
          .getByRole("status")
          .filter({ hasText: "Room command acknowledged." }),
      ).toBeVisible();
    }
    async function http(
      a: typeof admin,
      method: string,
      url: string,
      body?: unknown,
    ) {
      return a.page.evaluate(
        async ({ method, url, body }) => {
          const r = await fetch(url, {
            method,
            headers: body ? { "content-type": "application/json" } : {},
            body: body ? JSON.stringify(body) : undefined,
          });
          const text = await r.text();
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = { error: text };
          }
          return { status: r.status, body: parsed };
        },
        { method, url, body },
      );
    }
    await admin.page.goto(webOrigin + "/institutions");
    await admin.page
      .getByLabel("Institution name", { exact: true })
      .fill("R3 Browser University");
    await admin.page
      .getByLabel("Institution slug", { exact: true })
      .fill("r3-browser");
    await admin.page
      .getByRole("button", { name: "Create institution", exact: true })
      .click();
    await expect(
      admin.page.getByText(
        "Institution created. Reload to view current membership.",
      ),
    ).toBeVisible();
    const institution = await db
      .collection("institutions")
      .findOne({ slug: "r3-browser" });
    assert.ok(institution);
    const institutionId = institution._id.toString();
    for (const a of [instructor, ...roomLearners]) {
      await admin.page.goto(webOrigin + "/institutions");
      await admin.page
        .getByLabel("Invitation institution ID")
        .fill(institutionId);
      await admin.page
        .getByLabel("Membership role")
        .selectOption(a === instructor ? "instructor" : "university_student");
      await Promise.all([
        admin.page.waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            new URL(r.url()).pathname === "/institutions",
        ),
        admin.page
          .getByRole("button", {
            name: "Issue membership invitation",
            exact: true,
          })
          .click(),
      ]);
      await expect(
        admin.page.getByTestId("membership-invitation"),
      ).toBeVisible();
      const token = await admin.page
        .getByTestId("membership-invitation")
        .textContent();
      assert.ok(token);
      await a.page.goto(webOrigin + "/profile");
      await a.page
        .getByText("Have an institution invitation?", { exact: true })
        .click();
      await a.page.getByLabel("Invitation token", { exact: true }).fill(token);
      await a.page
        .getByRole("button", { name: "Accept invitation", exact: true })
        .click();
      await expect(
        a.page.getByText("Institution membership accepted.", { exact: true }),
      ).toBeVisible();
    }
    record(
      "A: real admin institution and membership invitation UI; instructor and learners accept through Profile",
    );
    // Pace five synthetic actors behind one loopback IP without disabling production rate limits.
    await new Promise((r) => setTimeout(r, 61000));
    const worker = child(
      python,
      [path.join(ROOT, "apps/api/tests/helpers/p0r2-ai-server.py"), "--worker"],
      path.join(ROOT, "apps/ai"),
      pyEnv,
    );
    const amqp = await import("amqplib");
    const connection = await amqp.connect(process.env.RABBITMQ_URL!);
    let workerReady = false;
    for (let i = 0; i < 100; i++) {
      const c = await connection.createChannel();
      c.on("error", () => {});
      try {
        const q = await c.checkQueue("ai.work.study.ingest.course");
        workerReady = q.consumerCount > 0;
      } catch {}
      try {
        await c.close();
      } catch {}
      if (workerReady) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await connection.close();
    assert.ok(workerReady, "Real ingestion worker ready");
    const tracker =
      await import("../../api/modules/study/src/services/ingestStatus");
    await tracker.startIngestStatusTracker();
    const subject = await http(instructor, "POST", "/api/v1/study/subjects", {
      name: "Source arithmetic",
    });
    assert.equal(subject.status, 201, JSON.stringify(subject));
    await instructor.page.goto(webOrigin + "/courses/new");
    await instructor.page.locator("[name=title]").fill("R3 source arithmetic");
    await instructor.page
      .locator("[name=institutionId]")
      .selectOption(institutionId);
    const passage =
      "# Arithmetic source\n\n## Addition\n\nArithmetic addition combines quantities into a total. This original passage supports an exact quotation check and preserves its verified source identity.";
    const useScannedPdf = process.env.P0R3_SOURCE_SCANNED === "1";
    const usePdf = process.env.P0R3_SOURCE_PDF === "1" || useScannedPdf;
    let sourceBytes = Buffer.from(passage);
    if (usePdf) {
      const fixturePath = path.join(temp, "arithmetic.pdf");
      const fixture = spawnSync(
        python,
        [
          "-c",
          [
            "import fitz,sys",
            "d=fitz.open(); p=d.new_page()",
            "p.insert_textbox(fitz.Rect(72,72,520,700), sys.argv[2], fontsize=16)",
            ...(useScannedPdf
              ? [
                  "r=fitz.open(); p=r.new_page()",
                  'p.insert_image(p.rect, stream=d[0].get_pixmap(matrix=fitz.Matrix(2,2)).tobytes("png"))',
                  "d.close(); d=r",
                  "assert not d[0].get_text().strip()",
                ]
              : []),
            "d.save(sys.argv[1]); d.close()",
          ].join("\n"),
          fixturePath,
          passage,
        ],
        { encoding: "utf8" },
      );
      assert.equal(fixture.status, 0, fixture.stderr);
      sourceBytes = await readFile(fixturePath);
    }
    await instructor.page.locator("[name=files]").setInputFiles({
      name: usePdf ? "arithmetic.pdf" : "arithmetic.txt",
      mimeType: usePdf ? "application/pdf" : "text/plain",
      buffer: sourceBytes,
    });
    await instructor.page
      .getByRole("button", { name: "Upload and process", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          await db
            .collection("courses")
            .countDocuments({ title: "R3 source arithmetic" }),
      )
      .toBe(1);
    const uploadedRow = await db
      .collection("courses")
      .findOne({ title: "R3 source arithmetic" });
    assert.ok(uploadedRow);
    const courseId = uploadedRow._id.toString();
    await instructor.page
      .getByRole("link", { name: "Open course", exact: true })
      .click();
    await instructor.page.waitForURL(
      (url) => url.pathname === "/courses/" + courseId,
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );
    await expect(
      instructor.page.getByRole("link", { name: "Course Studio", exact: true }),
    ).toBeVisible();
    const base = "/api/v1/study/courses/" + courseId;
    await expect
      .poll(
        async () =>
          String(
            (
              await db
                .collection("courses")
                .findOne({ _id: new ObjectId(courseId) })
            )?.status,
          ),
        { timeout: 60000 },
      )
      .toBe("completed");
    await admin.page.goto(webOrigin + "/institutions");
    await admin.page.getByLabel("Assignment course ID").fill(courseId);
    for (const a of [instructor, ...roomLearners]) {
      await admin.page.getByLabel("Assignment user ID").fill(a.id.toString());
      await admin.page
        .getByLabel("Course role", { exact: true })
        .selectOption(a === instructor ? "instructor" : "student");
      await Promise.all([
        admin.page.waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            new URL(r.url()).pathname === "/institutions",
        ),
        admin.page
          .getByRole("button", { name: "Apply course assignment", exact: true })
          .click(),
      ]);
      await expect(
        admin.page.getByText("Course access assignment acknowledged."),
      ).toBeVisible();
    }
    assert.equal(
      (
        await http(admin, "POST", base + "/publish", {
          expectedRevisionTag: "unknown",
        })
      ).status,
      403,
    );
    record(
      "A: administrative instructor assignment/enrollment; unauthorized outsider denied",
    );
    assert.equal((await http(outsider, "GET", base)).status, 404);
    await instructor.page
      .getByRole("link", { name: "Course Studio", exact: true })
      .click();
    await instructor.page.waitForURL(/\/studio$/);
    await instructor.page
      .getByLabel("Manual learning objective")
      .fill("Complete exact arithmetic quotations from the verified source.");
    await instructor.page
      .getByRole("button", { name: "Add learning objective", exact: true })
      .click();
    await instructor.page
      .getByRole("button", { name: /Instructor reviewed objective/ })
      .click();
    await instructor.page.getByRole("button", { name: /Source study/ }).click();
    await instructor.page
      .getByLabel("Topic heading 1", { exact: true })
      .fill("Instructor corrected arithmetic heading");
    await instructor.page.locator("#reviewed-checkbox").check();
    await instructor.page
      .getByRole("button", { name: "Save Draft", exact: true })
      .click();
    await expect(
      instructor.page.getByText("Course draft saved successfully."),
    ).toBeVisible();
    await instructor.page
      .getByRole("button", {
        name: "Prepare exact source revision",
        exact: true,
      })
      .click();
    await expect(
      instructor.page.getByText("Exact source revision prepared and verified."),
    ).toBeVisible({ timeout: 60000 });
    await instructor.page
      .getByLabel("Verified source passage")
      .selectOption({ index: 1 });
    if (useScannedPdf) {
      await expect(
        instructor.page.getByRole("status").filter({
          hasText: "Scanned page: English OCR confidence",
        }),
      ).toContainText(
        "Check the original and correct the draft before publication.",
      );
      const studio = await http(
        instructor,
        "GET",
        "/api/v1/study/learning/studio/" + courseId,
      );
      assert.equal(studio.status, 200);
      assert.ok(studio.body.sources.length);
      assert.ok(
        studio.body.sources.every(
          (source: Record<string, unknown>) =>
            source.extractionMethod === "ocr" &&
            source.reviewRequired === true &&
            typeof source.ocrConfidence === "number",
        ),
      );
      record(
        "B: image-only PDF, real English OCR, instructor confidence/review warning and verified page provenance",
      );
    }
    for (const type of ["InteractiveQuiz", "GuidedProblem"]) {
      await instructor.page
        .getByRole("button", { name: type, exact: true })
        .click();
      await instructor.page
        .getByText("Settings", { exact: true })
        .click();
      await instructor.page
        .getByLabel("Hint depth", { exact: true })
        .selectOption("context");
      await instructor.page
        .getByLabel("Quotation difficulty", { exact: true })
        .selectOption("beginner");
      await instructor.page
        .getByRole("button", { name: "Generate Proposal", exact: true })
        .last()
        .click();
      await expect(
        instructor.page.getByText("Candidate Preview", { exact: true }),
      ).toBeVisible();
      await instructor.page.getByLabel("Candidate title").fill("R3 " + type);
      await instructor.page
        .getByText("Private instructor evaluation definition", { exact: true })
        .click();
      await expect(
        instructor.page.getByText(
          "I reviewed the source, candidate and private evaluation key.",
        ),
      ).toBeVisible();
      await instructor.page
        .getByRole("checkbox", {
          name: "I reviewed the source, candidate and private evaluation key.",
        })
        .check();
      await instructor.page
        .getByRole("button", { name: "Approve & Register", exact: true })
        .click();
      await expect(
        instructor.page.getByText(/Activity registered! ID:/),
      ).toBeVisible();
    }
    await instructor.page
      .getByRole("button", { name: "Publish Revision", exact: true })
      .click();
    await expect(
      instructor.page.getByRole("link", {
        name: "Open committed immutable revision",
      }),
    ).toBeVisible();
    await instructor.page.screenshot({
      path: path.join(EVIDENCE, "browser-studio.png"),
      fullPage: true,
    });
    const published = await db
      .collection("course_revisions")
      .findOne({ courseId: new ObjectId(courseId), status: "published" });
    assert.ok(published?.activationState === "committed");
    assert.equal(
      published.topics[0].title,
      "Instructor corrected arithmetic heading",
    );
    await instructor.page.goto(
      webOrigin + "/instructor-insights?courseId=" + courseId,
    );
    await expect(
      instructor.page.getByText("Course aggregates are suppressed", {
        exact: false,
      }),
    ).toBeVisible();
    record(
      "B: corrected heading survives publication; unapproved cohort policy suppresses instructor metrics",
    );

    const revisionId = published.revisionTag;
    const records = await db
      .collection("activity_records")
      .find({ courseId, revisionId })
      .toArray();
    assert.equal(records.length, 2);
    record(
      "B: UI upload → real RabbitMQ worker → draft review → prepare → passage → both activity candidates → review/register → committed publish",
    );
    await new Promise((r) => setTimeout(r, 61000));
    await learner.page.goto(
      webOrigin + `/courses/${courseId}/learn?revisionId=${revisionId}`,
    );
    await expect(
      learner.page.getByRole("heading", {
        name: "Learn: R3 source arithmetic",
      }),
    ).toBeVisible();
    const quiz = records.find((r) => r.activityType === "InteractiveQuiz")!,
      guided = records.find((r) => r.activityType === "GuidedProblem")!;
    const objectiveId = quiz.publicDefinition.objectiveId;
    await learner.page
      .getByLabel("Learning objective")
      .selectOption(objectiveId);
    await learner.page
      .getByRole("button", { name: "Select reviewed activity", exact: true })
      .click();
    await expect(learner.page.getByTestId("quiz-renderer")).toBeVisible();
    const correctId = quiz.serverEvaluation.answerKey[0],
      wrongId = quiz.publicDefinition.presentationData.options.find(
        (o: { id: string }) => o.id !== correctId,
      ).id;
    const wrongLabel = quiz.publicDefinition.presentationData.options.find(
      (o: { id: string }) => o.id === wrongId,
    ).label;
    await learner.page
      .getByRole("radio", { name: wrongLabel, exact: true })
      .click();
    // Transport fault only: the real server commits, then its response is dropped.
    const attemptCountBefore = await db
      .collection("student_attempts")
      .countDocuments({
        userId: learner.id.toString(),
        activityId: quiz.activityId,
      });
    const actionURL = learner.page.url();
    let dropped = false;
    await learner.page.route(actionURL, async (route) => {
      if (!dropped && route.request().method() === "POST") {
        dropped = true;
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        await response.body();
        await route.abort("failed");
      } else await route.continue();
    });
    await learner.page
      .getByRole("button", { name: "Submit Answer", exact: true })
      .click();
    await expect(
      learner.page.getByTestId("quiz-renderer").getByRole("alert"),
    ).toBeVisible();
    await learner.page.unroute(actionURL);
    assert.ok(dropped);
    await learner.page
      .getByRole("button", { name: "Submit Answer", exact: true })
      .click();
    await expect
      .poll(() =>
        db.collection("student_attempts").countDocuments({
          userId: learner.id.toString(),
          activityId: quiz.activityId,
        }),
      )
      .toBe(attemptCountBefore + 1);
    record(
      "C: dropped real response retried from UI with exactly one durable attempt",
    );
    await expect(
      learner.page
        .getByTestId("quiz-renderer")
        .getByText("Incorrect", { exact: true }),
    ).toBeVisible();
    assert.equal(
      await db.collection("learning_evidences").countDocuments({
        userId: learner.id.toString(),
        masteryAchieved: true,
      }),
      0,
    );
    await learner.page
      .getByRole("button", { name: "Try Again", exact: true })
      .click();
    const correctLabel = quiz.publicDefinition.presentationData.options.find(
      (o: { id: string }) => o.id === correctId,
    ).label;
    await learner.page
      .getByRole("radio", { name: correctLabel, exact: true })
      .click();
    await learner.page
      .getByRole("button", { name: "Submit Answer", exact: true })
      .click();
    await expect(
      learner.page
        .getByTestId("quiz-renderer")
        .getByText("Correct", { exact: true }),
    ).toBeVisible();
    await learner.page
      .getByLabel("Activity type")
      .selectOption("GuidedProblem");
    await learner.page
      .getByRole("button", { name: "Select reviewed activity", exact: true })
      .click();
    await expect(
      learner.page.getByTestId("guided-problem-renderer"),
    ).toBeVisible();
    await learner.page
      .getByTestId("guided-problem-renderer")
      .locator("textarea")
      .fill(guided.serverEvaluation.answerKey[0]);
    await learner.page
      .getByRole("button", { name: "Submit Steps for Feedback", exact: true })
      .click();
    await expect(
      learner.page.getByText("Completed", { exact: true }),
    ).toBeVisible();
    await learner.page
      .getByLabel("Tutor question")
      .fill("Explain arithmetic addition");
    await learner.page
      .getByRole("button", { name: "Ask from sources", exact: true })
      .click();
    await expect(learner.page.getByTestId("tutor-answer")).toContainText(
      "MOCK_TEST",
    );
    const citation = learner.page
      .getByTestId("tutor-answer")
      .getByRole("link")
      .first();
    await expect(citation).toBeVisible();
    const link = await citation.getAttribute("href");
    const source = await learner.page.request.get(webOrigin + link!);
    assert.equal(source.status(), 200);
    assert.deepEqual(await source.body(), sourceBytes);
    if (usePdf) await expect(citation).toContainText(/page 1/i);
    await learner.page
      .getByRole("button", {
        name: "Start provisional diagnostic",
        exact: true,
      })
      .click();
    await expect(
      learner.page.getByRole("button", { name: /Check 1:/ }),
    ).toBeVisible();
    await learner.page.reload();
    await expect(
      learner.page.getByText(/Objectives with accepted mastery evidence:/),
    ).toContainText(objectiveId);
    await learner.page.screenshot({
      path: path.join(EVIDENCE, "browser-solo.png"),
      fullPage: true,
    });
    record(
      "C: both renderers, wrong/correct grading, grounded tutor/citation bytes, provisional diagnostic and durable progress",
    );
    await new Promise((r) => setTimeout(r, 61000));
    await learner.page.goto(webOrigin + "/study-together");
    await learner.page.locator("[name=courseId]").selectOption(courseId);
    await acknowledgeRoomAction(learner, "Create room");
    const roomLink = learner.page
      .getByRole("link", { name: "Open room", exact: true })
      .first();
    const roomHref = await roomLink.getAttribute("href");
    assert.match(roomHref || "", /^\/study-together\/room_/);
    logs.push("OPEN_ROOM " + learner.name + " " + roomHref);
    await roomLink.click();
    await learner.page.waitForURL(/\/study-together\/room_/, {
      waitUntil: "domcontentloaded",
    });
    const roomId = learner.page.url().split("/").pop()!;
    const invite = await learner.page.getByTestId("invite-code").textContent();
    assert.ok(invite);
    await peer.page.goto(webOrigin + "/study-together");
    await peer.page.locator("[name=code]").fill(invite.trim());
    await acknowledgeRoomAction(peer, "Join room");
    await peer.page
      .getByRole("link", { name: "Open room", exact: true })
      .first()
      .click();
    await peer.page.waitForURL(/\/study-together\/room_/, {
      waitUntil: "domcontentloaded",
    });
    for (const actor of [learner, peer]) {
      const panel = actor.page.getByTestId("room-learning");
      await expect(
        panel.getByRole("link", { name: "Open the course material" }),
      ).toHaveAttribute(
        "href",
        `/courses/${courseId}/learn?revisionId=${revisionId}`,
      );
      await expect(panel.getByTestId("room-visualization")).toHaveCount(0);
    }
    assert.equal(
      (await http(learner, "GET", "/api/v1/study/rooms/" + roomId)).body.room.revisionId,
      revisionId,
    );
    for (const extra of extraPeers) {
      await new Promise((resolve) => setTimeout(resolve, 61000));
      await extra.page.goto(webOrigin + "/study-together");
      await extra.page.locator("[name=code]").fill(invite.trim());
      await acknowledgeRoomAction(extra, "Join room");
      await extra.page
        .getByRole("link", { name: "Open room", exact: true })
        .first()
        .click();
      await extra.page.waitForURL(/\/study-together\/room_/, {
        waitUntil: "domcontentloaded",
      });
      assert.equal(extra.page.url().split("/").pop(), roomId);
    }
    const beforeSockets = await peer.page.evaluate(() => {
      const sockets = (
        window as unknown as { r3Sockets: WebSocket[] }
      ).r3Sockets.filter((s) => s.url.includes("/ws/realtime"));
      for (const socket of sockets) socket.close();
      return sockets.length;
    });
    assert.ok(beforeSockets > 0);
    if (extraPeers.length)
      await new Promise((resolve) => setTimeout(resolve, 61000));
    await learner.page
      .getByLabel("Reviewed room activity")
      .selectOption(quiz.activityId);
    await learner.page
      .getByRole("button", { name: "Start selected activity", exact: true })
      .click();
    await expect(peer.page.getByTestId("quiz-renderer")).toBeVisible();
    await expect(learner.page.getByTestId("quiz-renderer")).toBeVisible();
    for (const extra of extraPeers)
      await expect(extra.page.getByTestId("quiz-renderer")).toBeVisible();
    await expect
      .poll(() =>
        peer.page.evaluate(
          () =>
            (window as unknown as { r3Sockets: WebSocket[] }).r3Sockets.filter(
              (s) => s.url.includes("/ws/realtime"),
            ).length,
        ),
      )
      .toBeGreaterThan(beforeSockets);
    const lr = "/api/v1/study/learning/rooms/" + roomId;
    const own = await http(learner, "GET", lr + "/check"),
      other = await http(peer, "GET", lr + "/check");
    assert.equal(own.status, 200);
    assert.notEqual(own.body.checkId, other.body.checkId);
    assert.equal(
      (await http(peer, "GET", lr + "/checks/" + own.body.checkId)).status,
      404,
    );
    // Four browsers plus explicit cross-recipient probes share one loopback IP.
    // Retain the real server limits and start each probe batch in a fresh window.
    if (extraPeers.length)
      await new Promise((resolve) => setTimeout(resolve, 61000));
    let verifiedSequence = 0;
    for (const extra of extraPeers) {
      // A preceding accepted submission advances the public sequence. Compare
      // both readers at the current state, not the previous learner's version.
      const authoritative = (
        await http(learner, "GET", "/api/v1/study/rooms/" + roomId)
      ).body.room;
      const snapshot = (
        await http(extra, "GET", "/api/v1/study/rooms/" + roomId)
      ).body.room;
      assert.equal(snapshot.seq, authoritative.seq);
      assert.ok(snapshot.seq >= verifiedSequence);
      verifiedSequence = snapshot.seq;
      assert.equal(snapshot.activeActivityId, authoritative.activeActivityId);
      const privateCheck = await http(extra, "GET", lr + "/check");
      assert.equal(privateCheck.status, 200);
      assert.notEqual(privateCheck.body.checkId, own.body.checkId);
      assert.equal(
        (await http(extra, "GET", lr + "/checks/" + own.body.checkId)).status,
        404,
      );
      assert.equal(
        (
          await http(
            learner,
            "GET",
            lr + "/checks/" + privateCheck.body.checkId,
          )
        ).status,
        404,
      );
      await extra.page
        .getByRole("radio", {
          name: extra.name === "Peer2" ? correctLabel : wrongLabel,
          exact: true,
        })
        .click();
      await extra.page
        .getByRole("button", { name: "Submit Answer", exact: true })
        .click();
      await expect(
        extra.page
          .getByTestId("quiz-renderer")
          .getByText(extra.name === "Peer2" ? "Correct" : "Incorrect", {
            exact: true,
          }),
      ).toBeVisible();
      await extra.page.reload();
      await expect(
        extra.page
          .getByTestId("quiz-renderer")
          .getByText(extra.name === "Peer2" ? "Correct" : "Incorrect", {
            exact: true,
          }),
      ).toBeVisible();
    }
    if (extraPeers.length)
      await new Promise((resolve) => setTimeout(resolve, 61000));
    await learner.page
      .getByRole("radio", { name: correctLabel, exact: true })
      .click();
    await learner.page
      .getByRole("button", { name: "Submit Answer", exact: true })
      .click();
    await expect(
      learner.page
        .getByTestId("quiz-renderer")
        .getByText("Correct", { exact: true }),
    ).toBeVisible();
    await peer.page
      .getByRole("radio", { name: wrongLabel, exact: true })
      .click();
    await peer.page
      .getByRole("button", { name: "Submit Answer", exact: true })
      .click();
    await expect(
      peer.page
        .getByTestId("quiz-renderer")
        .getByText("Incorrect", { exact: true }),
    ).toBeVisible();
    assert.equal(
      (
        await http(
          peer,
          "GET",
          `/api/v1/study/activities/${quiz.activityId}/attempts/${own.body.attemptId}`,
        )
      ).status,
      404,
    );
    await peer.page.evaluate(
      ({ checkId, recipientUserId }) => {
        const socket = (
          window as unknown as { r3Sockets: WebSocket[] }
        ).r3Sockets.find(
          (s) =>
            s.url.includes("/ws/realtime") && s.readyState === WebSocket.OPEN,
        );
        socket?.send(
          JSON.stringify({
            type: "PRIVATE_CHECK_GET",
            checkId,
            recipientUserId,
          }),
        );
      },
      { checkId: own.body.checkId, recipientUserId: learner.id.toString() },
    );
    const navigation = await peer.page.context().newPage();
    const deniedNavigation = await navigation.goto(
      webOrigin + lr + "/checks/" + own.body.checkId,
    );
    assert.equal(deniedNavigation?.status(), 404);
    await navigation.close();
    await peer.page.reload();
    await expect(
      peer.page
        .getByTestId("quiz-renderer")
        .getByText("Incorrect", { exact: true }),
    ).toBeVisible();
    await learner.page
      .getByLabel("Message to room", { exact: true })
      .fill(
        "Compare the quotation with our original source before explaining the answer.",
      );
    await learner.page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await expect(
      peer.page.getByRole("list", { name: "Accepted peer messages" }),
    ).toContainText("Compare the quotation with our original source");
    let state = (await http(learner, "GET", "/api/v1/study/rooms/" + roomId))
      .body.room;
    const forbidden = await http(
      peer,
      "PUT",
      "/api/v1/study/rooms/" + roomId + "/phase",
      {
        commandId: randomUUID(),
        expectedSeq: state.seq,
        currentPhase: "debrief",
      },
    );
    assert.equal(forbidden.status, 403);
    await learner.page
      .getByRole("button", { name: "Request peer-first proposal", exact: true })
      .click();
    await expect(
      learner.page.getByRole("button", {
        name: "Accept validated proposal",
        exact: true,
      }),
    ).toBeVisible();
    await learner.page
      .getByRole("button", { name: "Accept validated proposal", exact: true })
      .click();
    await expect(
      peer.page.getByText("Peer Discussion", { exact: true }).first(),
    ).toBeVisible();
    await learner.page
      .getByRole("button", { name: "Move to Debrief", exact: true })
      .click();
    await expect(peer.page.getByTestId("private-debrief")).toContainText(
      "Private grades are suppressed",
    );
    await expect(learner.page.getByTestId("private-debrief")).toContainText(
      "Private grades are suppressed",
    );
    for (const extra of extraPeers)
      await expect(extra.page.getByTestId("private-debrief")).toContainText(
        "Private grades are suppressed",
      );
    await peer.page.screenshot({
      path: path.join(EVIDENCE, "browser-room-peer.png"),
      fullPage: true,
    });
    record(
      `D: ${roomLearners.length} distinct learner cookie sessions, canonical selection/WS synchronization, private right/wrong results, reconnect, presenter denial, reviewed facilitator proposal and debrief`,
    );
    await new Promise((resolve) => setTimeout(resolve, 61000));
    const visualization = learner.page.getByTestId("room-visualization");
    const peerVisualization = peer.page.getByTestId("room-visualization");
    await expect(visualization).toBeVisible();
    await visualization
      .getByRole("button", { name: "Next step", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await http(
              learner,
              "GET",
              "/api/v1/study/rooms/" + roomId + "/visualization",
            )
          ).body.state.step,
      )
      .toBe(1);
    await expect(
      peerVisualization.getByRole("button", { name: "Next step", exact: true }),
    ).toBeDisabled();
    await visualization
      .getByRole("button", { name: "Previous step", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await http(
              peer,
              "GET",
              "/api/v1/study/rooms/" + roomId + "/visualization",
            )
          ).body.state.step,
      )
      .toBe(0);
    const privateQuestion = "Explain addition privately for this learner only";
    await learner.page
      .getByLabel("Private room question", { exact: true })
      .fill(privateQuestion);
    await learner.page
      .getByRole("button", { name: "Ask privately", exact: true })
      .click();
    await expect(learner.page.getByTestId("private-room-help")).toContainText(
      "MOCK_TEST",
    );
    const ownHelp = await http(
      learner,
      "GET",
      "/api/v1/study/private-help/" + roomId,
    );
    assert.equal(ownHelp.body.history.length, 1);
    assert.equal(ownHelp.body.history[0].status, "completed");
    assert.equal(
      (await http(peer, "GET", "/api/v1/study/private-help/" + roomId)).body
        .history.length,
      0,
    );
    await expect(peer.page.getByTestId("private-room-help")).not.toContainText(
      privateQuestion,
    );
    await learner.page.reload();
    await expect(learner.page.getByTestId("private-room-help")).toContainText(
      privateQuestion,
    );
    record(
      "D: shared deterministic visualization, presenter authority and requester-only source help survive reload",
    );
    await new Promise((r) => setTimeout(r, 61000));
    // Receipt/replay and hostile caller checks use real browser-origin HTTP against the same runtime.
    const submission = {
      schemaVersion: "1.0.0",
      attemptId: randomUUID(),
      roomId: null,
      activity: {
        courseId,
        revisionId,
        contentHash: quiz.contentHash,
        activityId: quiz.activityId,
        activityRevision: quiz.activityRevision,
        activityType: quiz.activityType,
      },
      answers: { selectedOptionIds: [correctId] },
      timeSpentSeconds: 4,
    };
    const post = "/api/v1/study/activities/" + quiz.activityId + "/attempts";
    const receipt = await http(learner, "POST", post, submission);
    assert.equal(receipt.status, 200);
    assert.deepEqual(await http(learner, "POST", post, submission), receipt);
    assert.equal(
      (
        await http(learner, "POST", post, {
          ...submission,
          answers: { selectedOptionIds: [wrongId] },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await http(learner, "POST", post, {
          ...submission,
          attemptId: randomUUID(),
          activity: {
            ...submission.activity,
            contentHash: "sha256:" + "0".repeat(64),
          },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await http(
          learner,
          "GET",
          base + "/published-context?revisionId=missing",
        )
      ).status,
      404,
    );
    const selectBase = "/api/v1/study/learning/courses/" + courseId;
    assert.equal(
      (
        await http(learner, "POST", selectBase + "/select", {
          revisionId,
          objectiveId,
          activityType: "ExecutableCode",
          intent: "practice",
        })
      ).status,
      400,
    );
    assert.equal(
      (await http(outsider, "GET", selectBase + "/activities")).status,
      403,
    );
    const deterministic = {
      revisionId,
      objectiveId,
      activityType: "InteractiveQuiz",
      intent: "practice",
    };
    assert.deepEqual(
      await http(learner, "POST", selectBase + "/select", deterministic),
      await http(learner, "POST", selectBase + "/select", deterministic),
    );
    const proposal = await http(learner, "POST", lr + "/proposals", {});
    assert.equal(proposal.status, 200);
    state = (await http(learner, "GET", "/api/v1/study/rooms/" + roomId)).body
      .room;
    const handoff = await http(
      learner,
      "PUT",
      "/api/v1/study/rooms/" + roomId + "/presenter",
      {
        commandId: randomUUID(),
        expectedSeq: state.seq,
        presenterUserId: peer.id.toString(),
      },
    );
    assert.equal(handoff.status, 200);
    assert.equal(
      (
        await http(
          learner,
          "POST",
          lr + "/proposals/" + proposal.body.proposalId + "/decision",
          { decision: "accept" },
        )
      ).status,
      403,
    );
    const stale = await http(peer, "POST", lr + "/proposals", {});
    state = (await http(peer, "GET", "/api/v1/study/rooms/" + roomId)).body
      .room;
    assert.equal(
      (
        await http(peer, "PUT", "/api/v1/study/rooms/" + roomId + "/phase", {
          commandId: randomUUID(),
          expectedSeq: state.seq,
          currentPhase: "idle",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await http(
          peer,
          "POST",
          lr + "/proposals/" + stale.body.proposalId + "/decision",
          { decision: "accept" },
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await http(
          peer,
          "POST",
          lr + "/proposals/" + stale.body.proposalId + "/decision",
          { decision: "accept", targetPhase: "debrief" },
        )
      ).status,
      400,
    );
    const sourceFree = await http(peer, "POST", "/api/v1/study/rooms", {
      commandId: randomUUID(),
      title: "Source-free peers",
    });
    assert.equal(sourceFree.status, 201);
    const freeProposal = await http(
      peer,
      "POST",
      "/api/v1/study/learning/rooms/" + sourceFree.body.roomId + "/proposals",
      {},
    );
    assert.equal(freeProposal.body.sourceBacked, false);
    assert.equal(freeProposal.body.executionMode, "DETERMINISTIC_FALLBACK");
    const index = path.join(temp, "faiss", courseId, revisionId + ".faiss");
    await rename(index, index + ".held");
    try {
      assert.equal(
        (
          await http(
            learner,
            "GET",
            selectBase + "/activities?revisionId=" + revisionId,
          )
        ).status,
        503,
      );
    } finally {
      await rename(index + ".held", index);
    }
    ai.kill("SIGTERM");
    await new Promise<void>((r) => ai.once("exit", () => r()));
    const unavailable = await http(learner, "POST", base + "/tutor/ask", {
      revisionId,
      objectiveId,
      question: "Explain addition",
    });
    assert.ok(
      unavailable.status === 503 || unavailable.body.status === "unavailable",
      JSON.stringify(unavailable),
    );
    worker.kill("SIGTERM");
    await new Promise<void>((r) => worker.once("exit", () => r()));
    await instructor.page.goto(webOrigin + `/courses/${courseId}/studio`);
    await instructor.page.locator("input[name=files]").setInputFiles({
      name: "pending.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Queued source while the worker is unavailable. No completion or index readiness is asserted.",
      ),
    });
    await instructor.page
      .getByRole("button", { name: "Upload source", exact: true })
      .click();
    await expect(
      instructor.page.getByText(
        "Upload acknowledged; worker extraction pending. Refresh progress.",
      ),
    ).toBeVisible();
    assert.equal(
      (await db.collection("courses").findOne({ _id: new ObjectId(courseId) }))
        ?.status,
      "processing",
    );
    await expect(
      instructor.page.getByRole("button", {
        name: "Publish Revision",
        exact: true,
      }),
    ).toBeDisabled();
    record("E: unavailable worker remains pending and cannot publish");
    const brokerCleanup = await amqp.connect(process.env.RABBITMQ_URL!);
    const purge = await brokerCleanup.createChannel();
    await purge.purgeQueue("ai.work.study.ingest.course");
    await purge.close();
    await brokerCleanup.close();
    // Enrollment revocation and institutional suspension are actual authorized operations.
    assert.equal(
      (await http(admin, "DELETE", base + "/enrollments/" + peer.id)).status,
      200,
    );
    assert.equal((await http(peer, "GET", lr + "/check")).status, 403);
    assert.equal(
      (await http(peer, "GET", base + "/published-context")).status,
      403,
    );
    assert.equal(
      (
        await http(
          admin,
          "DELETE",
          `/api/v1/study/institutions/${institutionId}/memberships/${learner.id}`,
        )
      ).status,
      200,
    );
    assert.equal((await http(learner, "GET", lr + "/check")).status, 403);
    assert.equal(
      (
        await http(
          learner,
          "GET",
          selectBase + "/progress?revisionId=" + revisionId,
        )
      ).status,
      403,
    );
    await learner.page.goto(
      webOrigin + `/courses/${courseId}/learn?revisionId=${revisionId}`,
    );
    await expect(
      learner.page.getByRole("heading", {
        name: "Learn: R3 source arithmetic",
      }),
    ).toHaveCount(0);
    const serialized = JSON.stringify(events);
    for (const secret of [
      "answerKey",
      "serverEvaluation",
      "retrievedEvidence",
      "groundingContext",
      "socraticHint",
      "selectedOptionIds",
    ])
      assert.ok(
        !serialized.includes(secret),
        "No private field in WS: " + secret,
      );
    assert.ok(
      events.some(
        (e) =>
          (e as { frame: { type: string; activePin?: unknown } }).frame.type ===
            "ROOM_STATE_SYNC" &&
          (e as { frame: { activePin?: unknown } }).frame.activePin,
      ),
      "Actual pinned room event observed",
    );
    record(
      "E: duplicate/conflicting receipts, forged pin/type, unknown revision, outsider, stale/changed presenter, malformed proposal, source-free fallback, missing index, unavailable AI, enrollment/membership revocation and WS privacy",
    );
    await writeFile(
      path.join(EVIDENCE, "browser-database.json"),
      JSON.stringify(
        {
          courseId,
          revisionId,
          actors: actors.map((a) => ({
            userId: a.id.toString(),
            name: a.name,
          })),
          room: await db.collection("study_rooms").findOne(
            { roomId },
            {
              projection: {
                roomId: 1,
                courseId: 1,
                revisionId: 1,
                activePin: 1,
                activityRound: 1,
                currentPhase: 1,
                seq: 1,
                presenterUserId: 1,
                participants: 1,
                commandReceipts: 1,
              },
            },
          ),
          privateChecks: await db
            .collection("roomlearningchecks")
            .find({ roomId })
            .project({
              checkId: 1,
              roomId: 1,
              round: 1,
              userId: 1,
              attemptId: 1,
              activity: 1,
            })
            .toArray(),
          privateCheckIndexes: await db
            .collection("roomlearningchecks")
            .listIndexes()
            .toArray(),
          proposals: await db
            .collection("roomlearningproposals")
            .find({ roomId })
            .project({
              proposalId: 1,
              status: 1,
              expectedSeq: 1,
              presenterUserId: 1,
              activePin: 1,
              commandId: 1,
            })
            .toArray(),
          activities: records.map((a) => ({
            activityId: a.activityId,
            activityType: a.activityType,
          })),
          attempts: await db
            .collection("student_attempts")
            .countDocuments({ courseId }),
          evidence: await db
            .collection("learning_evidences")
            .find({
              userId: { $in: roomLearners.map((a) => a.id.toString()) },
            })
            .project({
              userId: 1,
              status: 1,
              masteryAchieved: 1,
              objectiveId: 1,
            })
            .toArray(),
        },
        null,
        2,
      ),
    );
    await tracker.stopIngestStatusTracker();
    completed = true;
  } catch (error) {
    const pages =
      browser?.contexts().flatMap((context) => context.pages()) || [];
    await writeFile(
      path.join(EVIDENCE, "browser-failure-pages.json"),
      JSON.stringify(
        pages.map((page) => page.url()),
        null,
        2,
      ),
    );
    await Promise.all(
      pages.map((page, i) =>
        page
          .screenshot({
            path: path.join(EVIDENCE, `failure-page-${i}.png`),
            timeout: 2000,
          })
          .catch(() => {}),
      ),
    );
    await writeFile(
      path.join(EVIDENCE, "browser-failure.txt"),
      error instanceof Error ? error.stack || error.message : String(error),
    );
    throw error;
  } finally {
    if (!completed) process.exitCode = 1;
    await writeFile(
      path.join(EVIDENCE, "browser-checks.json"),
      JSON.stringify(checks, null, 2),
    );
    await writeFile(
      path.join(EVIDENCE, "browser-events.json"),
      JSON.stringify(events, null, 2),
    );
    await writeFile(path.join(EVIDENCE, "browser-services.log"), logs.join(""));
    await browser?.close();
    for (const p of children) p.kill("SIGTERM");
    await runtime?.stop();
    await db.dropDatabase();
    await client.close();
    await writeFile(configFile, configBefore);
    await rm(temp, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
