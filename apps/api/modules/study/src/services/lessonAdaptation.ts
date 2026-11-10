/** Per-lesson adaptation for the reader (Batch 4, Milestone 4.4).
 *
 * Joins the trusted published revision to the learner's own preferences and
 * evidence, then asks the deterministic policy what to suggest.
 *
 * The only non-obvious join is objective → lesson. Objectives are stored on a
 * revision's *subtopics*, and a canonical lesson's id **is** that subtopic's id
 * (see `build_canonical_document`). That is a real identity, not a heuristic:
 * `lessonObjectiveIdsForRevision` reads it from the revision the learner is
 * already authorized for.
 */

import type { LessonBlockV2 } from '../../../../shared/ednova/learningDocumentV2';
import type { LearningMode } from '../../../../shared/ednova/learningModes';
import type { LearningAdaptationV1 } from '../../../../shared/ednova/learningAdaptation';
import {
  AdaptationConflictError,
  dismissRecommendation,
  readPreferences,
  recommendForLesson,
  resetPreferences,
  savePreferences
} from './learnerAdaptation';
import { loadPublishedReading } from './courseReader';
import { getPublishedPresentation } from './presentationReader';

type RevisionTopic = {
  id?: string;
  subtopics?: Array<{
    id?: string;
    learning_objectives?: Array<{ id?: string; objectiveId?: string }>;
  }>;
};

/**
 * Objective ids a lesson teaches, from the published revision.
 *
 * Returns an empty list when the linkage is absent rather than guessing: a
 * recommendation must never claim a lesson covers an objective it does not.
 */
export function lessonObjectiveIdsForRevision(
  topics: readonly RevisionTopic[],
  lessonId: string
): string[] {
  for (const topic of topics) {
    for (const subtopic of topic.subtopics ?? []) {
      if (subtopic.id !== lessonId) continue;
      return (subtopic.learning_objectives ?? [])
        .map((objective) => objective.objectiveId ?? objective.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .slice(0, 32);
    }
  }
  return [];
}

/** Source-backed material the lesson actually contains. Used only to decide
 * whether a mode could differ from Read — never to imply quality. */
export function lessonSupportSignals(blocks: readonly LessonBlockV2[]): {
  hasProofMaterial: boolean;
  hasWorkedExamples: boolean;
} {
  const calloutRole = (block: LessonBlockV2): string | undefined =>
    block.type === 'callout' ? block.kind : undefined;
  return {
    hasProofMaterial: blocks.some(
      (block) => calloutRole(block) === 'proof' || (block.type === 'math' && Boolean(block.review))
    ),
    hasWorkedExamples: blocks.some((block) =>
      ['example', 'solution'].includes(calloutRole(block) ?? '')
    )
  };
}

export type AdaptationEnvelope = {
  /** Null when the learner disabled recommendations or adaptation is off. */
  adaptation: LearningAdaptationV1 | null;
  surface: boolean;
  preferenceVersion: number;
};

/**
 * Build the adaptation for one lesson, or a neutral envelope.
 *
 * Authorization and revision pinning happen inside `getPublishedPresentation`,
 * the same boundary every learner surface uses. This adds no new permission.
 */
export async function adaptationForLesson(
  userId: string,
  courseId: string,
  lessonId: string,
  mode: LearningMode,
  revisionId?: string
): Promise<AdaptationEnvelope> {
  const presentation = await getPublishedPresentation(userId, courseId, revisionId);
  const lesson = presentation.chapters
    .flatMap((chapter) => chapter.lessons)
    .find((entry) => entry.id === lessonId);
  if (!lesson) return { adaptation: null, surface: false, preferenceVersion: 0 };

  // The raw revision carries the subtopic → objective link the flattened
  // presentation deliberately drops.
  const { revision } = await loadPublishedReading(userId, courseId, presentation.revisionId);
  const objectiveIds = lessonObjectiveIdsForRevision(
    (revision.topics || []) as RevisionTopic[],
    lessonId
  );
  const signals = lessonSupportSignals(lesson.blocks.map((entry) => entry.block));

  const result = await recommendForLesson({
    userId,
    courseId: presentation.courseId,
    revisionId: presentation.revisionId,
    lessonId,
    contentHash: presentation.contentHash,
    currentMode: mode,
    lessonObjectiveIds: objectiveIds,
    hasProofMaterial: signals.hasProofMaterial,
    hasWorkedExamples: signals.hasWorkedExamples
  });

  return {
    adaptation: result.adaptation,
    surface: result.surface,
    preferenceVersion: result.preferenceVersion
  };
}

export {
  AdaptationConflictError,
  dismissRecommendation,
  readPreferences,
  resetPreferences,
  savePreferences
};
