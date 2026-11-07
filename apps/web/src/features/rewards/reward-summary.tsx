import type { LearningRewards } from "./types";
import { ActionForm } from "@/components/shared/action-form";
import { retryLearningReward } from "./actions";

/** Quiet server projection: no client award calculation or replayed toast. */
export function RewardSummary({ rewards }: { rewards: LearningRewards }) {
  return (
    <section
      aria-labelledby="learning-rewards-heading"
      className="mb-10 space-y-5 border-b pb-8"
      data-testid="learning-rewards"
    >
      <h2 id="learning-rewards-heading" className="text-xl font-semibold">
        Learning rewards
      </h2>
      <p>
        Motivation only: XP, levels and badges are not academic mastery or
        grades.
      </p>
      <dl className="flex flex-wrap gap-8">
        <div>
          <dt>Total XP</dt>
          <dd className="text-3xl font-semibold">{rewards.totalXp}</dd>
        </div>
        <div>
          <dt>Motivation level</dt>
          <dd className="flex items-center gap-2 text-3xl font-semibold">
            {rewards.level}
          </dd>
        </div>
        <div>
          <dt>Verified learning XP</dt>
          <dd>{rewards.learningXp}</dd>
        </div>
      </dl>
      <p>
        Next level: {rewards.levelProgress} of {rewards.nextLevelXp} XP.
      </p>
      <progress
        aria-label="Motivation level progress"
        value={rewards.levelProgress}
        max={rewards.nextLevelXp}
        className="w-full"
      />
      {rewards.legacyXp > 0 && (
        <p>
          {rewards.legacyXp} XP comes from retained legacy activity rules and is
          separate from verified learning rewards.
        </p>
      )}
      {rewards.pending > 0 && (
        <div role="status">
          <p>
            {rewards.pending} reward update
            {rewards.pending === 1 ? " is" : "s are"} pending. Your accepted
            learning evidence is retained.
          </p>
          {rewards.pendingAwards.map((award) => (
            <ActionForm
              key={award.awardId}
              action={retryLearningReward}
              submit="Retry reward update"
              className="mt-3 space-y-2"
            >
              <input type="hidden" name="evidenceId" value={award.evidenceId} />
            </ActionForm>
          ))}
        </div>
      )}
      <p>
        {rewards.policy.xpPerCompletion} XP per distinct reviewed check, capped
        at {rewards.policy.maxDailyTopicXp} XP per course topic per UTC day.{" "}
        {rewards.policy.repeatRule}
      </p>
      <h3 className="font-semibold">Earned learning badges</h3>
      {rewards.achievements.length ? (
        <ul className="flex flex-wrap gap-4">
          {rewards.achievements.map((badge) => (
            <li key={badge.id} className="rounded border p-3">
              <strong>{badge.name}</strong>
              <p>{badge.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No learning badges yet. Complete your own reviewed activity check.
        </p>
      )}
      <h3 className="font-semibold">Recent award reasons</h3>
      {rewards.awards.length ? (
        <ol className="space-y-3">
          {rewards.awards.map((award) => (
            <li
              key={award.awardId}
              data-award-id={award.awardId}
              className="rounded border p-3"
            >
              <span className="font-semibold">+{award.xp} XP</span>
              {" · "}
              {award.reason}
              <p className="text-sm text-muted-foreground">
                <time dateTime={award.timestamp}>
                  {new Date(award.timestamp).toISOString().slice(0, 10)}
                </time>
                {" · "}
                {award.policyVersion}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          No verified learning awards yet. Views, chat and idle time do not earn
          learning XP.
        </p>
      )}
    </section>
  );
}
