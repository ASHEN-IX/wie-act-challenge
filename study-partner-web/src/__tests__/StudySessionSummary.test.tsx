/* eslint-disable import/first */
import React from "react";
import { render, screen } from "@testing-library/react";
vi.mock("../services/api", () => ({
  aiAPI: {},
  notificationAPI: {},
  focusAPI: {},
  sessionsAPI: {},
  gamificationAPI: {},
  teamSessionsAPI: {},
}));
vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: () => ({
    user: {
      _id: "u-1",
    },
  }),
}));
vi.mock("../store/sessionStore", () => ({
  __esModule: true,
  default: () => ({
    step: "summary",
    activeSession: null,
    teamSession: null,
    inviteCode: null,
    taskProgress: null,
    sessionSummary: null,
    selectedCourse: null,
    completeTask: vi.fn(),
    skipTask: vi.fn(),
    finishSession: vi.fn(),
    resetSession: vi.fn(),
  }),
}));
vi.mock("../components/WebcamCapture", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../components/SessionChat/ChatWindow", () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock("../components/TeamSessionPanel", () => ({
  __esModule: true,
  default: () => null,
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
import { SessionSummary } from "../screens/StudySession";
describe("SessionSummary completion rewards rendering", () => {
  it("shows rank and KP progress from completionRewards rank payload", () => {
    const summary = {
      totalTasks: 4,
      completedTasks: 4,
      skippedTasks: 0,
      totalXP: 90,
      completionRewards: {
        awardedXP: 90,
        rank: {
          name: "Scholar III",
          totalKnowledgePoints: 1200,
          kpToNextRank: 140,
          knowledgePointsAwarded: 60,
        },
      },
    };
    render(
      <SessionSummary
        summary={summary}
        onRestart={() => {}}
        onGoHome={() => {}}
      />,
    );
    expect(screen.getByText("Current Rank")).toBeInTheDocument();
    expect(screen.getByText("Scholar III")).toBeInTheDocument();
    expect(screen.getByText("Total Knowledge Points")).toBeInTheDocument();
    expect(screen.getByText("1200")).toBeInTheDocument();
    expect(screen.getByText("KP to Next Rank")).toBeInTheDocument();
    expect(screen.getByText("140")).toBeInTheDocument();
  });
});
