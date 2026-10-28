import crypto from 'node:crypto';
import mongoose, { Schema } from 'mongoose';
import { StudyRoom, StudentAttempt } from '../models';
import { canReadCourse } from './resourceAccess';
import { validateRoomRevision, resolveRoomActivity, sameActivityPin } from './roomActivity';
import { ActivityBoundaryError } from './activityResolution';
import { submitAttempt, getAttemptResult } from './activityAttempt';
import { runRoomCommand } from './roomCommands';
import SessionChat from '../../../notification/src/models/SessionChat';

const proposalSchema = new Schema(
  {
    proposalId: { type: String, unique: true },
    roomId: String,
    presenterUserId: String,
    expectedSeq: Number,
    activePin: Schema.Types.Mixed,
    targetPhase: String,
    message: String,
    commandId: String,
    status: { type: String, default: 'proposed' },
    expiresAt: Date
  },
  { timestamps: true, writeConcern: { w: 'majority', j: true } }
);
const Proposal =
  mongoose.models.RoomLearningProposal || mongoose.model('RoomLearningProposal', proposalSchema);
const checkSchema = new Schema(
  {
    checkId: { type: String, unique: true },
    roomId: String,
    round: String,
    userId: String,
    attemptId: String,
    activity: Schema.Types.Mixed
  },
  { timestamps: true, writeConcern: { w: 'majority', j: true } }
);
const Check = mongoose.models.RoomLearningCheck || mongoose.model('RoomLearningCheck', checkSchema);
const fail = (status: number, message: string) => {
  throw new ActivityBoundaryError(status, 'ROOM_LEARNING', message);
};
export async function activeLearningRoom(actor: string, roomId: string) {
  const room = await StudyRoom.findOne({ roomId });
  if (!room) return fail(404, 'Room not found');
  if (room.status !== 'active' || !room.participants.some((p) => p.userId === actor && !p.leftAt))
    return fail(403, 'Active room membership required');
  if (room.courseId && !(await canReadCourse(actor, room.courseId)))
    return fail(403, 'Current course access required');
  await validateRoomRevision(actor, room);
  return room;
}
export async function ownRoomCheck(actor: string, roomId: string, checkId?: string) {
  const room = await activeLearningRoom(actor, roomId);
  if (!room.activeActivityId || !room.activityRound || !room.activePin)
    return { status: 'unavailable', message: 'Presenter must select a reviewed activity first.' };
  const identity = crypto
    .createHash('sha256')
    .update(JSON.stringify([roomId, room.activityRound, actor]))
    .digest('hex');
  const ownId = 'check_' + identity.slice(0, 32);
  if (checkId && checkId !== ownId) return fail(404, 'Private check not found');
  const resolved = await resolveRoomActivity(actor, room, room.activeActivityId);
  if (!sameActivityPin(room.activePin, resolved.pin)) return fail(409, 'Room activity changed');
  await Check.collection.createIndex({ checkId: 1 }, { unique: true });
  await Check.updateOne(
    { checkId: ownId },
    {
      $setOnInsert: {
        checkId: ownId,
        roomId,
        round: room.activityRound,
        userId: actor,
        attemptId: crypto.randomUUID(),
        activity: resolved.pin
      }
    },
    { upsert: true }
  );
  const check = await Check.findOne({ checkId: ownId, userId: actor }).lean<{
    attemptId: string;
  }>();
  if (!check) return fail(503, 'Check unavailable');
  const receipt = await StudentAttempt.findOne({
    userId: actor,
    attemptId: check.attemptId
  }).lean();
  const result = receipt
    ? await getAttemptResult(actor, check.attemptId, room.activeActivityId)
    : null;
  const current = await activeLearningRoom(actor, roomId);
  if (
    current.activityRound !== room.activityRound ||
    !sameActivityPin(current.activePin, room.activePin)
  )
    return fail(409, 'Check round changed');
  return {
    status: result ? (result.status === 'graded' ? 'completed' : result.status) : 'pending',
    checkId: ownId,
    recipientUserId: actor,
    attemptId: check.attemptId,
    activity: resolved.definition,
    result
  };
}
export async function submitOwnRoomCheck(
  actor: string,
  roomId: string,
  checkId: string,
  input: Record<string, unknown>
) {
  if (Object.keys(input).some((k) => !['answers', 'timeSpentSeconds'].includes(k)))
    return fail(400, 'Unsupported private check field');
  const check = await ownRoomCheck(actor, roomId, checkId);
  if (!check.activity) return fail(409, 'Private check unavailable');
  const room = await activeLearningRoom(actor, roomId);
  const result = await submitAttempt(
    actor,
    {
      schemaVersion: '1.0.0',
      attemptId: check.attemptId,
      roomId,
      activity: room.activePin,
      answers: input.answers,
      timeSpentSeconds: input.timeSpentSeconds
    },
    check.activity.activityId
  );
  await activeLearningRoom(actor, roomId);
  return result;
}
export async function roomLearningDebrief(actor: string, roomId: string) {
  const room = await activeLearningRoom(actor, roomId);
  const people = room.participants.filter((p) => !p.leftAt);
  const check = await ownRoomCheck(actor, roomId);
  return {
    recap: {
      roomId,
      currentPhase: room.currentPhase,
      activePin: room.activePin || null,
      participantsCount: people.length,
      publicSubmissionsCount: people.filter((p) => p.hasSubmitted).length,
      gradeAggregates: null,
      privacyPolicy: 'Private grades are suppressed; completion is not mastery.'
    },
    privateCheck: check
  };
}
export async function proposeRoomSupport(actor: string, roomId: string) {
  const room = await activeLearningRoom(actor, roomId);
  if (room.presenterUserId !== actor)
    return fail(403, 'Only presenter may request a room proposal');
  if (room.activeActivityId) {
    const a = await resolveRoomActivity(actor, room, room.activeActivityId);
    if (!sameActivityPin(room.activePin, a.pin)) return fail(409, 'Activity pin mismatch');
  }
  const journal = await SessionChat.findOne({ sessionId: roomId, messageType: 'peer_stream' })
    .select('peerMessages')
    .lean();
  const participating = new Set(
    (journal?.peerMessages || [])
      .filter((m) => room.participants.some((p) => !p.leftAt && p.userId === m.senderUserId))
      .map((m) => m.senderUserId)
  );
  const quiet = room.participants.find(
    (p) => !p.leftAt && p.userId !== actor && !participating.has(p.userId)
  );
  const proposal = await Proposal.create({
    proposalId: 'proposal_' + crypto.randomUUID().replace(/-/g, ''),
    roomId,
    presenterUserId: actor,
    expectedSeq: room.seq,
    activePin: room.activePin || null,
    targetPhase: 'peer_discussion',
    commandId: crypto.randomUUID(),
    message:
      (quiet
        ? `${quiet.name}, would you like to explain your approach? `
        : 'Invite peers to compare their approaches. ') +
      'Compare source evidence before individual checks. This deterministic suggestion does not diagnose misconceptions.',
    expiresAt: new Date(Date.now() + 120000)
  });
  await activeLearningRoom(actor, roomId);
  return {
    proposalId: proposal.proposalId,
    expectedSeq: proposal.expectedSeq,
    message: proposal.message,
    targetPhase: proposal.targetPhase,
    executionMode: 'DETERMINISTIC_FALLBACK',
    sourceBacked: !!room.activePin,
    status: 'proposed'
  };
}
export async function decideRoomSupport(
  actor: string,
  roomId: string,
  proposalId: string,
  input: Record<string, unknown>
) {
  if (
    Object.keys(input).some((k) => k !== 'decision') ||
    typeof input.decision !== 'string' ||
    !['accept', 'decline'].includes(input.decision)
  )
    return fail(400, 'Invalid proposal decision');
  const room = await activeLearningRoom(actor, roomId);
  const proposal = await Proposal.findOne({ proposalId, roomId });
  if (!proposal) return fail(404, 'Proposal not found');
  if (room.presenterUserId !== actor || proposal.presenterUserId !== actor)
    return fail(403, 'Presenter changed or not authorized');
  if (['declined', 'expired'].includes(proposal.status)) return fail(409, 'Proposal unavailable');
  if (input.decision === 'decline') {
    const declined = await Proposal.updateOne(
      { _id: proposal._id, status: 'proposed' },
      { $set: { status: 'declined' } }
    );
    if (!declined.modifiedCount) return fail(409, 'Proposal decision already in progress');
    return { status: 200, body: { status: 'declined' } };
  }
  if (
    (proposal.status !== 'accepted' && proposal.expiresAt.getTime() < Date.now()) ||
    !sameActivityPin(room.activePin || null, proposal.activePin || null)
  )
    return fail(409, 'Stale proposal');
  const claim = await Proposal.updateOne(
    { _id: proposal._id, status: 'proposed' },
    { $set: { status: 'accepting' } }
  );
  if (!claim.modifiedCount && !['accepting', 'accepted'].includes(proposal.status))
    return fail(409, 'Proposal decision changed');
  // The persisted server proposal supplies the entire command. Model/client fields cannot mutate it.
  const result = await runRoomCommand(
    'phase',
    { userId: actor },
    {
      commandId: proposal.commandId,
      expectedSeq: proposal.expectedSeq,
      currentPhase: proposal.targetPhase
    },
    roomId,
    async (courseId) => ({ authorized: await canReadCourse(actor, courseId) })
  );
  if (result.status === 200)
    await Proposal.updateOne({ _id: proposal._id }, { $set: { status: 'accepted' } });
  if (result.status === 409)
    await Proposal.updateOne({ _id: proposal._id }, { $set: { status: 'expired' } });
  return result;
}
