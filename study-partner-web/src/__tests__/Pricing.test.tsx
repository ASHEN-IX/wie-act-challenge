/* eslint-disable import/first */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../services/api", () => ({
  authAPI: {
    getStripeConfig: vi
      .fn()
      .mockResolvedValue({ data: { stripeConfigured: true } }),
    subscribe: vi.fn(),
    validateCoupon: vi.fn(),
  },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = {
        user: { _id: "u1", tier: "normal" },
        getTier: () => "normal",
      };
      return sel ? sel(s) : s;
    },
    { getState: () => ({ user: { _id: "u1", tier: "normal" } }) },
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
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import Pricing from "../screens/Pricing";

const renderPricing = () =>
  render(
    <MemoryRouter>
      <Pricing />
    </MemoryRouter>,
  );

describe("Pricing Page", () => {
  it.skip("renders all 3 tier cards", () => {
    renderPricing();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("VIP+")).toBeInTheDocument();
  });

  it.skip("shows correct prices", () => {
    renderPricing();
    expect(screen.getByText("$0")).toBeInTheDocument();
  });

  it.skip("renders feature comparison lists", () => {
    renderPricing();
    expect(screen.getByText(/Manual course creation/i)).toBeInTheDocument();
    expect(screen.getByText(/AI course ingestion/i)).toBeInTheDocument();
    expect(screen.getByText(/AI coach/i)).toBeInTheDocument();
  });

  it.skip("renders CTA buttons", () => {
    renderPricing();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
