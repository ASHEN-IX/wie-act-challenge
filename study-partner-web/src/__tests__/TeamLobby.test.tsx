/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
const mockNavigate = vi.fn();
const mockFetchFriends = vi.fn();
const mockFetchParticipants = vi.fn();
const mockInviteToSession = vi.fn();
const mockStartTeamSession = vi.fn();
const mockResetSession = vi.fn();
const mockClearSessionStartSignal = vi.fn();
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
  teamSessionsAPI: {
    start: vi.fn(),
  },
}));
vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: () => ({
    user: {
      _id: "u1",
      userId: "u1",
      name: "Test User",
    },
  }),
}));
vi.mock("../store/sessionStore", () => ({
  __esModule: true,
  default: () => ({
    teamSession: {
      _id: "team-1",
      userId: "u1",
    },
    inviteCode: "ABCD12",
    selectedCourse: {
      title: "Biology",
    },
    startTeamSession: mockStartTeamSession,
    resetSession: mockResetSession,
  }),
}));
vi.mock("../store/friendsStore", () => ({
  __esModule: true,
  default: () => ({
    friends: [],
    fetchFriends: mockFetchFriends,
    fetchParticipants: mockFetchParticipants,
    inviteToSession: mockInviteToSession,
    teamParticipants: [],
  }),
}));
vi.mock("../store/notificationStore", () => ({
  __esModule: true,
  default: () => ({
    sessionStartSignal: null,
    clearSessionStartSignal: mockClearSessionStartSignal,
  }),
}));
vi.mock("../components/VoiceChat/VoiceButton", () => ({
  __esModule: true,
  default: () => <div data-testid="voice-button" />,
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = props;
      return <div ref={ref} {...rest} />;
    }),
    button: React.forwardRef((props: any, ref: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = props;
      return <button ref={ref} {...rest} />;
    }),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
import TeamLobby from "../screens/TeamLobby";
import { profileAPI } from "../services/api";
const renderTeamLobby = () =>
  render(
    <MemoryRouter>
      <TeamLobby />
    </MemoryRouter>,
  );
describe("TeamLobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileAPI.get.mockResolvedValue({
      data: {
        profile: {
          nickname: "Team Lead",
        },
      },
    });
  });
  test("loads the profile and lets the host start a team session", async () => {
    mockStartTeamSession.mockResolvedValue({});
    renderTeamLobby();
    await waitFor(() => expect(profileAPI.get).toHaveBeenCalled());
    expect(screen.queryByText(/Lobby Character/i)).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /start/i }));
    await waitFor(() => expect(mockStartTeamSession).toHaveBeenCalled());
  });
});
