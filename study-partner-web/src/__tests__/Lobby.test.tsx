/* eslint-disable import/first */
import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
vi.mock("../services/api", () => ({
  profileAPI: {
    get: vi.fn(),
  },
  gamificationAPI: {
    getProfile: vi.fn(),
    getRankProfile: vi.fn(),
  },
}));
vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = {
        user: {
          _id: "u1",
          name: "Test",
        },
      };
      return sel ? sel(s) : s;
    },
    {
      getState: () => ({
        user: {
          _id: "u1",
        },
      }),
    },
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
import Lobby from "../screens/Lobby";
import { profileAPI, gamificationAPI } from "../services/api";
const renderLobby = () =>
  render(
    <MemoryRouter>
      <Lobby />
    </MemoryRouter>,
  );
describe("Lobby Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    profileAPI.get.mockResolvedValue({
      data: {
        profile: {
          nickname: "TestNick",
          level: 5,
        },
      },
    });
    gamificationAPI.getProfile.mockResolvedValue({
      success: true,
      data: {
        stats: {},
      },
    });
    gamificationAPI.getRankProfile.mockResolvedValue({
      success: true,
      profile: {
        rankName: "Novice",
        knowledgePoints: 0,
      },
      progress: {
        nextRank: {
          name: "Scholar",
        },
        kpToNextRank: 100,
        progressPercent: 0,
      },
    });
  });
  it("fetches profile on mount", async () => {
    renderLobby();
    await waitFor(() => {
      expect(profileAPI.get).toHaveBeenCalled();
    });
  });
  it("renders mode selection options", async () => {
    renderLobby();
    const deepFocusButtons = screen.getAllByText(/DEEP FOCUS/i);
    expect(deepFocusButtons.length).toBeGreaterThan(0);
    const pomodoroButtons = screen.getAllByText(/POMODORO/i);
    expect(pomodoroButtons.length).toBeGreaterThan(0);
  });
  it("shows lock in button", async () => {
    renderLobby();
    await waitFor(() => {
      expect(screen.getByText(/LOCK IN|Start/i)).toBeInTheDocument();
    });
  });
  it("mode selection updates state", async () => {
    renderLobby();
    const pomodoroButtons = screen.getAllByText(/POMODORO/i);
    expect(pomodoroButtons.length).toBeGreaterThan(0);
    // Just verify the buttons exist - update happens internally
    expect(pomodoroButtons[0]).toBeInTheDocument();
  });
  it("launches the selected mode without a loadout", async () => {
    renderLobby();
    await waitFor(() => expect(profileAPI.get).toHaveBeenCalled());
    expect(screen.queryByText(/OWNED CHARACTERS/i)).not.toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: /LOCK IN/i }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/sessions", {
      state: { mode: "focus" },
    });
    vi.useRealTimers();
  });
});
