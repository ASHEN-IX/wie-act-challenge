/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null }),
  };
});

vi.mock("../services/api", () => ({
  sessionsAPI: { getAll: vi.fn(), create: vi.fn(), end: vi.fn() },
  tasksAPI: { getAll: vi.fn() },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = { user: { _id: "u1" } };
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
        layout,
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

import Sessions from "../screens/Sessions";
import { sessionsAPI, tasksAPI } from "../services/api";

const renderSessions = () =>
  render(
    <MemoryRouter>
      <Sessions />
    </MemoryRouter>,
  );

const mockSessions = [
  {
    _id: "s1",
    mode: "deep_focus",
    duration: 3600,
    createdAt: new Date().toISOString(),
    status: "completed",
  },
  {
    _id: "s2",
    mode: "pomodoro",
    duration: 1500,
    createdAt: new Date().toISOString(),
    status: "completed",
  },
];

describe("Sessions Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionsAPI.getAll.mockResolvedValue({ data: { sessions: mockSessions } });
    tasksAPI.getAll.mockResolvedValue({ data: { tasks: [] } });
  });

  it("fetches sessions on mount", async () => {
    renderSessions();
    await waitFor(() => {
      expect(sessionsAPI.getAll).toHaveBeenCalled();
    });
  });

  it("renders session heading", async () => {
    renderSessions();
    await waitFor(() => {
      expect(screen.getByText(/SESSION|Sessions/i)).toBeInTheDocument();
    });
  });

  it("handles empty sessions list", async () => {
    sessionsAPI.getAll.mockResolvedValue({ data: { sessions: [] } });
    renderSessions();
    await waitFor(() => {
      expect(sessionsAPI.getAll).toHaveBeenCalled();
    });
  });
});
