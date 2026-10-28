/** Requester-only source scaffolding. Never returns server rubrics or answer keys. */
import mongoose, { Schema, type Model } from 'mongoose';
import { resolveStoredActivity, ActivityBoundaryError } from './activityResolution';
import { verifyRevisionArtifact } from './revisionSources';
import { canReadCourse } from './resourceAccess';
import { PublicationForbiddenError } from './coursePublication';
import { assessConfusion } from './confusionSignals';
import { StudentAttempt } from '../models/StudentAttempt';
import { learningStyleCue } from './learningStyle';
interface SupportState {
  userId: string;
  courseId: string;
  revisionId: string;
  activityId: string;
  activityRevision: string;
  hintLevel: number;
}
const schema = new Schema<SupportState>(
  {
    userId: { type: String, required: true },
    courseId: { type: String, required: true },
    revisionId: { type: String, required: true },
    activityId: { type: String, required: true },
    activityRevision: { type: String, required: true },
    hintLevel: { type: Number, default: 0 }
  },
  { timestamps: true }
);
schema.index(
  { userId: 1, courseId: 1, revisionId: 1, activityId: 1, activityRevision: 1 },
  { unique: true }
);
const Support: Model<SupportState> =
  mongoose.models.LearningSupport || mongoose.model<SupportState>('LearningSupport', schema);
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
  await Support.collection.createIndex(
    { userId: 1, courseId: 1, revisionId: 1, activityId: 1, activityRevision: 1 },
    { unique: true }
  );
  try {
    await Support.updateOne(key, { $setOnInsert: { ...key, hintLevel: 0 } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  let state = await Support.findOne(key).lean();
  if (input.mode === 'explain' && (!state || Number(state.hintLevel) < 1))
    throw new ActivityBoundaryError(
      409,
      'HINT_FIRST',
      'Request a hint before the full source explanation'
    );
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  if (input.mode === 'hint') {
    await Support.updateOne({ ...key, hintLevel: { $lt: 2 } }, { $inc: { hintLevel: 1 } });
    state = await Support.findOne(key).lean();
  }
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  const hintLevel = Number(state?.hintLevel || 1);
  const wrongAttempts = await StudentAttempt.countDocuments({
    userId: actor,
    courseId,
    activityId: definition.activityId,
    'assessmentResult.isCorrect': false
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
    text: (
      input.mode === 'explain'
        ? 'Source explanation: compare each part of your answer with this reviewed passage. This is source scaffolding, not a new verified correction.\n' +
          passage.text
        : hintLevel === 1
          ? 'Identify the term or reasoning step asked for. Compare its meaning with the reviewed source before choosing or writing your response.'
          : 'Possible confusion: a related term or step may not fit the source statement. Re-read this source context and compare the alternatives: ' +
            passage.text.slice(0, 240)) +
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
