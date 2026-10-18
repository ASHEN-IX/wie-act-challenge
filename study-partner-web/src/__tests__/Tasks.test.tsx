/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/api", () => ({
  tasksAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

import Tasks from "../screens/Tasks";
import { tasksAPI } from "../services/api";

const renderTasks = () =>
  render(
    <MemoryRouter>
      <Tasks />
    </MemoryRouter>,
  );

const mockTasks = [
  {
    _id: "t1",
    title: "Read Chapter 1",
    status: "todo",
    priority: "high",
    estimatedTime: 30,
  },
  {
    _id: "t2",
    title: "Practice Problems",
    status: "in-progress",
    priority: "medium",
    estimatedTime: 45,
  },
  {
    _id: "t3",
    title: "Review Notes",
    status: "completed",
    priority: "low",
    estimatedTime: 15,
  },
];

describe("Tasks Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tasksAPI.getAll.mockResolvedValue({ data: { tasks: mockTasks } });
    tasksAPI.create.mockResolvedValue({
      data: { task: { _id: "t4", title: "New Task" } },
    });
    tasksAPI.delete.mockResolvedValue({ data: {} });
  });

  it("fetches tasks on mount", async () => {
    renderTasks();
    await waitFor(() => {
      expect(tasksAPI.getAll).toHaveBeenCalled();
    });
  });

  it("renders task titles after loading", async () => {
    renderTasks();
    expect(await screen.findByText("Read Chapter 1")).toBeInTheDocument();
    expect(await screen.findByText("Practice Problems")).toBeInTheDocument();
  });

  it("filters by status when filter is changed", async () => {
    renderTasks();
    await waitFor(() => {
      expect(screen.getByText("Read Chapter 1")).toBeInTheDocument();
    });
    // Get the TODO filter button (first button that says TODO in the filter bar)
    const buttons = screen.getAllByText(/todo/i);
    // Use the button element, not the status badge
    const todoBtn = buttons.find((el) => el.tagName === "BUTTON");
    if (todoBtn) {
      await userEvent.click(todoBtn);
      await waitFor(() => {
        expect(tasksAPI.getAll).toHaveBeenCalledWith({ status: "todo" });
      });
    }
  });

  it("handles empty tasks", async () => {
    tasksAPI.getAll.mockResolvedValue({ data: { tasks: [] } });
    renderTasks();
    await waitFor(() => {
      expect(tasksAPI.getAll).toHaveBeenCalled();
    });
  });
});
