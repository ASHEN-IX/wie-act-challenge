/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", () => ({
  questAPI: { getAll: vi.fn() },
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
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import QuestPanel from "../QuestPanel";
import { questAPI } from "../../services/api";

describe("QuestPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton initially", () => {
    questAPI.getAll.mockReturnValue(new Promise(() => {}));
    render(<QuestPanel />);
    expect(screen.queryByText("Quests")).not.toBeInTheDocument();
  });

  it("renders quest heading after loading", async () => {
    questAPI.getAll.mockResolvedValue({
      daily: [
        {
          _id: "q1",
          title: "Study 30 min",
          status: "active",
          progress: 15,
          target: 30,
        },
      ],
      weekly: [],
      recentCompleted: [],
    });
    render(<QuestPanel />);
    await waitFor(() => {
      expect(screen.getByText("Quests")).toBeInTheDocument();
    });
  });

  it("shows active quest count", async () => {
    questAPI.getAll.mockResolvedValue({
      daily: [
        {
          _id: "q1",
          title: "Study 30 min",
          status: "active",
          progress: 15,
          target: 30,
        },
        {
          _id: "q2",
          title: "Complete 3 tasks",
          status: "active",
          progress: 1,
          target: 3,
        },
      ],
      weekly: [],
      recentCompleted: [],
    });
    render(<QuestPanel />);
    await waitFor(() => {
      expect(screen.getByText("2 active")).toBeInTheDocument();
    });
  });

  it("toggles expand/collapse", async () => {
    questAPI.getAll.mockResolvedValue({
      daily: [
        {
          _id: "q1",
          title: "Study 30 min",
          status: "active",
          progress: 15,
          target: 30,
        },
      ],
      weekly: [],
      recentCompleted: [],
    });
    render(<QuestPanel />);
    await waitFor(() => {
      expect(screen.getByText("Quests")).toBeInTheDocument();
    });
    // Click header to collapse
    await userEvent.click(screen.getByText("Quests"));
  });

  it("handles empty quests", async () => {
    questAPI.getAll.mockResolvedValue({
      daily: [],
      weekly: [],
      recentCompleted: [],
    });
    render(<QuestPanel />);
    await waitFor(() => {
      expect(screen.getByText("Quests")).toBeInTheDocument();
    });
  });
});
