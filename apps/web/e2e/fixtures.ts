import { test as base, Route } from "@playwright/test";

/**
 * Fixture to mock API responses
 * Prevents real API calls during E2E tests
 */
export const test = base.extend<{
  mockAPI: {
    mockResponse: (pattern: string | RegExp, handler: (route: Route) => Promise<void> | void) => Promise<void>;
  };
}>({
  mockAPI: async ({ page }, use) => {
    // Mock auth endpoints
    await page.route("**/api/v1/auth/register", (route) => {
      route.abort("blockedbyclient");
    });

    await page.route("**/api/v1/auth/login", (route) => {
      route.abort("blockedbyclient");
    });

    await page.route("**/api/v1/auth/logout", (route) => {
      route.abort("blockedbyclient");
    });

    // Mock dashboard/data endpoints
    await page.route("**/api/v1/tasks/**", (route) => {
      route.abort("blockedbyclient");
    });

    await page.route("**/api/v1/sessions/**", (route) => {
      route.abort("blockedbyclient");
    });

    await page.route("**/api/v1/study-plans/**", (route) => {
      route.abort("blockedbyclient");
    });

    // Provide hook to enable selective mocks in tests
    const mockResponse = async (
      pattern: string | RegExp,
      handler: (route: Route) => Promise<void> | void
    ) => {
      await page.route(pattern, handler);
    };

    await use({ mockResponse });
  },
});
