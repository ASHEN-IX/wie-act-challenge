import type { DraftTopic } from "./types";
import type { DraftReviewProposal, DraftReviewResult } from "./studio-actions";

/**
 * Review, fix and publish a freshly extracted draft without manual steps.
 *
 * It reuses the existing server steps (save, review, approve, prepare, publish), so every
 * server-side check still applies. What it never does: confirm low-confidence source regions
 * for the instructor, change lesson text, or publish past a blocker. In those cases it stops
 * and says exactly what is left.
 */

/** Findings the AI proposal is allowed to fix. Everything else is left alone. */
const FIXABLE = new Set(["TITLE_CUT_OFF", "NO_OBJECTIVE", "GENERIC_OBJECTIVE"]);

/** Apply the proposal only to the lessons the checks flagged. Pure. */
export function applyProposalToFlagged(
  topics: DraftTopic[],
  review: Pick<DraftReviewResult, "findings">,
  proposal: DraftReviewProposal,
): { topics: DraftTopic[]; changed: number } {
  const flagged = new Set(
    review.findings
      .filter((f) => FIXABLE.has(f.code) && f.subtopicId)
      .map((f) => f.subtopicId as string),
  );
  const lessons = new Map(proposal.lessons.map((l) => [l.id, l]));
  let changed = 0;
  const next = topics.map((topic) => ({
    ...topic,
    subtopics: topic.subtopics?.map((sub) => {
      const fix = flagged.has(sub.id) ? lessons.get(sub.id) : undefined;
      if (!fix) return sub;
      changed += 1;
      return {
        ...sub,
        title: fix.title,
        learning_objectives: fix.objectives.map((o) => ({
          id: "obj_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12),
          statement: o.statement,
          text: o.statement,
          bloomLevel: o.bloomLevel,
          provenance: "ai_generated" as const,
        })),
      };
    }),
  }));
  return { topics: next, changed };
}

export type AutoPublishPhase = "checking" | "fixing" | "publishing";
export type AutoPublishResult =
  | {
      status: "published";
      revisionTag: string;
      fixed: number;
      /** Fixable problems that are still in the published draft. */
      remaining: number;
      aiStatus: DraftReviewResult["ai"]["status"];
    }
  | { status: "held"; reason: string; fixed: number };

export interface AutoPublishDeps {
  topics: DraftTopic[];
  /** Unsaved edits, or lessons that have no id yet (ids are assigned on save). */
  needsSave: boolean;
  save(topics: DraftTopic[], reviewed: boolean): Promise<void>;
  refresh(): Promise<{ revisionTag: string; topics: DraftTopic[] }>;
  review(useAi: boolean): Promise<DraftReviewResult>;
  approve(revisionTag: string): Promise<{ ok: boolean; error?: string }>;
  prepare(revisionTag: string): Promise<unknown>;
  publish(
    revisionTag: string,
  ): Promise<{ error?: string; revisionTag?: string }>;
  onPhase?(phase: AutoPublishPhase): void;
  /** Asked before the save that attests the review, so an opt-out or an edit made while the
   * run was in progress stops it before anything is approved or published. */
  canContinue?(): boolean;
}

const SOURCE = "SOURCE_REVIEW_PENDING";

export async function autoReviewAndPublish(
  deps: AutoPublishDeps,
): Promise<AutoPublishResult> {
  let fixed = 0;
  try {
    deps.onPhase?.("checking");
    let state = { revisionTag: "", topics: deps.topics };
    if (deps.needsSave) {
      await deps.save(deps.topics, false);
      state = await deps.refresh();
    } else {
      state = await deps.refresh();
    }

    let review = await deps.review(true);
    const aiStatus = review.ai.status;
    if (
      review.findings.some((f) => f.severity === "blocker" && f.code !== SOURCE)
    ) {
      return {
        status: "held",
        fixed,
        reason: review.findings.find((f) => f.severity === "blocker")!.message,
      };
    }

    if (review.ai.status === "proposed" && review.ai.proposal) {
      deps.onPhase?.("fixing");
      const applied = applyProposalToFlagged(
        state.topics,
        review,
        review.ai.proposal,
      );
      if (applied.changed) {
        await deps.save(applied.topics, false);
        fixed = applied.changed;
        state = await deps.refresh();
        review = await deps.review(false);
      }
    }

    if (review.findings.some((f) => f.code === SOURCE)) {
      return {
        status: "held",
        fixed,
        reason:
          "Some source regions are low confidence. Compare them with the original and confirm the source review; automation will not confirm it for you.",
      };
    }
    const blocker = review.findings.find((f) => f.severity === "blocker");
    if (blocker) return { status: "held", fixed, reason: blocker.message };

    if (deps.canContinue && !deps.canContinue())
      return {
        status: "held",
        fixed,
        reason: "Automatic publishing was stopped before anything was approved.",
      };
    deps.onPhase?.("publishing");
    await deps.save(state.topics, true);
    state = await deps.refresh();
    const approved = await deps.approve(state.revisionTag);
    if (!approved.ok)
      return {
        status: "held",
        fixed,
        reason: approved.error || "Approval was refused.",
      };
    await deps.prepare(state.revisionTag);
    const published = await deps.publish(state.revisionTag);
    if (published.error)
      return { status: "held", fixed, reason: published.error };
    return {
      status: "published",
      fixed,
      revisionTag: published.revisionTag || state.revisionTag,
      remaining: review.findings.filter((f) => FIXABLE.has(f.code)).length,
      aiStatus,
    };
  } catch (error) {
    return {
      status: "held",
      fixed,
      reason:
        error instanceof Error
          ? error.message
          : "Automatic review stopped unexpectedly.",
    };
  }
}
