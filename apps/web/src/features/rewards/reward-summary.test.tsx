import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./actions", () => ({ retryLearningReward: vi.fn() }));
vi.mock("@/components/shared/action-form", () => ({
  ActionForm: ({
    children,
    submit,
  }: {
    children: React.ReactNode;
    submit: string;
  }) => (
    <form>
      {children}
      <button>{submit}</button>
    </form>
  ),
}));
import { RewardSummary } from "./reward-summary";
import type { LearningRewards } from "./types";
const empty: LearningRewards = {
  totalXp: 0,
  level: 1,
  levelProgress: 0,
  nextLevelXp: 100,
  learningXp: 0,
  legacyXp: 0,
  pending: 0,
  pendingAwards: [],
  meaning: "Motivation only",
  policyVersion: "learning-v1",
  policy: {
    xpPerCompletion: 20,
    maxDailyTopicXp: 300,
    repeatRule: "One reward per reviewed activity",
  },
  achievements: [],
  awards: [],
};
describe("evidence-based motivational reward projection", () => {
  it("separates XP from academic mastery and gives an honest empty state", () => {
    const html = renderToStaticMarkup(<RewardSummary rewards={empty} />);
    expect(html).toContain("not academic mastery or grades");
    expect(html).toContain("No verified learning awards yet");
    expect(html).toContain("Views, chat and idle time do not earn learning XP");
    expect(html).toContain('aria-label="Motivation level progress"');
  });
  it("shows each solo/group reason and badge once with no repeated celebration on refresh", () => {
    const reward: LearningRewards = {
      ...empty,
      totalXp: 140,
      level: 2,
      levelProgress: 40,
      learningXp: 40,
      legacyXp: 100,
      achievements: [
        {
          id: "learning_group_check",
          name: "Learning together",
          description: "Your own verified group check",
          unlockedAt: "2026-10-27T12:00:00Z",
        },
      ],
      awards: [
        {
          awardId: "award_solo",
          xp: 20,
          reason: "Verified individual learning check",
          policyVersion: "learning-v1",
          timestamp: "2026-10-27T12:00:00Z",
          group: false,
        },
        {
          awardId: "award_group",
          xp: 20,
          reason: "Verified personal check in a study room",
          policyVersion: "learning-v1",
          timestamp: "2026-10-27T12:01:00Z",
          group: true,
        },
      ],
    };
    const first = renderToStaticMarkup(<RewardSummary rewards={reward} />);
    expect(first).toBe(
      renderToStaticMarkup(<RewardSummary rewards={reward} />),
    );
    expect(first.match(/Verified individual learning check/g)).toHaveLength(1);
    expect(
      first.match(/Verified personal check in a study room/g),
    ).toHaveLength(1);
    expect(first.match(/Learning together/g)).toHaveLength(1);
    expect(first).toContain("retained legacy activity rules");
    expect(first).toContain("40 of 100 XP");
    expect(first).not.toContain("alert");
  });
  it("keeps accepted learning visible when the reward projection is pending", () => {
    const html = renderToStaticMarkup(
      <RewardSummary
        rewards={{
          ...empty,
          pending: 1,
          pendingAwards: [
            { awardId: "award_pending", evidenceId: "evi_pending" },
          ],
        }}
      />,
    );
    expect(html).toContain("Your accepted learning evidence is retained");
    expect(html).toContain("Retry reward update");
    expect(html).toContain('role="status"');
  });
});
