/* eslint-disable import/first */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../components/landing/HeroSection", () => ({
  __esModule: true,
  default: () => <div data-testid="hero-section">HeroSection</div>,
}));

vi.mock("../components/landing/FeaturesSection", () => ({
  __esModule: true,
  default: () => <div data-testid="features-section">FeaturesSection</div>,
}));

vi.mock("../components/landing/HowItWorks", () => ({
  __esModule: true,
  default: () => <div data-testid="how-it-works">HowItWorks</div>,
}));

vi.mock("../components/landing/AgentsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="agents-section">AgentsSection</div>,
}));

vi.mock("../components/landing/CTASection", () => ({
  __esModule: true,
  default: () => <div data-testid="cta-section">CTASection</div>,
}));

import Landing from "../screens/Landing";

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );

describe("Landing Page", () => {
  it("renders all 5 landing sections", () => {
    renderLanding();
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("features-section")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works")).toBeInTheDocument();
    expect(screen.getByTestId("agents-section")).toBeInTheDocument();
    expect(screen.getByTestId("cta-section")).toBeInTheDocument();
  });

  it("has correct container structure", () => {
    renderLanding();
    expect(screen.getAllByTestId("hero-section")).toHaveLength(1);
  });
});
