/**
 * Inspect what the real published presentation actually contains, per lesson.
 * Diagnostic only; reads the API the browser already calls.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("reports/evidence/batch3");
const state = JSON.parse(
  await fs.readFile(path.join(OUT, "application-run.json"), "utf8").catch(() => "null"),
);

if (!state) {
  console.log("no application-run.json yet — run the harness first");
  process.exit(0);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto("http://localhost:5360/login");
await page.getByLabel("Email", { exact: true }).fill("final-student@example.test");
await page.getByLabel("Password", { exact: true }).fill("FinalPass!123");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL(/dashboard/);

const response = await page.request.get(
  `/api/v1/study/learning/courses/${state.courseId}/presentation?revisionId=${encodeURIComponent(state.revision)}`,
);
console.log("status", response.status());
const body = await response.json();

const summary = {
  status: body.verification?.status,
  math: body.verification?.math,
  lessons: body.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => {
      const mathBlocks = lesson.blocks.filter((entry) => entry.block.type === "math");
      const reviewed = mathBlocks.filter((entry) => entry.render === "primary");
      return {
        lessonId: lesson.id,
        title: lesson.title,
        mathTotal: mathBlocks.length,
        mathReviewed: reviewed.length,
        firstLesson: false,
      };
    }),
  ),
};
if (summary.lessons[0]) summary.lessons[0].firstLesson = true;

console.log(JSON.stringify(summary, null, 2));
await fs.writeFile(
  path.join(OUT, "presentation-lessons.json"),
  JSON.stringify({ capturedAt: new Date().toISOString(), revision: state.revision, summary }, null, 2),
);

await browser.close();
