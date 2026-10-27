/**
 * Global setup for Playwright tests
 * Configures the shared browser origin; managed auth tests use real local services.
 */

const globalSetup = async () => {
  console.log("🌐 Playwright Global Setup - Initializing test environment");

  process.env.PLAYWRIGHT_TEST_BASE_URL =
    process.env.E2E_BASE_URL || process.env.AUTH_E2E_ORIGIN || "http://localhost:5173";

  console.log("✅ Test environment ready");

  return async () => {
    console.log("🧹 Cleaning up test environment");
  };
};

export default globalSetup;
