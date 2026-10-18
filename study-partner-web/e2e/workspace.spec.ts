import { test, expect, type Page } from "@playwright/test";
const password = "WorkspacePass!123";
async function account(page: Page) {
  const email = `workspace-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("EdNova Learner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  const mailBase = process.env.AUTH_TEST_MAIL_URL || "http://127.0.0.1:8026";
  const messages = await (
    await page.request.get(`${mailBase}/api/v1/messages`)
  ).json();
  const summary = messages.messages.find((m: { To: { Address: string }[] }) =>
    m.To.some((r) => r.Address === email),
  );
  const mail = await (
    await page.request.get(`${mailBase}/api/v1/message/${summary.ID}`)
  ).json();
  await page.goto(mail.Text.match(/https?:\/\/\S+/)[0]);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}
test("native Server Actions create/update tasks and subjects, persist profile and enforce admin access", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await account(page);
  await page.goto("/tasks");
  await page
    .getByLabel("What will you work on?")
    .fill("Explain database normalization");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Explain database normalization" }),
  ).toBeVisible();
  const row = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Explain database normalization",
    }),
  });
  await row.getByRole("combobox").selectOption("completed");
  await row.getByRole("button", { name: "Update", exact: true }).click();
  await expect(row.getByRole("status")).toContainText("Task updated");
  await page.reload();
  await expect(row.getByRole("combobox")).toHaveValue("completed");
  await page.goto("/courses/new");
  await page.getByLabel("Subject name").fill("Computer Science");
  await page
    .getByRole("button", { name: "Create subject", exact: true })
    .click();
  await expect(page.getByLabel("Course title")).toBeVisible();
  await page.goto("/courses");
  await expect(
    page.getByRole("heading", { name: "Your courses" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/ednova-courses-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Your courses" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/ednova-courses-mobile.png",
    fullPage: true,
  });
  await page.goto("/profile");
  await page.getByLabel("Display name").fill("Curious Learner");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Profile updated");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Curious Learner");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
  expect(errors).toEqual([]);
});
test("room creation and invite-code joining work across two separate users", async ({
  page,
  browser,
}) => {
  await account(page);
  await page.goto("/study-together");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(page).toHaveURL(/\/study-together\/[a-z0-9]+/i);
  const roomUrl = page.url();
  const code = await page.getByTestId("invite-code").innerText();
  const peerContext = await browser.newContext();
  const peer = await peerContext.newPage();
  await account(peer);
  await peer.goto("/study-together");
  await peer.getByLabel("Invite code").fill(code);
  await peer.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(peer).toHaveURL(roomUrl);
  await expect(
    peer.getByRole("heading", { name: "Participants", exact: true }),
  ).toBeVisible();
  await peer.getByRole("button", { name: "Leave room", exact: true }).click();
  await expect(peer).toHaveURL(/\/study-together$/);
  await peer.goto(roomUrl);
  await expect(peer.getByRole("alert")).toBeVisible();
  await expect(
    peer.getByRole("heading", { name: "Session questions" }),
  ).toHaveCount(0);
  await peerContext.close();
});
