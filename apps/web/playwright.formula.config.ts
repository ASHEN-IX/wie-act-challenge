import { defineConfig, devices } from "@playwright/test";
const db =
  process.env.FORMULA_E2E_DB_NAME || "test_formula_browser_" + Date.now();
process.env.FORMULA_E2E_DB_NAME = db;
export default defineConfig({
  testDir: "./e2e",
  testMatch: process.env.FORMULA_PUBLICATION_E2E === "1" ? "formula-publication.spec.ts" : "formula-review.spec.ts",
  workers: 1,
  timeout: 90000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5350",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "pnpm --filter api build && pnpm --filter api exec tsx tests/formula-browser-server.ts",
      url: "http://localhost:5351/api/v1/health",
      timeout: 120000,
      env: { FORMULA_E2E_DB_NAME: db },
    },
    {
      command: "pnpm exec next dev --port 5350",
      url: "http://localhost:5350",
      timeout: 120000,
      env: {
        MONGODB_URI: "mongodb://127.0.0.1:27017/" + db,
        BETTER_AUTH_SECRET: "isolated-formula-browser-secret-at-least-32-chars",
        BETTER_AUTH_URL: "http://localhost:5350",
        AUTH_TRUSTED_ORIGINS: "http://localhost:5350",
        BACKEND_URL: "http://localhost:5351",
        EDNOVA_NEXT_DIST_DIR: ".next-formula-e2e",
      },
    },
  ],
});
