/**
 * Auth Store Tests (Zustand)
 * Tests login, logout, token management, and RBAC helpers
 */
import { act } from "@testing-library/react";

// Reset modules between tests to get fresh store
let useAuthStore;
// Mock services/api so the store can import without network/axios
vi.mock("../services/api", () => ({
  __esModule: true,
  authAPI: {
    refresh: vi.fn().mockResolvedValue({ data: {} }),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();

  // Re-import to get a fresh store (use ESM import to play nicely with vitest mocks)
  const mod = await import("../store/authStore");
  useAuthStore = mod.default || mod.useAuthStore;
});

describe("Auth Store", () => {
  it("should start with unauthenticated state", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeUndefined();
  });

  it("should login and set user/token", () => {
    const { login } = useAuthStore.getState();

    act(() => {
      login(
        {
          _id: "u1",
          name: "Test",
          email: "test@test.com",
          role: "student",
        },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user.name).toBe("Test");
    expect(state.token).toBeUndefined();
  });

  it("should logout and clear state", async () => {
    const { login, logout } = useAuthStore.getState();

    act(() => {
      login(
        {
          _id: "u1",
          name: "Test",
          email: "test@test.com",
          role: "student",
        },
        "jwt-token",
        "refresh-token",
      );
    });

    await act(async () => {
      await logout();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeUndefined();
  });

  it("should check roles correctly", () => {
    const { login } = useAuthStore.getState();

    act(() => {
      login(
        {
          _id: "u1",
          name: "Admin",
          email: "admin@test.com",
          role: "admin",
        },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    expect(state.isAdmin()).toBe(true);
    expect(state.isStudent()).toBe(false);
    expect(state.hasRole("admin")).toBe(true);
  });

  // --- Tier permission tests ---
  it("should return tier from user object", () => {
    const { login } = useAuthStore.getState();

    act(() => {
      login(
        {
          _id: "u1",
          name: "VIP",
          email: "vip@test.com",
          role: "student",
          tier: "vip",
        },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    expect(state.getTier()).toBe("vip");
  });

  it("should default tier to normal if missing", () => {
    const { login } = useAuthStore.getState();

    act(() => {
      login(
        { _id: "u1", name: "Basic", email: "basic@test.com", role: "student" },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    expect(state.getTier()).toBe("normal");
  });

  it("should check trial expiry correctly (not expired)", () => {
    const { login } = useAuthStore.getState();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    act(() => {
      login(
        {
          _id: "u1",
          name: "Trial",
          email: "trial@test.com",
          tier: "trial",
          trialExpiresAt: future,
        },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    expect(state.isTrialExpired()).toBe(false);
    expect(state.getTrialDaysRemaining()).toBeGreaterThan(0);
  });

  it("should check trial expiry correctly (expired)", () => {
    const { login } = useAuthStore.getState();
    const past = new Date(Date.now() - 1000).toISOString();

    act(() => {
      login(
        {
          _id: "u1",
          name: "Expired",
          email: "exp@test.com",
          tier: "trial",
          trialExpiresAt: past,
        },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    expect(state.isTrialExpired()).toBe(true);
  });

  it("should return tier permissions for vip_plus", () => {
    const { login } = useAuthStore.getState();

    act(() => {
      login(
        {
          _id: "u1",
          name: "VIP+",
          email: "vipplus@test.com",
          tier: "vip_plus",
        },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    const perms = state.getTierPermissions();
    expect(perms).toBeTruthy();
    expect(state.hasTierPermission("aiCoach")).toBe(true);
    expect(state.hasTierPermission("aiSearch")).toBe(true);
  });

  it("should deny AI permissions for normal tier", () => {
    const { login } = useAuthStore.getState();

    act(() => {
      login(
        { _id: "u1", name: "Free", email: "free@test.com", tier: "normal" },
        "jwt-token",
        "refresh-token",
      );
    });

    const state = useAuthStore.getState();
    expect(state.hasTierPermission("ai_coach")).toBe(false);
    expect(state.hasTierPermission("ai_search")).toBe(false);
  });
});
