/**
 * Global setup for Playwright tests
 * Configures API mocking for all tests
 */

const globalSetup = async () => {
  console.log("🌐 Playwright Global Setup - Initializing test environment");

  process.env.PLAYWRIGHT_TEST_BASE_URL =
    process.env.E2E_BASE_URL || "http://localhost:5173";

  console.log("✅ Test environment ready");

  return async () => {
    console.log("🧹 Cleaning up test environment");
  };
};

export default globalSetup;
