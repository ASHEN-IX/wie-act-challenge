/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("../services/api", () => ({
  studyPlanAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    schedule: vi.fn(),
    scheduleTasks: vi.fn(),
    getCalendar: vi.fn(),
  },
  tasksAPI: { getAll: vi.fn() },
  availabilityAPI: { get: vi.fn(), getCalendarEntries: vi.fn() },
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

vi.mock("../components/WeeklyCalendar", () => ({
  __esModule: true,
  default: () => <div data-testid="weekly-calendar">WeeklyCalendar</div>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef((p: any, r: any) => (
      <div
        ref={r}
        {...Object.fromEntries(
          Object.entries(p).filter(
            ([k]) =>
              ![
                "initial",
                "animate",
                "exit",
                "whileHover",
                "whileTap",
                "variants",
                "transition",
              ].includes(k),
          ),
        )}
      />
    )),
    button: React.forwardRef((p: any, r: any) => (
      <button
        ref={r}
        {...Object.fromEntries(
          Object.entries(p).filter(
            ([k]) =>
              ![
                "initial",
                "animate",
                "exit",
                "whileHover",
                "whileTap",
                "variants",
                "transition",
              ].includes(k),
          ),
        )}
      />
    )),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import StudyPlanner from "../screens/StudyPlanner";
import { studyPlanAPI, tasksAPI, availabilityAPI } from "../services/api";

const renderPlanner = () =>
  render(
    <MemoryRouter>
      <StudyPlanner />
    </MemoryRouter>,
  );

describe("StudyPlanner Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    availabilityAPI.get.mockResolvedValue({
      data: { availability: { slots: [] } },
    });
    availabilityAPI.getCalendarEntries.mockResolvedValue({
      data: { entries: [] },
    });
    tasksAPI.getAll.mockResolvedValue({ data: { tasks: [] } });
    studyPlanAPI.getAll.mockResolvedValue({ data: { plans: [] } });
    studyPlanAPI.getCalendar.mockResolvedValue({ data: { entries: [] } });
  });

  it("fetches availability and tasks on mount", async () => {
    renderPlanner();
    await waitFor(() => {
      expect(availabilityAPI.get).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(tasksAPI.getAll).toHaveBeenCalled();
    });
  });

  it("renders the page heading", async () => {
    renderPlanner();
    await waitFor(() => {
      expect(screen.getByText(/STUDY SCHEDULE/i)).toBeInTheDocument();
    });
  });

  it("renders weekly calendar component", async () => {
    renderPlanner();
    await waitFor(() => {
      expect(screen.getByTestId("weekly-calendar")).toBeInTheDocument();
    });
  });

  it("shows tasks when available", async () => {
    tasksAPI.getAll.mockResolvedValue({
      data: {
        tasks: [
          { _id: "t1", title: "Math HW", status: "todo", priority: "high" },
        ],
      },
    });
    renderPlanner();
    await waitFor(() => {
      expect(
        screen.getByText(/Schedule your 1 pending task/i),
      ).toBeInTheDocument();
    });
  });
});
