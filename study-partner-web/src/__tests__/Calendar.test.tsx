/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("../services/api", () => ({
  availabilityAPI: { get: vi.fn(), getCalendarEntries: vi.fn() },
  studyPlanAPI: { getAll: vi.fn(), getCalendar: vi.fn() },
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

import Calendar from "../screens/Calendar";
import { availabilityAPI, studyPlanAPI } from "../services/api";

const renderCalendar = () =>
  render(
    <MemoryRouter>
      <Calendar />
    </MemoryRouter>,
  );

describe("Calendar Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // availabilityAPI.get() should return an array directly
    availabilityAPI.get.mockResolvedValue([]);
    studyPlanAPI.getCalendar.mockResolvedValue({
      data: { entries: [] },
    });
  });

  it("fetches availability on mount", async () => {
    renderCalendar();
    await waitFor(() => {
      expect(availabilityAPI.get).toHaveBeenCalled();
    });
  });

  it("fetches calendar entries on mount", async () => {
    renderCalendar();
    await waitFor(() => {
      expect(studyPlanAPI.getCalendar).toHaveBeenCalled();
    });
  });

  it("renders the calendar heading", async () => {
    renderCalendar();
    await waitFor(() => {
      expect(screen.getByText(/Weekly Schedule/i)).toBeInTheDocument();
    });
  });

  it("shows scheduled events when available", async () => {
    studyPlanAPI.getCalendar.mockResolvedValue({
      data: {
        entries: [
          {
            _id: "e1",
            title: "Study Math",
            startTime: "2024-01-15T10:00:00Z",
            endTime: "2024-01-15T11:00:00Z",
          },
        ],
      },
    });
    renderCalendar();
    await waitFor(() => {
      expect(studyPlanAPI.getCalendar).toHaveBeenCalled();
    });
  });
});
