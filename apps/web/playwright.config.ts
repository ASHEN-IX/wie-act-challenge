import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.AUTH_E2E_WEB_PORT || 5173);
const apiPort = Number(process.env.AUTH_E2E_API_PORT || 3001);
const origin = `http://localhost:${webPort}`;
const database = `ednova_auth_browser_${process.pid}_${Date.now()}`;
// A dedicated database per run; the API harness creates and migrates it.
const testDatabaseUrl = new URL(
  "postgresql://ednova:ednova@127.0.0.1:5433/" + database
);
process.env.AUTH_E2E_ORIGIN = origin;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  // Run .spec.ts or .spec.js files
  testMatch: "**/*.spec.[jt]s",
  testIgnore: "**/*.integration.spec.[jt]s",
  fullyParallel: false, // Disable parallel to avoid port conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Use single worker for E2E tests
  reporter: "html",
  timeout: 30_000,

  use: {
    baseURL: process.env.E2E_BASE_URL || origin,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : process.env.AUTH_E2E === "1"
    ? [
        {
          command:
            "pnpm --filter api build && pnpm --filter api exec tsx tests/browser-server.ts",
          url: `http://localhost:${apiPort}/api/v1/health`,
          timeout: 60000,
          env: {
            AUTH_E2E_WEB_PORT: String(webPort),
            AUTH_E2E_API_PORT: String(apiPort),
            AUTH_E2E_DB_NAME: database,
          },
        },
        {
          command: `pnpm exec next dev --port ${webPort}`,
          cwd: process.env.AUTH_E2E_WEB_DIR,
          url: origin,
          timeout: 120000,
          env: {
            DATABASE_URL: testDatabaseUrl.toString(),
            BETTER_AUTH_SECRET:
              "isolated-browser-test-secret-at-least-32-characters",
            BETTER_AUTH_URL: origin,
            AUTH_TRUSTED_ORIGINS: origin,
            BACKEND_URL: `http://localhost:${apiPort}`,
            NEXT_PUBLIC_WS_URL: `ws://localhost:${apiPort}`,
            EDNOVA_NEXT_DIST_DIR: process.env.AUTH_E2E_WEB_DIR ? ".next" : ".next-e2e",
            SMTP_HOST: "127.0.0.1",
            SMTP_PORT: "1026",
            SMTP_SECURE: "false",
          },
        },
      ]
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },

  // Global setup to initialize test environment
  globalSetup: "./e2e/global-setup.ts",
});
