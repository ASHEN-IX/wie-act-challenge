import crypto from 'node:crypto';
import { verifyRevisionArtifact } from './revisionSources';
import {
  parseContract,
  validateSubmission,
  type ActivityDefinition,
  type Contract
} from '../../../../shared/ednova/contracts';
import { ActivityRecord, LearningEvidence, StudentAttempt, StudyRoom } from '../models';
import { broadcastRoomState } from '../routes/rooms';
import { PublicationForbiddenError } from './coursePublication';
import { canAuthorCourse, canReadCourse } from './resourceAccess';
import {
  ActivityBoundaryError,
  resolveActivityRevision,
  validateActivityRevision,
  resolveStoredActivity,
  validateActivityRoom
} from './activityResolution';
import { evaluateActivity } from './activityEvaluation';
import { recordAcceptedEvidence } from './competency';
import { awardAcceptedLearningEvidence } from '../../../user-profile/src/services/learningRewards';

export class AttemptConflictError extends Error {
  readonly status = 409;
  readonly code = 'STALE_ATTEMPT';
  constructor(message = 'Attempt already submitted with conflicting answers') {
    super(message);
    this.name = 'AttemptConflictError';
  }
}

export class AttemptNotFoundError extends Error {
  readonly status = 404;
  readonly code = 'ATTEMPT_NOT_FOUND';
  constructor(message = 'Activity attempt not found') {
    super(message);
    this.name = 'AttemptNotFoundError';
  }
}

export class ActivityNotFoundError extends Error {
  readonly status = 404;
  readonly code = 'ACTIVITY_NOT_FOUND';
  constructor(message = 'Activity definition not found') {
    super(message);
    this.name = 'ActivityNotFoundError';
  }
}

export class StaleRevisionSubmissionError extends Error {
  readonly status = 409;
  readonly code = 'STALE_REVISION';
  constructor(message = 'Activity belongs to a stale or superseded course revision') {
    super(message);
    this.name = 'StaleRevisionSubmissionError';
  }
}

export class ActivityValidationError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_SUBMISSION';
  constructor(message = 'Submission validation failed') {
    super(message);
    this.name = 'ActivityValidationError';
  }
}

function deterministicStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(deterministicStringify).join(',')}]`;
  }
  const keys = Object.keys(val as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${deterministicStringify((val as Record<string, unknown>)[k])}`
  );
  return `{${pairs.join(',')}}`;
}

function canonicalHash(obj: unknown): string {
  const jsonStr = deterministicStringify(obj);
  return `sha256:${crypto.createHash('sha256').update(jsonStr).digest('hex')}`;
}

function duplicate(error: unknown) {
  return (error as { code?: number }).code === 11000;
}

const indexReadiness = new WeakMap<object, Promise<unknown>>();
async function ensureActivityIndexes() {
  const db = StudentAttempt.db.db;
  if (!db)
    throw new ActivityBoundaryError(
      503,
      'PERSISTENCE_UNAVAILABLE',
      'Activity persistence unavailable'
    );
  let ready = indexReadiness.get(db);
  if (!ready) {
    // Additive, idempotent index creation only. Never drop/rewrite an existing
    // deployment index or tolerate duplicates when the required unique key fails.
    ready = Promise.all([
      StudentAttempt.collection.createIndex({ userId: 1, attemptId: 1 }, { unique: true }),
      LearningEvidence.collection.createIndex({ userId: 1, attemptId: 1 }, { unique: true }),
      LearningEvidence.collection.createIndex({ evidenceId: 1 }, { unique: true }),
      ActivityRecord.collection.createIndex(
        { courseId: 1, revisionId: 1, activityId: 1 },
        { unique: true }
      )
    ]).catch(() => {
      indexReadiness.delete(db);
      throw new ActivityBoundaryError(
        503,
        'PERSISTENCE_UNAVAILABLE',
        'Required activity uniqueness unavailable'
      );
    });
    indexReadiness.set(db, ready);
  }
  await ready;
}

function parseActivity(input: unknown) {
  try {
    return parseContract('ActivityDefinition', input);
  } catch {
    throw new ActivityValidationError('Invalid activity definition');
  }
}

/** Insert-only author-reviewed definitions; no course alias, regrading or overwrite. */
export async function registerActivity(
  actor: string,
  courseId: string,
  input: unknown,
  evaluationInput: unknown,
  expectedActivityId?: string
) {
  await ensureActivityIndexes();
  if (!(await canAuthorCourse(actor, courseId))) throw new PublicationForbiddenError();
  const definition = parseActivity(input);
  let evaluation: Contract<'ServerEvaluationDefinition'>;
  try {
    evaluation = parseContract('ServerEvaluationDefinition', evaluationInput);
  } catch {
    throw new ActivityValidationError('Invalid server evaluation definition');
  }
  if (
    definition.courseId !== courseId ||
    (expectedActivityId && definition.activityId !== expectedActivityId) ||
    canonicalHash(evaluation.activity) !== canonicalHash(activityPin(definition))
  ) {
    throw new ActivityValidationError('Course, path or evaluation pin mismatch');
  }
  const revision = await resolveActivityRevision(actor, courseId, definition.revisionId, true);
  validateActivityRevision(definition, revision);
  const artifact = await verifyRevisionArtifact(revision);
  if (
    definition.sourceRefs.some(
      (ref) =>
        !artifact.passages.some(
          (p) =>
            p.documentId === ref.documentId &&
            p.contentHash === ref.contentHash &&
            p.pageNumber === ref.pageNumber
        )
    )
  )
    throw new ActivityValidationError('Source page not present in verified extraction');
  const key = { courseId, revisionId: definition.revisionId, activityId: definition.activityId };
  const existing = await ActivityRecord.findOne(key).lean();
  if (existing) {
    if (
      canonicalHash(existing.publicDefinition) !== canonicalHash(definition) ||
      canonicalHash(existing.serverEvaluation) !== canonicalHash(evaluation)
    ) {
      throw new AttemptConflictError(
        'Activity definition is immutable; create a new reviewed revision'
      );
    }
    return definition;
  }
  if (revision.status !== 'draft')
    throw new AttemptConflictError('Activities must be registered in a draft revision');
  try {
    await ActivityRecord.create({
      ...key,
      contentHash: definition.contentHash,
      activityRevision: definition.activityRevision,
      activityType: definition.activityType,
      objectiveId: definition.objectiveId,
      publicDefinition: definition,
      serverEvaluation: evaluation
    });
  } catch (error) {
    if (!duplicate(error)) throw error;
    const winner = await ActivityRecord.findOne(key).lean();
    if (
      !winner ||
      canonicalHash(winner.publicDefinition) !== canonicalHash(definition) ||
      canonicalHash(winner.serverEvaluation) !== canonicalHash(evaluation)
    ) {
      throw new AttemptConflictError('Conflicting concurrent activity registration');
    }
  }
  // Publication/revocation during insertion cannot authorize delivery or execution.
  if (!(await canAuthorCourse(actor, courseId))) throw new PublicationForbiddenError();
  return definition;
}

function activityPin(a: ActivityDefinition) {
  return {
    courseId: a.courseId,
    revisionId: a.revisionId,
    contentHash: a.contentHash,
    activityId: a.activityId,
    activityRevision: a.activityRevision,
    activityType: a.activityType
  };
}

/**
 * Resolve the competency unit that owns an objective. Objectives live under
 * subtopics[].learning_objectives in the revision hierarchy, which is the shape
 * ingestion and the draft editor both produce; the subtopic is the grain the
 * progress projection reports at.
 */
function objectiveTopicId(revision: { topics?: unknown }, objectiveId: string): string | null {
  const topics = (revision.topics as Array<Record<string, unknown>>) || [];
  for (const topic of topics) {
    const direct = (topic.objectives as Array<Record<string, unknown>> | undefined) || [];
    if (direct.some((o) => (o.id || o.objectiveId) === objectiveId))
      return typeof topic.id === 'string' ? topic.id : null;
    const subtopics = (topic.subtopics as Array<Record<string, unknown>> | undefined) || [];
    for (const sub of subtopics) {
      const objectives = (sub.learning_objectives as Array<Record<string, unknown>>) || [];
      if (objectives.some((o) => (o.id || o.objectiveId) === objectiveId))
        return typeof sub.id === 'string' ? sub.id : null;
    }
  }
  return null;
}

export async function getPublicActivity(
  actor: string,
  activityId: string,
  courseId?: string,
  revisionId?: string
) {
  const { definition } = await resolveStoredActivity(actor, activityId, courseId, revisionId);
  return definition;
}

/** Standalone-Mongo receipt-first protocol; no cross-document atomicity claim.
 * All workers compute the same prepared result from an immutable definition and
 * the winning durable receipt timestamp. Conditional preparation selects one
 * result; evidence uses stable actor/attempt identity and insert-only upsert.
 * Any crash can be resumed with the original payload, including after evidence
 * insertion but before receipt completion. Nothing relies on a process lock.
 */
export async function submitAttempt(actor: string, input: unknown, expectedActivityId?: string) {
  await ensureActivityIndexes();
  let submission: Contract<'AttemptSubmission'>;
  try {
    submission = parseContract('AttemptSubmission', input);
  } catch {
    throw new ActivityValidationError('Invalid attempt submission');
  }
  if (expectedActivityId && submission.activity.activityId !== expectedActivityId)
    throw new ActivityValidationError('Path activity mismatch');
  await resolveActivityRevision(
    actor,
    submission.activity.courseId,
    submission.activity.revisionId
  );
  const { definition, record, revision } = await resolveStoredActivity(
    actor,
    submission.activity.activityId,
    submission.activity.courseId,
    submission.activity.revisionId
  );
  try {
    validateSubmission(submission, definition);
  } catch {
    throw new ActivityValidationError('Activity pin, option or step mismatch');
  }
  if (
    definition.activityType === 'GuidedProblem' &&
    'steps' in submission.answers &&
    submission.answers.steps.length !== definition.presentationData.steps.length
  ) {
    throw new ActivityValidationError('All required steps must be submitted');
  }
  await validateActivityRoom(actor, submission.roomId, definition);
  const key = { userId: actor, attemptId: submission.attemptId };
  const payloadHash = canonicalHash(submission);
  let receipt;
  try {
    receipt = await StudentAttempt.findOneAndUpdate(
      key,
      {
        $setOnInsert: {
          ...key,
          ...activityPin(definition),
          roomId: submission.roomId,
          answers: submission.answers,
          timeSpentSeconds: submission.timeSpentSeconds,
          payloadHash,
          submission,
          status: 'submitted',
          protocolVersion: 1,
          processingState: 'claimed',
          submittedAt: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );
  } catch (error) {
    if (!duplicate(error)) throw error;
    receipt = await StudentAttempt.findOne(key);
  }
  if (!receipt || receipt.payloadHash !== payloadHash) throw new AttemptConflictError();
  if (receipt.protocolVersion !== 1)
    throw new ActivityBoundaryError(
      503,
      'LEGACY_RECEIPT_UNVERIFIED',
      'Legacy receipt retained but not recertified'
    );

  if (receipt.processingState === 'claimed') {
    const evaluation = parseContract('ServerEvaluationDefinition', record.serverEvaluation);
    if (canonicalHash(evaluation.activity) !== canonicalHash(activityPin(definition)))
      throw new ActivityValidationError('Stored evaluation pin mismatch');
    const outcome = evaluateActivity(definition, evaluation, submission);
    const objective = validateActivityRevision(definition, revision);
    const timestamp = receipt.submittedAt.toISOString();
    const evidenceId = 'evi_' + canonicalHash({ ...key, payloadHash }).slice(7, 39);
    let evidence: Record<string, unknown> | null = null;
    let result: Contract<'AssessmentResult'>;
    if (outcome.status === 'unavailable') {
      result = parseContract('AssessmentResult', {
        schemaVersion: '1.0.0',
        visibility: 'recipient_only',
        ...key,
        activity: activityPin(definition),
        ...outcome
      });
    } else {
      // Invalid/unreviewed objective taxonomy cannot be promoted into evidence.
      const bloom = objective.bloomLevel;
      if (
        !['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].includes(
          String(bloom)
        )
      ) {
        throw new ActivityBoundaryError(
          503,
          'EVALUATION_UNAVAILABLE',
          'Reviewed objective taxonomy unavailable'
        );
      }
      if (outcome.isCorrect)
        evidence = parseContract('AcceptedEvidence', {
          schemaVersion: '1.0.0',
          evidenceVersion: '1.0.0',
          visibility: 'server_only',
          ...key,
          evidenceId,
          activity: activityPin(definition),
          objectiveId: definition.objectiveId,
          status: 'accepted',
          bloomLevel: bloom,
          score: outcome.score,
          masteryAchieved: true,
          evaluator: {
            type: 'deterministic_rubric',
            model: null,
            validationVersion: evaluation.rubricVersion,
            executionMode: process.env.NODE_ENV === 'test' ? 'MOCK_TEST' : 'DETERMINISTIC_FALLBACK'
          },
          timestamp
        });
      result = parseContract('AssessmentResult', {
        schemaVersion: '1.0.0',
        visibility: 'recipient_only',
        ...key,
        activity: activityPin(definition),
        ...outcome,
        socraticHint: outcome.isCorrect
          ? null
          : 'Which reviewed definition or problem step would help you check this answer?',
        recommendedNextStep: null,
        bloomLevelDemonstrated: bloom,
        evidenceId: evidence ? evidenceId : null,
        evaluatedAt: timestamp
      });
    }
    await StudentAttempt.updateOne(
      { ...key, processingState: 'claimed', payloadHash },
      {
        $set: {
          processingState: 'prepared',
          assessmentResult: result,
          preparedEvidence: evidence,
          evidenceId: evidence ? evidenceId : null
        }
      }
    );
    receipt = await StudentAttempt.findOne(key);
  }
  if (!receipt?.assessmentResult)
    throw new ActivityBoundaryError(
      503,
      'PENDING',
      'Attempt preparation incomplete; retry same payload'
    );
  // Current grant/context checked before accepting evidence AND before delivery.
  const revisionContext = await resolveActivityRevision(
    actor,
    definition.courseId,
    definition.revisionId
  );
  if (receipt.processingState === 'prepared') {
    if (receipt.preparedEvidence) {
      const evidence = parseContract('AcceptedEvidence', receipt.preparedEvidence);
      try {
        await LearningEvidence.updateOne(
          key,
          {
            $setOnInsert: {
              ...evidence,
              timestamp: new Date(evidence.timestamp),
              rewardReference: {
                rewardCandidateId: 'rc_' + evidence.evidenceId.slice(4),
                policyVersion: 'v1',
                eventKey: 'xp:' + actor + ':' + evidence.evidenceId,
                finalAwardId: null
              }
            }
          },
          { upsert: true, runValidators: true }
        );
      } catch (error) {
        if (!duplicate(error)) throw error;
      }
      const stored = await LearningEvidence.findOne(key).lean();
      if (!stored || stored.evidenceId !== evidence.evidenceId)
        throw new AttemptConflictError('Existing evidence conflicts with receipt');
      if (evidence.masteryAchieved) {
        // Accepted reviewed evidence is also competency evidence. The revision is
        // already loaded and authorized here, so resolve the objective's topic
        // without a second grant check, and never let a profile write fail the
        // submission that legitimately earned it.
        const objective = validateActivityRevision(definition, revisionContext);
        const topicId = objectiveTopicId(revisionContext, definition.objectiveId);
        if (topicId) {
          try {
            await recordAcceptedEvidence({
              userId: actor,
              objectiveId: definition.objectiveId,
              bloomLevel: objective.bloomLevel,
              score: evidence.score,
              masteryAchieved: evidence.masteryAchieved,
              evaluatedAt: new Date(evidence.timestamp),
              correlationId: evidence.evidenceId,
              topicId
            });
          } catch {
            /* Competency projection is derived state; accepted evidence stands. */
          }
        }
      }
    }
    await StudentAttempt.updateOne(
      { ...key, processingState: 'prepared', payloadHash },
      {
        $set: {
          processingState: 'completed',
          status: receipt.assessmentResult.status === 'graded' ? 'graded' : 'submitted'
        }
      }
    );
  }
  if (submission.roomId) {
    await validateActivityRoom(actor, submission.roomId, definition);
    const updated = await StudyRoom.findOneAndUpdate(
      {
        roomId: submission.roomId,
        status: 'active',
        activeActivityId: definition.activityId,
        participants: {
          $elemMatch: { userId: actor, leftAt: { $exists: false }, hasSubmitted: { $ne: true } }
        }
      },
      { $set: { 'participants.$.hasSubmitted': true }, $inc: { seq: 1 } },
      { new: true }
    );
    if (updated) await broadcastRoomState(updated);
  }
  if (receipt.evidenceId) {
    try {
      await awardAcceptedLearningEvidence(actor, receipt.evidenceId);
    } catch {
      /* Valid evidence survives reward outages; the private ledger exposes retry. */
    }
  }
  if (!(await canReadCourse(actor, definition.courseId)))
    throw new PublicationForbiddenError('Access revoked before result delivery');
  return parseContract('AssessmentResult', receipt.assessmentResult);
}

/** Until owners approve historical-source policy, retain data but withhold all
 * protected feedback on lost grants. Never delete or retroactively regrade it. */
export async function getAttemptResult(
  actor: string,
  attemptId: string,
  expectedActivityId?: string
) {
  const receipt = await StudentAttempt.findOne({
    userId: actor,
    attemptId,
    ...(expectedActivityId ? { activityId: expectedActivityId } : {})
  }).lean();
  if (!receipt) throw new AttemptNotFoundError();
  if (!(await canReadCourse(actor, receipt.courseId))) throw new PublicationForbiddenError();
  if (receipt.protocolVersion !== 1)
    throw new ActivityBoundaryError(
      503,
      'LEGACY_RECEIPT_UNVERIFIED',
      'Legacy receipt retained but not recertified'
    );
  await resolveStoredActivity(actor, receipt.activityId, receipt.courseId, receipt.revisionId);
  if (receipt.processingState !== 'completed' || !receipt.assessmentResult) {
    return parseContract('AssessmentResult', {
      schemaVersion: '1.0.0',
      visibility: 'recipient_only',
      userId: actor,
      attemptId,
      activity: {
        courseId: receipt.courseId,
        revisionId: receipt.revisionId,
        contentHash: receipt.contentHash,
        activityId: receipt.activityId,
        activityRevision: receipt.activityRevision,
        activityType: receipt.activityType
      },
      status: 'pending',
      code: 'PENDING',
      retryable: true
    });
  }
  return parseContract('AssessmentResult', receipt.assessmentResult);
}
