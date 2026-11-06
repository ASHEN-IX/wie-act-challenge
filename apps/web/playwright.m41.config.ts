import { defineConfig, devices } from "@playwright/test";
const db = process.env.FINAL_QA_DB || "test_formula_final_" + Date.now();
process.env.FINAL_QA_DB = db;
export default defineConfig({
  testDir: "./e2e",
  testMatch: "batch4-m41-planning.spec.ts",
  workers: 1,
  timeout: 240000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5360",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "pnpm --filter api build && pnpm --filter api exec tsx tests/final-acceptance-server.ts",
      url: "http://localhost:5361/api/v1/health",
      timeout: 180000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 20000 },
      env: {
        FINAL_QA_DB: db,
        FINAL_QA_SEED_M41: "true",
        ...(process.env.FINAL_QA_DOCKER_NETWORK
          ? { FINAL_QA_DOCKER_NETWORK: process.env.FINAL_QA_DOCKER_NETWORK }
          : {}),
      },
    },
    {
      command: "pnpm exec next dev --port 5360",
      url: "http://localhost:5360",
      timeout: 120000,
      env: {
        MONGODB_URI: "mongodb://127.0.0.1:27017/" + db,
        BETTER_AUTH_SECRET: "isolated-final-browser-secret-at-least-32-chars",
        BETTER_AUTH_URL: "http://localhost:5360",
        AUTH_TRUSTED_ORIGINS: "http://localhost:5360",
        BACKEND_URL: "http://localhost:5361",
        EDNOVA_NEXT_DIST_DIR: ".next-m41-e2e",
      },
    },
  ],
});
