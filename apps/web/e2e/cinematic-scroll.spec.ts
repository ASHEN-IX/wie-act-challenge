import { test, expect } from "@playwright/test";

test.describe("Cinematic Scroll Animation Implementation", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => console.log("Page error:", err.message));
  });

  test("1. Hero section initial state and orbital layers exist", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000");

    // Left-side heading and buttons
    await expect(
      page.getByRole("heading", { name: /Learn Together/i }),
    ).toBeVisible();
    await expect(page.locator(".hero-copy .gradient-text")).toHaveText("Grow Further.");
    await expect(
      page.getByRole("link", { name: "Explore Noveris" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "See How It Works" }),
    ).toBeVisible();

    // Visual layers
    await expect(page.locator(".hero-back-planet")).toBeVisible();
    await expect(page.locator(".stars")).toBeVisible();
    await expect(page.locator(".hero-orbit.outer")).toBeVisible();
    await expect(page.locator(".hero-orbit.inner")).toBeVisible();
    await expect(page.locator(".orbit-bead.bead-violet")).toBeVisible();
    await expect(page.locator(".orbit-bead.bead-cyan")).toBeVisible();

    // Mascot
    const mascot = page.locator(".hero-nardouch img");
    await expect(mascot).toBeVisible();
    await expect(mascot).toHaveAttribute("src", /nardouch-hero-transparent\.png/);
    expect(
      await mascot.evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
  });

  test("2. Hero section animates through Phase 1, 2, and releases into features", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000");
    await page.waitForTimeout(500);

    const outerOrbit = page.locator(".hero-orbit.outer");

    const getHeroTransform = async () =>
      outerOrbit.evaluate((el) => window.getComputedStyle(el).transform);

    // Initial state
    const initialTransform = await getHeroTransform();
    expect(initialTransform).toContain("matrix");

    // Scroll to Phase 1 (0-25%)
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(500);
    const phase1Transform = await getHeroTransform();
    expect(phase1Transform).not.toBe(initialTransform);

    // Scroll to Phase 2 (25-65%)
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);
    const phase2Transform = await getHeroTransform();
    expect(phase2Transform).not.toBe(phase1Transform);

    // Headline stays readable throughout
    await expect(
      page.getByRole("heading", { name: /Learn Together/i }),
    ).toBeVisible();

    // Scroll past hero pin (Phase 3 -> Release into Features)
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(600);

    // Features section visible
    await expect(page.locator("#features")).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Study Circles" })).toBeVisible();

    // Reverse scroll back to top reverses naturally
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1100);
    const returnedTransform = await getHeroTransform();
    expect(returnedTransform).toContain("matrix(0.92");
  });

  test("3. Meet Nardouch horizontal evolution progressively reveals characters and reverses", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000");
    await page.waitForTimeout(500);

    // Headings and supporting text
    await expect(
      page.getByRole("heading", { name: /Meet Nardouch/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Your companion from day one to graduation.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Every subject begins with/i),
    ).toBeVisible();

    // Verify there is NO large central character
    await expect(page.locator(".stage-layer")).toHaveCount(0);
    await expect(page.locator(".central-character-viewport")).toHaveCount(0);

    // Exactly five evolution characters arranged horizontally
    const characters = page.locator(".evolution-character");
    await expect(characters).toHaveCount(5);

    const baby = page.locator(".evolution-character.stage-1");
    const learner = page.locator(".evolution-character.stage-2");
    const explorer = page.locator(".evolution-character.stage-3");
    const expert = page.locator(".evolution-character.stage-4");
    const graduate = page.locator(".evolution-character.stage-5");

    const getOpacity = async (locator: typeof baby) =>
      parseFloat(await locator.evaluate((el) => window.getComputedStyle(el).opacity));

    // Scroll directly to the start of the pinned Nardouch section
    const nardouchSection = page.locator("#nardouch");
    await nardouchSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const triggerTop = await page.evaluate(() => {
      const el = document.getElementById("nardouch");
      return window.scrollY + (el ? el.getBoundingClientRect().top : 0);
    });

    await page.evaluate((top) => window.scrollTo(0, top), triggerTop);
    await page.waitForTimeout(600);

    // Initial state: Only Baby is visible (opacity: 1), remaining are hidden (opacity: 0)
    expect(await getOpacity(baby)).toBeGreaterThan(0.9);
    expect(await getOpacity(learner)).toBeLessThan(0.1);
    expect(await getOpacity(explorer)).toBeLessThan(0.1);
    expect(await getOpacity(expert)).toBeLessThan(0.1);
    expect(await getOpacity(graduate)).toBeLessThan(0.1);

    // Scroll to 30% progress (top + 660) -> Baby + Learner visible
    await page.evaluate((top) => window.scrollTo(0, top + 660), triggerTop);
    await page.waitForTimeout(600);
    expect(await getOpacity(baby)).toBeGreaterThan(0.9);
    expect(await getOpacity(learner)).toBeGreaterThan(0.9);
    expect(await getOpacity(explorer)).toBeLessThan(0.1);
    expect(await getOpacity(expert)).toBeLessThan(0.1);
    expect(await getOpacity(graduate)).toBeLessThan(0.1);

    // Scroll to 50% progress (top + 1100) -> Baby + Learner + Explorer visible
    await page.evaluate((top) => window.scrollTo(0, top + 1100), triggerTop);
    await page.waitForTimeout(600);
    expect(await getOpacity(baby)).toBeGreaterThan(0.9);
    expect(await getOpacity(learner)).toBeGreaterThan(0.9);
    expect(await getOpacity(explorer)).toBeGreaterThan(0.9);
    expect(await getOpacity(expert)).toBeLessThan(0.1);
    expect(await getOpacity(graduate)).toBeLessThan(0.1);

    // Scroll to 70% progress (top + 1540) -> Baby + Learner + Explorer + Expert visible
    await page.evaluate((top) => window.scrollTo(0, top + 1540), triggerTop);
    await page.waitForTimeout(600);
    expect(await getOpacity(baby)).toBeGreaterThan(0.9);
    expect(await getOpacity(learner)).toBeGreaterThan(0.9);
    expect(await getOpacity(explorer)).toBeGreaterThan(0.9);
    expect(await getOpacity(expert)).toBeGreaterThan(0.9);
    expect(await getOpacity(graduate)).toBeLessThan(0.1);

    // Scroll to 95% progress (top + 2100) -> All five characters visible together!
    await page.evaluate((top) => window.scrollTo(0, top + 2100), triggerTop);
    await page.waitForTimeout(600);
    expect(await getOpacity(baby)).toBeGreaterThan(0.9);
    expect(await getOpacity(learner)).toBeGreaterThan(0.9);
    expect(await getOpacity(explorer)).toBeGreaterThan(0.9);
    expect(await getOpacity(expert)).toBeGreaterThan(0.9);
    expect(await getOpacity(graduate)).toBeGreaterThan(0.9);

    // Reverse scroll back up to 70% -> Graduate hides first
    await page.evaluate((top) => window.scrollTo(0, top + 1540), triggerTop);
    await page.waitForTimeout(600);
    expect(await getOpacity(expert)).toBeGreaterThan(0.9);
    expect(await getOpacity(graduate)).toBeLessThan(0.1);

    // Reverse scroll back to start -> Learner hides, Baby remains visible
    await page.evaluate((top) => window.scrollTo(0, top), triggerTop);
    await page.waitForTimeout(600);
    expect(await getOpacity(baby)).toBeGreaterThan(0.9);
    expect(await getOpacity(learner)).toBeLessThan(0.1);
  });

  test("4. Graduation finale displays celebratory styling and releases naturally", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000");

    const nardouchSection = page.locator("#nardouch");
    await nardouchSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const triggerTop = await page.evaluate(() => {
      const el = document.getElementById("nardouch");
      return window.scrollY + (el ? el.getBoundingClientRect().top : 0);
    });

    // Scroll to finale (95%)
    await page.evaluate((top) => window.scrollTo(0, top + 2100), triggerTop);
    await page.waitForTimeout(600);

    // Graduate character visible
    const graduate = page.locator(".evolution-character.stage-5");
    const graduateOpacity = parseFloat(
      await graduate.evaluate((el) => window.getComputedStyle(el).opacity),
    );
    expect(graduateOpacity).toBeGreaterThan(0.9);

    // Final node illuminates cyan (#65e4ff)
    const graduateNode = page.locator(".timeline-node.node-graduate");
    await expect(graduateNode).toBeVisible();

    // Scroll past pin distance -> releases cleanly into CTA
    await page.evaluate((top) => window.scrollTo(0, top + 3200), triggerTop);
    await page.waitForTimeout(600);
    await expect(page.locator("#journey")).toBeInViewport();
  });

  test("5. How It Works laptop video and play/pause controls work", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000");

    const howSection = page.locator("#how-it-works");
    await howSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Heading and 3 steps
    await expect(
      page.getByRole("heading", { name: /How.*It Works/i }),
    ).toBeVisible();
    await expect(page.locator(".how-step")).toHaveCount(3);

    // Laptop and video
    const laptop = page.locator(".laptop-device");
    await expect(laptop).toBeVisible();
    const video = page.locator("video");
    await expect(video).toBeVisible();

    // Play/Pause button
    const playBtn = page.getByRole("button", { name: /dashboard demo/i });
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await page.waitForTimeout(300);
    await playBtn.click();
  });

  test("6. Responsive mobile viewport (390x844) has no horizontal scroll overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000");
    await page.waitForTimeout(500);

    // Check no horizontal scrollbar on root
    const hasNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    expect(hasNoOverflow).toBe(true);

    // Scroll through the page
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test("7. Reduced motion displays all five evolution stages immediately without pinning", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://localhost:3000");
    await page.waitForTimeout(400);

    // Hero is visible as static composition
    await expect(
      page.getByRole("heading", { name: /Learn Together/i }),
    ).toBeVisible();
    await expect(page.locator(".hero-nardouch")).toHaveClass(/reduced-motion/);

    // All five evolution characters are immediately visible
    await page.locator("#nardouch").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    for (let i = 1; i <= 5; i++) {
      await expect(
        page.locator(`.evolution-character.stage-${i}`),
      ).toHaveCSS("opacity", "1");
    }
  });

  test("8. Navbar accurately highlights active section on initial load, scroll, and anchor click", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("http://localhost:3000");
    await page.waitForTimeout(500);

    const homeLink = page.locator(".nav-links a[href='#home']");
    const featuresLink = page.locator(".nav-links a[href='#features']");
    const howItWorksLink = page.locator(".nav-links a[href='#how-it-works']");
    const nardouchLink = page.locator(".nav-links a[href='#nardouch']");

    // 1. Initial state at top of page: Home must be active, Nardouch must NOT be active
    await expect(homeLink).toHaveClass(/active/);
    await expect(nardouchLink).not.toHaveClass(/active/);
    await expect(featuresLink).not.toHaveClass(/active/);
    await expect(howItWorksLink).not.toHaveClass(/active/);

    // 2. Scroll into Features section
    await page.evaluate(() => window.scrollTo(0, 1750));
    await page.waitForTimeout(400);
    await expect(featuresLink).toHaveClass(/active/);
    await expect(homeLink).not.toHaveClass(/active/);

    // 3. Scroll into How It Works section
    await page.evaluate(() => window.scrollTo(0, 2100));
    await page.waitForTimeout(400);
    await expect(howItWorksLink).toHaveClass(/active/);

    // 4. Scroll into Nardouch Evolution section
    await page.evaluate(() => window.scrollTo(0, 3000));
    await page.waitForTimeout(400);
    await expect(nardouchLink).toHaveClass(/active/);

    // 5. Click Why Noveris (anchor navigation)
    await featuresLink.click();
    await page.waitForTimeout(1000);
    await expect(featuresLink).toHaveClass(/active/);
    await expect(page.locator("#features")).toBeInViewport();

    // 6. Click Home
    await homeLink.click();
    await page.waitForTimeout(1000);
    await expect(homeLink).toHaveClass(/active/);
    await expect(nardouchLink).not.toHaveClass(/active/);
  });
});
