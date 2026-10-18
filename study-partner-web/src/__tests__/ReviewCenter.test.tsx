/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../services/api", () => ({
  reviewAPI: {
    getPending: vi.fn(),
    getStats: vi.fn(),
    recordResult: vi.fn(),
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

import ReviewCenter from "../screens/ReviewCenter";
import { reviewAPI } from "../services/api";

const mockReviews = [
  {
    _id: "r1",
    front: "What is 2+2?",
    back: "4",
    ease: 2.5,
    interval: 1,
    nextReview: new Date().toISOString(),
  },
  {
    _id: "r2",
    front: "Capital of France?",
    back: "Paris",
    ease: 2.5,
    interval: 1,
    nextReview: new Date().toISOString(),
  },
];

const renderReview = () =>
  render(
    <MemoryRouter>
      <ReviewCenter />
    </MemoryRouter>,
  );

describe("ReviewCenter Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewAPI.getPending.mockResolvedValue({ reviews: mockReviews });
    reviewAPI.getStats.mockResolvedValue({
      totalReviews: 100,
      pending: 2,
      avgEase: 2.5,
    });
    reviewAPI.recordResult.mockResolvedValue({});
  });

  it("fetches pending reviews on mount", async () => {
    renderReview();
    await waitFor(() => {
      expect(reviewAPI.getPending).toHaveBeenCalled();
    });
  });

  it("fetches review stats on mount", async () => {
    renderReview();
    await waitFor(() => {
      expect(reviewAPI.getStats).toHaveBeenCalled();
    });
  });

  it("renders review heading", async () => {
    renderReview();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
  });

  it("handles empty reviews list", async () => {
    reviewAPI.getPending.mockResolvedValue({ data: { reviews: [] } });
    renderReview();
    await waitFor(() => {
      expect(reviewAPI.getPending).toHaveBeenCalled();
    });
  });
});
