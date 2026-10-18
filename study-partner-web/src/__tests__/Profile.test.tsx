/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/api", () => ({
  profileAPI: { get: vi.fn(), update: vi.fn() },
  gamificationAPI: { getProfile: vi.fn() },
  friendsAPI: { getCount: vi.fn() },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = { user: { _id: "u1", name: "Test", email: "t@t.com" } };
      return sel ? sel(s) : s;
    },
    { getState: () => ({ user: { _id: "u1", name: "Test" } }) },
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
    button: React.forwardRef((p: any, r: any) => {
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
      return <button ref={r} {...rest} />;
    }),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import Profile from "../screens/Profile";
import { profileAPI, gamificationAPI, friendsAPI } from "../services/api";

const renderProfile = () =>
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );

describe("Profile Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileAPI.get.mockResolvedValue({
      data: {
        profile: {
          nickname: "TestNick",
          bio: "I love studying",
          avatar: null,
          friendCode: "abc12345",
          level: 5,
          xp: 450,
          streak: 3,
          totalStudyTime: 120,
        },
      },
    });
    gamificationAPI.getProfile.mockResolvedValue({
      data: { level: 5, xp: 450, streak: 3, achievements: [] },
    });
    friendsAPI.getCount.mockResolvedValue({ data: { count: 7 } });
  });

  it("fetches profile data on mount", async () => {
    renderProfile();
    await waitFor(() => {
      expect(profileAPI.get).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(gamificationAPI.getProfile).toHaveBeenCalled();
    });
  });

  it("renders profile info after loading", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/TestNick|Test/)).toBeInTheDocument();
    });
  });

  it("fetches friend count", async () => {
    renderProfile();
    await waitFor(() => {
      expect(friendsAPI.getCount).toHaveBeenCalled();
    });
  });

  it("shows friend code", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/abc12345/i)).toBeInTheDocument();
    });
  });
});
