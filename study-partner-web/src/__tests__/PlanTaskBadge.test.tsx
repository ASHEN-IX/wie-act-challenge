/* eslint-disable import/first */
import React from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { capitalizeBloomLevel } from "../components/CompetencyMap/PlanTaskBadge";
import PlanTaskBadge from "../components/CompetencyMap/PlanTaskBadge";

describe("PlanTaskBadge", () => {
  it("renders a humanized label for a lowercase taxonomy key", () => {
    render(<PlanTaskBadge level="analyze" />);
    const badge = screen.getByTestId("plan-task-level-badge");
    expect(badge).toHaveTextContent("Target: Analyze");
  });

  it("renders nothing when no level is present (degraded plan)", () => {
    render(<PlanTaskBadge />);
    expect(
      screen.queryByTestId("plan-task-level-badge"),
    ).not.toBeInTheDocument();
  });

  it("titles the badge with the objective id when provided", () => {
    render(<PlanTaskBadge level="apply" objectiveId="obj-123" />);
    expect(screen.getByTestId("plan-task-level-badge")).toHaveAttribute(
      "title",
      "Targets objective: obj-123",
    );
  });

  it("has no axe accessibility violations", async () => {
    const { container } = render(
      <PlanTaskBadge level="create" objectiveId="o1" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("maps all six Bloom levels to canonical labels", () => {
    expect(capitalizeBloomLevel("remember")).toBe("Remember");
    expect(capitalizeBloomLevel("understand")).toBe("Understand");
    expect(capitalizeBloomLevel("apply")).toBe("Apply");
    expect(capitalizeBloomLevel("analyze")).toBe("Analyze");
    expect(capitalizeBloomLevel("evaluate")).toBe("Evaluate");
    expect(capitalizeBloomLevel("create")).toBe("Create");
  });
});
