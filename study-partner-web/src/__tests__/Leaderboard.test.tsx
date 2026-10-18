/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/api", () => ({
  gamificationAPI: {
    getLeaderboard: vi.fn(),
    getProfile: vi.fn(),
    getRankLeaderboard: vi.fn(),
    getRankProfile: vi.fn(),
    getCurrentSeason: vi.fn(),
    getRankProgress: vi.fn(),
  },
  friendsAPI: { getAll: vi.fn() },
  profileAPI: { getOnlineStatusBatch: vi.fn() },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = { user: { _id: "u1", name: "Test" } };
      return sel ? sel(s) : s;
    },
    { getState: () => ({ user: { _id: "u1" } }) },
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef((p: any, r: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = p;
      return <div ref={r} {...rest} />;
    }),
    tr: React.forwardRef((p: any, r: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = p;
      return <tr ref={r} {...rest} />;
    }),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import Leaderboard from "../screens/Leaderboard";
import { gamificationAPI, friendsAPI, profileAPI } from "../services/api";

const mockLeaderboard = [
  {
    userId: "u1",
    nickname: "Test",
    level: 5,
    totalXp: 500,
    stats: { tasksCompleted: 8, coursesUploaded: 2 },
  },
  {
    userId: "u2",
    nickname: "Alice",
    level: 4,
    totalXp: 400,
    stats: { tasksCompleted: 6, coursesUploaded: 1 },
  },
  {
    userId: "u3",
    nickname: "Bob",
    level: 3,
    totalXp: 300,
    stats: { tasksCompleted: 4, coursesUploaded: 1 },
  },
];

const renderLeaderboard = () =>
  render(
    <MemoryRouter>
      <Leaderboard />
    </MemoryRouter>,
  );

describe("Leaderboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gamificationAPI.getLeaderboard.mockResolvedValue(mockLeaderboard);
    gamificationAPI.getProfile.mockResolvedValue({
      level: 5,
      total_xp: 500,
      stats: { tasksCompleted: 8, coursesUploaded: 2 },
    });
    gamificationAPI.getRankLeaderboard.mockResolvedValue({ leaderboard: [] });
    gamificationAPI.getRankProfile.mockResolvedValue({ profile: null });
    gamificationAPI.getCurrentSeason.mockResolvedValue({ season: null });
    gamificationAPI.getRankProgress.mockResolvedValue({
      progress: { kpToNextRank: 100 },
    });
    friendsAPI.getAll.mockResolvedValue({
      friends: [{ friendId: "u2" }],
    });
    profileAPI.getOnlineStatusBatch.mockResolvedValue({
      data: { statuses: [] },
    });
  });

  it("fetches leaderboard on mount", async () => {
    renderLeaderboard();
    await waitFor(() => {
      expect(gamificationAPI.getLeaderboard).toHaveBeenCalled();
    });
  });

  it("renders leaderboard entries", async () => {
    renderLeaderboard();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(await screen.findByText("Bob")).toBeInTheDocument();
  });

  it("highlights current user", async () => {
    renderLeaderboard();
    await waitFor(() => {
      expect(screen.getByText("You")).toBeInTheDocument();
    });
  });

  it("fetches friends for friends-only filter", async () => {
    renderLeaderboard();
    await waitFor(() => {
      expect(friendsAPI.getAll).toHaveBeenCalled();
    });
  });
});
