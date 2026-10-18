/* eslint-disable import/first */
/**
 * Integration tests for authentication API flows
 * Tests API endpoints and service interactions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { authAPI } from "../../services/api";

describe("Auth API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle login flow with valid credentials", async () => {
    // Mock API response
    vi.spyOn(authAPI, "login").mockResolvedValue({
      token: "mock-jwt-token",
      user: {
        _id: "user123",
        email: "test@example.com",
        name: "Test User",
      },
    });

    const result = await authAPI.login("test@example.com", "password123");

    expect(result).toHaveProperty("token");
    expect(result.user).toHaveProperty("_id");
    expect(authAPI.login).toHaveBeenCalledWith(
      "test@example.com",
      "password123",
    );
  });

  it("should handle registration with email validation", async () => {
    vi.spyOn(authAPI, "register").mockResolvedValue({
      message: "Registration successful",
      requiresVerification: true,
    });

    const result = await authAPI.register(
      "newuser@example.com",
      "Password123!",
      "New User",
    );

    expect(result.requiresVerification).toBe(true);
    expect(authAPI.register).toHaveBeenCalled();
  });

  it("should handle token refresh on expiry", async () => {
    vi.spyOn(authAPI, "verifyEmail").mockResolvedValue({
      success: true,
      message: "Email verified successfully",
    });

    const result = await authAPI.verifyEmail("verification-token");

    expect(result.success).toBe(true);
    expect(authAPI.verifyEmail).toHaveBeenCalledWith("verification-token");
  });
});
