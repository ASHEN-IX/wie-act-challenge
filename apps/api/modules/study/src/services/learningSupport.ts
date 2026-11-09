/** Requester-only source scaffolding. Never returns server rubrics or answer keys. */
import { resolveStoredActivity, ActivityBoundaryError } from './activityResolution';
import { verifyRevisionArtifact } from './revisionSources';
import { canReadCourse } from './resourceAccess';
import { PublicationForbiddenError } from './coursePublication';
import { assessConfusion } from './confusionSignals';
import { prisma } from '../../../../shared/database';
import { table } from '../models/_table';
import { learningStyleCue } from './learningStyle';
export interface SupportState {
  id: string;
  _id: string;
  userId: string;
  courseId: string;
  revisionId: string;
  activityId: string;
  activityRevision: string;
  hintLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

const Support = table<SupportState>({
  delegate: () => prisma.learningSupport,
  defaults: () => ({ hintLevel: 0 }),
  columns: (row) => ({
    userId: row.userId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    activityId: row.activityId,
    activityRevision: row.activityRevision,
    hintLevel: row.hintLevel
  })
});

/** Trim at a word boundary so a hint never ends mid-word. */
function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).trimEnd() + '…';
}
export async function sourceLearningSupport(
  actor: string,
  courseId: string,
  input: Record<string, unknown>
) {
  if (
    Object.keys(input).some((key) => !['revisionId', 'activityId', 'mode'].includes(key)) ||
    typeof input.revisionId !== 'string' ||
    typeof input.activityId !== 'string' ||
    !['hint', 'explain'].includes(String(input.mode))
  )
    throw new ActivityBoundaryError(
      400,
      'INVALID_INPUT',
      'Exact activity, revision and support mode required'
    );
  const { definition, revision } = await resolveStoredActivity(
    actor,
    input.activityId,
    courseId,
    input.revisionId
  );
  const artifact = await verifyRevisionArtifact(revision);
  const passage = artifact.passages.find((p) =>
    definition.sourceRefs.some(
      (ref) =>
        ref.documentId === p.documentId &&
        ref.contentHash === p.contentHash &&
        ref.pageNumber === p.pageNumber
    )
  );
  if (!passage)
    throw new ActivityBoundaryError(
      503,
      'SOURCE_UNAVAILABLE',
      'Reviewed source passage unavailable'
    );
  const key = {
    userId: actor,
    courseId,
    revisionId: definition.revisionId,
    activityId: definition.activityId,
    activityRevision: definition.activityRevision
  };
  // The unique (userId, courseId, revisionId, activityId, activityRevision)
  // index makes this upsert idempotent; a concurrent insert converges on it.
  await Support.findOneAndUpdate(key, { $setOnInsert: { ...key, hintLevel: 0 } }, { upsert: true });
  let state = await Support.findOne(key);
  if (input.mode === 'explain' && (!state || Number(state.hintLevel) < 1))
    throw new ActivityBoundaryError(
      409,
      'HINT_FIRST',
      'Request a hint before the full source explanation'
    );
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  if (input.mode === 'hint') {
    await Support.updateOne({ ...key, hintLevel: { $lt: 2 } }, { $inc: { hintLevel: 1 } });
    state = await Support.findOne(key);
  }
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  const hintLevel = Number(state?.hintLevel || 1);
  // `assessmentResult` is JSON: filter the nested flag through a JSON path.
  const wrongAttempts = await prisma.studentAttempt.count({
    where: {
      userId: actor,
      courseId,
      activityId: definition.activityId,
      assessmentResult: { path: ['isCorrect'], equals: false }
    }
  });
  // Private, provisional phrasing cue from the learner's own probe (hints only).
  const styleCue = input.mode === 'hint' ? await learningStyleCue(actor) : null;
  return {
    visibility: 'recipient_only',
    userId: actor,
    mode: input.mode,
    hintLevel,
    // Reasons only: no grades, rubrics or evidence. Tentative by design.
    confusion: assessConfusion({ wrongAttempts, hintLevel }),
    executionMode: 'DETERMINISTIC_FALLBACK',
    text:
      (input.mode === 'explain'
        ? 'Source explanation: compare each part of your answer with this reviewed passage. This is source scaffolding, not a new verified correction.\n' +
          passage.text
        : hintLevel === 1
          ? 'Identify the term or reasoning step asked for. Compare its meaning with the reviewed source before choosing or writing your response.'
          : 'Possible confusion: a related term or step may not fit the source statement. Re-read this source context and compare the alternatives: ' +
            excerpt(passage.text, 240)) +
      (styleCue ? `\n\nStyle cue (provisional, private): ${styleCue}` : ''),
    citation: {
      documentId: passage.documentId,
      pageNumber: passage.pageNumber,
      chunkId: passage.chunkId,
      textHash: passage.textHash
    },
    pin: { courseId, revisionId: definition.revisionId, contentHash: definition.contentHash },
    policy:
      'Hints precede explicit explanation. No grading key, reward or mastery is produced; suggested confusion remains tentative.'
  };
}
