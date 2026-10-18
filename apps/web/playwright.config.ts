import { defineConfig, devices } from "@playwright/test";

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
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
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
          url: "http://localhost:3001/api/v1/health",
          timeout: 60000,
        },
        {
          command: "pnpm dev",
          url: "http://localhost:5173",
          timeout: 120000,
          env: {
            MONGODB_URI: "mongodb://127.0.0.1:27018/auth_browser_test",
            BETTER_AUTH_SECRET:
              "isolated-browser-test-secret-at-least-32-characters",
            BETTER_AUTH_URL: "http://localhost:5173",
            AUTH_TRUSTED_ORIGINS: "http://localhost:5173",
            BACKEND_URL: "http://localhost:3001",
            SMTP_HOST: "127.0.0.1",
            SMTP_PORT: "1026",
            SMTP_SECURE: "false",
          },
        },
      ]
    : {
        command: "pnpm dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },

  // Global setup to initialize test environment
  globalSetup: "./e2e/global-setup.ts",
});
