/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../services/api", () => ({
  subjectAPI: { list: vi.fn() },
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

vi.mock("../components/CreateSubjectModal", () => ({
  __esModule: true,
  default: ({ isOpen }) =>
    isOpen ? <div data-testid="create-subject-modal">Modal</div> : null,
}));

// Mock CSS import
vi.mock("../screens/Subjects.css", () => ({}));

import Subjects from "../screens/Subjects";
import { subjectAPI } from "../services/api";

const renderSubjects = () =>
  render(
    <MemoryRouter>
      <Subjects />
    </MemoryRouter>,
  );

describe("Subjects Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subjectAPI.list.mockResolvedValue({
      data: {
        subjects: [
          {
            id: "s1",
            _id: "s1",
            name: "Mathematics",
            description: "Numbers",
            image: null,
          },
          {
            id: "s2",
            _id: "s2",
            name: "Physics",
            description: "Forces",
            image: null,
          },
        ],
      },
    });
  });

  it("fetches subjects on mount", async () => {
    renderSubjects();
    await waitFor(() => {
      expect(subjectAPI.list).toHaveBeenCalled();
    });
  });

  it("renders subject names after loading", async () => {
    renderSubjects();
    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(await screen.findByText("Physics")).toBeInTheDocument();
  });

  it("filters subjects by search term", async () => {
    renderSubjects();
    await waitFor(() => {
      expect(screen.getByText("Mathematics")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, "Math");
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
    expect(screen.queryByText("Physics")).not.toBeInTheDocument();
  });

  it("navigates to subject detail on click", async () => {
    renderSubjects();
    await waitFor(() => {
      expect(screen.getByText("Mathematics")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Mathematics"));
    expect(mockNavigate).toHaveBeenCalledWith("/subjects/s1");
  });

  it("handles empty subjects list", async () => {
    subjectAPI.list.mockResolvedValue({ data: { subjects: [] } });
    renderSubjects();
    await waitFor(() => {
      expect(subjectAPI.list).toHaveBeenCalled();
    });
  });
});
