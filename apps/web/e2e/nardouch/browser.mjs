import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.NARDOUCH_BROWSER_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
let checks = 0;
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["microphone"],
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    window.__nardouchTestTracks = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      window.__nardouchTestTracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto("http://127.0.0.1:4179");
  await expect(
    page.getByRole("button", { name: "New conversation" }),
  ).toBeEnabled();
  await page
    .getByLabel("Learning mode", { exact: true })
    .selectOption("socratic");
  await page
    .getByLabel("Response language", { exact: true })
    .selectOption("darija");
  await page
    .getByLabel("Darija writing", { exact: true })
    .selectOption("arabizi");
  await page
    .getByLabel("Your question or answer", { exact: true })
    .fill("Ya Nardouch mafhemtech el récursivité");
  await page.getByRole("button", { name: "Ask Nardouch", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Nardouch response" }),
  ).toHaveCount(1);
  checks++;
  await page
    .getByRole("button", { name: "3lech base case?", exact: true })
    .click();
  await page.getByRole("button", { name: "Ask Nardouch", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Nardouch response" }),
  ).toHaveCount(2);
  checks++;
  await page
    .getByLabel("Your question or answer", { exact: true })
    .fill("provider down");
  await page.getByRole("button", { name: "Ask Nardouch", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Provider unavailable");
  await expect(
    page.getByLabel("Your question or answer", { exact: true }),
  ).toHaveValue("provider down");
  checks++;
  await page.getByLabel("Enable voice tools.", { exact: false }).check();
  await page
    .getByRole("button", { name: "Listen to this answer", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Audio is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Nardouch response" }),
  ).toHaveCount(2);
  checks++;
  await page
    .getByLabel("I agree to process my own recording", { exact: false })
    .check();
  await page
    .getByRole("button", { name: "Record a question", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByLabel("Review and correct your transcript", { exact: true }),
  ).toHaveValue("mafhemtech el stuck");
  await page
    .getByLabel("Review and correct your transcript", { exact: true })
    .fill("mafhemtech el stack");
  await page
    .getByRole("button", { name: "Use edited transcript", exact: true })
    .click();
  await expect(
    page.getByLabel("Your question or answer", { exact: true }),
  ).toHaveValue("mafhemtech el stack");
  await expect(
    page.getByRole("article", { name: "Nardouch response" }),
  ).toHaveCount(2);
  checks++;
  await page.getByRole("button", { name: "Ask Nardouch", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Nardouch response" }),
  ).toHaveCount(3);
  await expect(
    page.getByRole("article", { name: "Your message" }).last(),
  ).toContainText("mafhemtech el stack");
  checks++;
  await page
    .getByRole("button", { name: "Record a question", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Enable voice tools.", { exact: false }).uncheck();
  // Unmount must stop every active native microphone track.
  expect(
    await page.evaluate(() => window.__nardouchTestTracks.length),
  ).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__nardouchTestTracks.every((t) => t.readyState === "ended"),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  checks++;
  await page.screenshot({ path: "/tmp/nardouch-mobile.png", fullPage: true });
  await context.close();
  const denied = await browser.newContext();
  const deniedPage = await denied.newPage();
  await deniedPage.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await deniedPage.goto("http://127.0.0.1:4179");
  await expect(
    deniedPage.getByRole("button", { name: "New conversation" }),
  ).toBeEnabled();
  await deniedPage.getByLabel("Enable voice tools.", { exact: false }).check();
  await deniedPage
    .getByLabel("I agree to process my own recording", { exact: false })
    .check();
  await deniedPage
    .getByRole("button", { name: "Record a question", exact: true })
    .click();
  await expect(deniedPage.getByRole("alert")).toContainText(
    "Microphone access failed",
  );
  await expect(
    deniedPage.getByLabel("Your question or answer", { exact: true }),
  ).toBeEnabled();
  checks++;
  const paid = await browser.newPage();
  await paid.goto("http://127.0.0.1:4179/?audio=success");
  await expect(
    paid.getByRole("button", { name: "New conversation" }),
  ).toBeEnabled();
  await paid
    .getByLabel("Your question or answer", { exact: true })
    .fill("Explain recursion");
  await paid.getByRole("button", { name: "Ask Nardouch", exact: true }).click();
  await paid.getByLabel("Enable voice tools.", { exact: false }).check();
  await paid
    .getByRole("button", { name: "Listen to this answer", exact: true })
    .evaluate((el) => {
      el.click();
      el.click();
    });
  await expect(paid.getByLabel("Spoken Nardouch answer")).toBeVisible();
  expect(await paid.evaluate(() => window.__nardouchSpeechCalls)).toBe(1);
  checks++;
  await paid.getByRole("button", { name: "Replay answer" }).click();
  await paid.getByRole("button", { name: "Stop playback" }).click();
  expect(
    await paid.getByLabel("Spoken Nardouch answer").evaluate((el) => el.paused),
  ).toBe(true);
  expect(await paid.evaluate(() => window.__nardouchSpeechCalls)).toBe(1);
  checks++;
  await paid.getByLabel("Enable voice tools.", { exact: false }).uncheck();
  await paid.getByLabel("Enable voice tools.", { exact: false }).check();
  await expect(paid.getByLabel("Spoken Nardouch answer")).toBeVisible();
  expect(await paid.evaluate(() => window.__nardouchSpeechCalls)).toBe(1);
  checks++;
  await paid.close();
  if (process.env.NARDOUCH_PIPER_WAV) {
    const audioPage = await browser.newPage();
    await audioPage.route("https://nardouch-audio.test/answer.wav", (route) =>
      route.fulfill({
        path: process.env.NARDOUCH_PIPER_WAV,
        contentType: "audio/wav",
      }),
    );
    await audioPage.setContent(
      '<audio controls src="https://nardouch-audio.test/answer.wav"></audio><button onclick="document.querySelector(\'audio\').play()">Play generated WAV</button>',
    );
    await expect
      .poll(() => audioPage.locator("audio").evaluate((el) => el.readyState))
      .toBeGreaterThanOrEqual(2);
    await audioPage.getByRole("button", { name: "Play generated WAV" }).click();
    await expect
      .poll(() => audioPage.locator("audio").evaluate((el) => el.currentTime))
      .toBeGreaterThan(0);
    await audioPage.close();
    checks++;
  }
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      passed: checks,
      transport: "test fixture",
      browser: "Chromium",
      liveProviderQuality: "not measured",
    }),
  );
} finally {
  await browser.close();
}
