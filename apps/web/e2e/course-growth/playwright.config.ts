import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: __dirname,
  testMatch: "*.spec.ts",
  workers: 1,
  reporter: "list",
  timeout: 60000,
  outputDir: path.resolve(
    __dirname,
    "../../../../var/tmp/nardouch-growth-browser",
  ),
  use: { baseURL: "http://127.0.0.1:4181", headless: true },
  webServer: [
    {
      command:
        "node node_modules/vite/bin/vite.js --config e2e/course-growth/vite.config.ts",
      cwd: path.resolve(__dirname, "../.."),
      url: "http://127.0.0.1:4181",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm exec next dev --port 5373",
      cwd: path.resolve(__dirname, "../.."),
      url: "http://localhost:5373",
      timeout: 120000,
      env: { EDNOVA_NEXT_DIST_DIR: ".next-growth-qa" },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
