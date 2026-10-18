/* eslint-disable import/first */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Test different tier scenarios
const mockTierState = { tier: "trial", daysRemaining: 10, isExpired: false };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("@/store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = {
        getTier: () => mockTierState.tier,
        getTrialDaysRemaining: () => mockTierState.daysRemaining,
        isTrialExpired: () => mockTierState.isExpired,
      };
      return sel ? sel(s) : s;
    },
    { getState: () => ({}) },
  ),
}));

import TrialBanner from "../TrialBanner";

const renderBanner = () =>
  render(
    <MemoryRouter>
      <TrialBanner />
    </MemoryRouter>,
  );

describe("TrialBanner Component", () => {
  afterEach(() => {
    // Reset to defaults
    mockTierState.tier = "trial";
    mockTierState.daysRemaining = 10;
    mockTierState.isExpired = false;
  });

  it("renders for trial users", () => {
    renderBanner();
    expect(screen.getByText(/10 days left/i)).toBeInTheDocument();
  });

  it("shows upgrade button", () => {
    renderBanner();
    expect(screen.getByText("Upgrade")).toBeInTheDocument();
  });

  it("shows urgent styling for 3 days or less", () => {
    mockTierState.daysRemaining = 2;
    renderBanner();
    expect(screen.getByText(/2 days left/i)).toBeInTheDocument();
  });

  it("shows expired message when trial expired", () => {
    mockTierState.isExpired = true;
    mockTierState.daysRemaining = 0;
    renderBanner();
    expect(screen.getByText(/trial has expired/i)).toBeInTheDocument();
  });

  it("renders nothing for non-trial users", () => {
    mockTierState.tier = "vip";
    renderBanner();
    expect(
      screen.queryByText(/day.*left in your free trial/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/trial has expired/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Upgrade")).not.toBeInTheDocument();
  });

  it("renders nothing for normal tier", () => {
    mockTierState.tier = "normal";
    renderBanner();
    expect(
      screen.queryByText(/day.*left in your free trial/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/trial has expired/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Upgrade")).not.toBeInTheDocument();
  });
});
