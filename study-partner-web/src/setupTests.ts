/* global globalThis */
import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

// BLOOM-11: register the jest-axe a11y matcher (expect(...).toHaveNoViolations())
expect.extend(toHaveNoViolations);

// Provide a `jest` alias for tests written against Jest APIs
if (
  typeof (globalThis as any).jest === "undefined" &&
  typeof (globalThis as any).vi !== "undefined"
) {
  (globalThis as any).jest = (globalThis as any).vi;
}

// Retained component tests use an in-memory navigation adapter. Playwright tests the actual Next router.
vi.mock("@/navigation", async () => await import("react-router-dom"));
