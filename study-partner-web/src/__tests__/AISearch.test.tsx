/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/api", () => ({
  aiAPI: {
    search: vi.fn(),
    searchJob: vi.fn(),
    searchHistory: vi.fn(),
  },
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
    form: React.forwardRef((p: any, r: any) => {
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
      return <form ref={r} {...rest} />;
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

import AISearch from "../screens/AISearch";
import { aiAPI } from "../services/api";

const renderSearch = () =>
  render(
    <MemoryRouter>
      <AISearch />
    </MemoryRouter>,
  );

describe("AISearch Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiAPI.searchHistory.mockResolvedValue({ data: { history: [] } });
    aiAPI.search.mockResolvedValue({
      data: { jobId: "job-search-1", status: "PENDING" },
    });
    aiAPI.searchJob.mockResolvedValue({
      data: {
        jobId: "job-search-1",
        status: "COMPLETED",
        result: { answer: "The answer is 42.", sources: [] },
      },
    });
  });

  it("loads search history on mount", async () => {
    renderSearch();
    await waitFor(() => {
      expect(aiAPI.searchHistory).toHaveBeenCalled();
    });
  });

  it("renders search input", () => {
    renderSearch();
    const input = screen.getByPlaceholderText(/search|ask|query/i);
    expect(input).toBeInTheDocument();
  });

  it("submits search query", async () => {
    renderSearch();
    const input = screen.getByPlaceholderText(/search|ask|query/i);
    await userEvent.type(input, "What is quantum physics?");
    // Find the submit button (it's a type="submit" button in the form)
    const submitBtn = screen.getByRole("button", { type: "submit" });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(aiAPI.search).toHaveBeenCalled();
    });
  });

  it("shows validation error for empty query", async () => {
    renderSearch();
    const submitBtn = screen.getByRole("button", { type: "submit" });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("Please enter a search query.")).toBeInTheDocument();
    });
    expect(aiAPI.search).not.toHaveBeenCalled();
  });

  it("displays the answer after the job completes", async () => {
    renderSearch();
    const input = screen.getByPlaceholderText(/search|ask|query/i);
    await userEvent.type(input, "What is recursion?");
    const submitBtn = screen.getByRole("button", { type: "submit" });
    await userEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText("The answer is 42.")).toBeInTheDocument();
    });
  });

  it("renders search heading", () => {
    renderSearch();
    const heading = screen.getByRole("heading", { name: /AI Search/i });
    expect(heading).toBeInTheDocument();
  });
});
