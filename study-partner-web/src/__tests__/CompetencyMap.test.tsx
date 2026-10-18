/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { axe } from "jest-axe";

// Recharts ResponsiveContainer needs explicit dimensions under jsdom.
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children, width, height }) => (
      <div
        data-testid="recharts-container"
        style={{ width, height: height || 280 }}
      >
        {children}
      </div>
    ),
  };
});

vi.mock("../services/api", () => ({
  competencyAPI: {
    getCompetencyMap: vi.fn(),
    getTopicDetail: vi.fn(),
  },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: () => ({ user: { _id: "u1" } }),
}));

import CompetencyMap from "../screens/CompetencyMap";
import { competencyAPI } from "../services/api";

const SAMPLE_SUBJECTS = {
  competencies: [
    {
      subjectId: "sub1",
      subjectName: "Mathematics",
      topics: [
        {
          topicId: "t1",
          topicName: "Linear Algebra",
          parentTopic: "Algebra",
          levels: [
            { bloomLevel: "remember", score: 0.9 },
            { bloomLevel: "understand", score: 0.8 },
            { bloomLevel: "apply", score: 0.7 },
            { bloomLevel: "analyze", score: 0.6 },
            { bloomLevel: "evaluate", score: 0.4 },
            { bloomLevel: "create", score: 0.2 },
          ],
        },
      ],
    },
  ],
};

const SAMPLE_TOPIC = {
  topic: {
    topicId: "t1",
    topicName: "Linear Algebra",
    parentTopic: "Algebra",
    subjectId: "sub1",
    courseId: "c1",
    competencies: [
      {
        topicId: "t1",
        knowledgeType: "conceptual",
        bloomLevel: "analyze",
        score: 0.6,
        confidence: 0.8,
        needsReview: false,
        evidence: [
          {
            demonstratedBloomLevel: "apply",
            masteryScore: 0.7,
            objectiveId: "obj-123",
          },
        ],
      },
    ],
  },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompetencyMap />
    </MemoryRouter>,
  );

describe("Competency Map Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    competencyAPI.getCompetencyMap.mockResolvedValue(SAMPLE_SUBJECTS);
    competencyAPI.getTopicDetail.mockResolvedValue(SAMPLE_TOPIC);
  });

  it("shows the subject radar and a per-topic score list on load", async () => {
    renderPage();
    expect(await screen.findByText("Competency Map")).toBeInTheDocument();

    await waitFor(() =>
      expect(competencyAPI.getCompetencyMap).toHaveBeenCalledTimes(1),
    );

    expect(
      screen.getByRole("tab", { name: "Mathematics" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Linear Algebra")).toBeInTheDocument();
    // summary metrics for the six levels appear
    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("drills down into a topic detail panel from the topic list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Linear Algebra");

    await user.click(screen.getByText("Linear Algebra"));
    await waitFor(() =>
      expect(competencyAPI.getTopicDetail).toHaveBeenCalledWith("t1"),
    );

    const panel = await screen.findByTestId("topic-detail-panel");
    expect(within(panel).getByText("Linear Algebra")).toBeInTheDocument();
    // detail row shows the knowledge type and a score
    expect(within(panel).getByText("conceptual")).toBeInTheDocument();
    expect(within(panel).getByText("60%")).toBeInTheDocument();
  });

  it("closes the detail panel", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Linear Algebra");
    await user.click(screen.getByText("Linear Algebra"));
    await screen.findByTestId("topic-detail-panel");
    await user.click(screen.getByLabelText("Close topic details"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("topic-detail-panel"),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders an empty state when there is no competency data", async () => {
    competencyAPI.getCompetencyMap.mockResolvedValue({ competencies: [] });
    renderPage();
    expect(
      await screen.findByText("No competency data yet"),
    ).toBeInTheDocument();
  });

  it("renders an error state with a retry action when the request fails", async () => {
    competencyAPI.getCompetencyMap.mockRejectedValue(new Error("network down"));
    renderPage();
    expect(
      await screen.findByText(
        "Failed to load your competency map. Please try again.",
      ),
    ).toBeInTheDocument();
  });

  it("has no axe accessibility violations on the loaded map", async () => {
    const { container } = renderPage();
    await screen.findByText("Competency Map");
    await waitFor(() =>
      expect(competencyAPI.getCompetencyMap).toHaveBeenCalledTimes(1),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
