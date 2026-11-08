import { test, expect } from "@playwright/test";
import path from "node:path";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.log("Browser error:", error.message));
});
const evidence = path.resolve(__dirname, "../../../../var/tmp");
test("Baby grows per course, survives reload, and waits for accepted checks to graduate", async ({
  page,
}) => {
  await page.goto("/");
  const companion = page.getByRole("region", { name: "Your course Nardouch" });
  await expect(companion).toHaveAttribute("data-nardouch-stage", "baby");
  for (const stage of ["learner", "explorer", "expert", "expert"]) {
    await companion
      .getByRole("button", { name: "Complete lesson", exact: true })
      .click();
    await expect(companion).toHaveAttribute("data-nardouch-stage", stage);
  }
  await expect(
    companion.getByRole("link", { name: "Open course checks" }),
  ).toBeVisible();
  await page.reload();
  await expect(companion).toHaveAttribute("data-nardouch-stage", "expert");
  await page.getByRole("button", { name: "Course B", exact: true }).click();
  await expect(companion).toHaveAttribute("data-nardouch-stage", "baby");
  await page.getByRole("button", { name: "Course A", exact: true }).click();
  await expect(companion).toHaveAttribute("data-nardouch-stage", "expert");
  await page
    .getByRole("button", { name: "Accept reviewed check (test fixture)" })
    .click();
  await expect(companion).toHaveAttribute("data-nardouch-stage", "graduate");
  await page.reload();
  await expect(companion).toHaveAttribute("data-nardouch-stage", "graduate");
  await expect(companion.getByRole("img")).toHaveJSProperty(
    "naturalWidth",
    1254,
  );
  await page.screenshot({
    path: path.join(evidence, "nardouch-growth-graduate.png"),
    fullPage: true,
  });
});
test("a failed save retains Baby and mobile content fits the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?failSave=1");
  const companion = page.getByRole("region", { name: "Your course Nardouch" });
  await expect(companion).toHaveAttribute("data-nardouch-stage", "baby");
  await companion
    .getByRole("button", { name: "Complete lesson", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await expect(companion).toHaveAttribute("data-nardouch-stage", "baby");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(evidence, "nardouch-growth-mobile.png"),
    fullPage: true,
  });
});
test("real Next landing page serves the new art and describes course-based graduation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5373");
  page.on("console", (message) => {
    if (message.type() === "error")
      console.log("Landing console:", message.text().slice(0, 600));
  });
  const reveal = async () => {
    await expect(page.locator(".hero-nardouch")).toHaveCSS("opacity", "1");
    for (const node of await page
      .locator(
        ".feature-tile, .how-heading, .how-step, .evolution-copy, .evolution-character, .journey-banner",
      )
      .all()) {
      await node.scrollIntoViewIfNeeded();
      // Desktop stages reveal as the pinned timeline advances. Scrolling the
      // character itself into view does not advance that timeline.
      if (await node.getAttribute("data-stage")) {
        for (let step = 0; step < 16; step++) {
          if (await node.evaluate((el) => getComputedStyle(el).opacity === "1")) break;
          await page.mouse.wheel(0, 250);
          await page.waitForTimeout(125); // Allow the scrubbed reveal to advance.
        }
      }
      await expect(node).toHaveCSS("opacity", "1");
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  };
  const hero = page.locator(".hero-nardouch img");
  await expect(hero).toBeVisible();
  await expect(hero).toHaveCSS("mask-image", "none");
  await expect(hero).toHaveAttribute("src", /nardouch-hero-transparent\.png/);
  await expect(hero).toHaveJSProperty("complete", true);
  expect(
    await hero.evaluate((node: HTMLImageElement) => node.naturalWidth),
  ).toBeGreaterThan(0);
  await page.locator("#nardouch").scrollIntoViewIfNeeded();
  await expect(
    page.getByText(
      "Complete every lesson and pass the course checks to unlock Graduate Nardouch.",
    ),
  ).toBeVisible();
  const images = page.locator(".evolution-character img");
  await expect(images).toHaveCount(5);
  for (const image of await images.all()) {
    await expect(image).toHaveCSS("mask-image", "none");
    await expect(image).toHaveAttribute(
      "src",
      /nardouch-(baby|learner|explorer|expert|graduate)-transparent\.png/,
    );
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBeGreaterThan(0);
  }
  await reveal();
  await page.screenshot({
    path: path.join(evidence, "nardouch-growth-landing.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await reveal();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(evidence, "nardouch-growth-landing-mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
