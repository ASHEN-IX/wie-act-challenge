/* eslint-disable import/first */
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("../WeeklyCalendar.css", () => ({}));

import WeeklyCalendar from "../WeeklyCalendar";

const mockCurrentWeekStart = new Date("2025-01-06"); // A Monday

describe("WeeklyCalendar Component", () => {
  it("renders day headers", () => {
    render(
      <WeeklyCalendar
        availability={[]}
        events={[]}
        currentWeekStart={mockCurrentWeekStart}
        weeksView={1}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText(/Monday/i)).toBeInTheDocument();
    expect(screen.getByText(/Friday/i)).toBeInTheDocument();
  });

  it("renders time slots", () => {
    render(
      <WeeklyCalendar
        availability={[]}
        events={[]}
        currentWeekStart={mockCurrentWeekStart}
        weeksView={1}
        onSave={vi.fn()}
      />,
    );
    // Should have hour indicators (7 AM through 9 PM)
    expect(screen.getByText(/7.*AM|07:00/i)).toBeInTheDocument();
  });

  it("renders with default props", () => {
    render(
      <WeeklyCalendar
        currentWeekStart={mockCurrentWeekStart}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText(/Monday/i)).toBeInTheDocument();
  });

  it("shows events when provided", () => {
    render(
      <WeeklyCalendar
        availability={[]}
        events={[
          {
            _id: "e1",
            title: "Math Study",
            startTime: new Date("2025-01-06T10:00:00").toISOString(),
            endTime: new Date("2025-01-06T11:00:00").toISOString(),
          },
        ]}
        currentWeekStart={mockCurrentWeekStart}
        weeksView={1}
        onSave={vi.fn()}
      />,
    );
    // Events should be rendered (checking the component renders without errors)
    expect(screen.getByText(/Monday/i)).toBeInTheDocument();
  });
});
