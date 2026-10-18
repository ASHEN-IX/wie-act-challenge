import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { existsSync } from "node:fs";

const read = (rel) => readFileSync(resolve(process.cwd(), rel), "utf8");

const authStorePath = existsSync(resolve(process.cwd(), "src/store/authStore.ts"))
  ? "src/store/authStore.ts"
  : "src/store/authStore.js";
const authStoreSrc = read(authStorePath);
const apiPath = existsSync(resolve(process.cwd(), "src/services/api.ts"))
  ? "src/services/api.ts"
  : "src/services/api.js";
const apiSrc = read(apiPath);

describe("SEC-04 static: no auth token in JS-accessible state", () => {
  it("authStore never stores or reads a refresh token", () => {
    expect(authStoreSrc).not.toMatch(/refreshToken/);
    expect(authStoreSrc).not.toMatch(/accessToken/);
  });

  it("does not persist authentication claims in browser storage", () => {
    expect(authStoreSrc).not.toMatch(/partialize|localStorage|persist\(/);
    expect(authStoreSrc).toMatch(/authAPI.getMe/);
  });

  it("axios relies on cookies only and never posts a token", () => {
    expect(apiSrc).toMatch(/withCredentials:\s*true/);
    expect(apiSrc).not.toMatch(
      /api\.post\(\s*["']\/api\/v1\/auth\/refresh["']\s*,\s*\{\s*refreshToken/,
    );
    expect(apiSrc).not.toMatch(/getState\(\)\.refreshToken/);
    expect(apiSrc).not.toMatch(/config\.headers\.?\[?["']?Authorization/);
  });

  it("delegates authentication and renewal to Better Auth", () => {
    expect(apiSrc).toMatch(/authClient.signIn.email/);
    expect(apiSrc).not.toMatch(/_pendingRefresh|originalRequest._retry/);
  });
});
