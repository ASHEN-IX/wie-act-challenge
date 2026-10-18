import { act } from "@testing-library/react";

let useSessionStore;

const mockSessionsUpdate = vi.fn();

vi.mock("../services/api", () => ({
  __esModule: true,
  sessionSetupAPI: {
    setup: vi.fn(),
    completeTask: vi.fn(),
    skipTask: vi.fn(),
  },
  sessionsAPI: {
    update: (...args) => mockSessionsUpdate(...args),
  },
  teamSessionsAPI: {
    create: vi.fn(),
    joinByCode: vi.fn(),
    join: vi.fn(),
  },
  courseAPI: {
    list: vi.fn(),
    get: vi.fn(),
  },
}));

function seedActiveSessionState() {
  useSessionStore.setState({
    activeSession: {
      _id: "session-1",
      xpMultiplier: 1.25,
      duration: 3600,
    },
    selectedCourse: {
      title: "Physics",
    },
    taskProgress: {
      tasks: [
        { id: "t-1", status: "completed", xpEarned: 20 },
        { id: "t-2", status: "completed", xpEarned: 30 },
      ],
      currentTaskIndex: 1,
    },
  });
}

describe("sessionStore finishSession", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockSessionsUpdate.mockReset();

    const mod = await import("../store/sessionStore");
    useSessionStore = mod.default;

    useSessionStore.getState().resetSession();
    seedActiveSessionState();
  });

  it("uses provided completionRewards and skips duplicate completion update", async () => {
    await act(async () => {
      await useSessionStore.getState().finishSession({
        alreadyCompleted: true,
        completionRewards: {
          baseXP: 10,
          awardedXP: 88,
          multiplier: 1.1,
        },
      });
    });

    const state = useSessionStore.getState();
    expect(mockSessionsUpdate).not.toHaveBeenCalled();
    expect(state.step).toBe("summary");
    expect(state.sessionSummary.totalXP).toBe(88);
    expect(state.sessionSummary.completionRewards).toEqual(
      expect.objectContaining({ awardedXP: 88, baseXP: 10 }),
    );
  });

  it("pulls completionRewards from update response when not pre-completed", async () => {
    mockSessionsUpdate.mockResolvedValue({
      data: {
        completionRewards: {
          baseXP: 10,
          awardedXP: 120,
          multiplier: 1.2,
        },
      },
    });

    await act(async () => {
      await useSessionStore.getState().finishSession();
    });

    const state = useSessionStore.getState();
    expect(mockSessionsUpdate).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        status: "completed",
        endTime: expect.any(String),
      }),
    );
    expect(state.step).toBe("summary");
    expect(state.sessionSummary.totalXP).toBe(120);
    expect(state.sessionSummary.completionRewards).toEqual(
      expect.objectContaining({ awardedXP: 120 }),
    );
  });

  it("falls back to task XP total when no completionRewards are returned", async () => {
    mockSessionsUpdate.mockResolvedValue({ data: {} });

    await act(async () => {
      await useSessionStore.getState().finishSession();
    });

    const state = useSessionStore.getState();
    expect(state.step).toBe("summary");
    expect(state.sessionSummary.totalXP).toBe(50);
    expect(state.sessionSummary.completionRewards).toBeNull();
  });
});
