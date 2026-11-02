import { readRoomVisualization } from '../services/roomVisualization';
import { resolveRoomActivity, validateRoomRevision } from '../services/roomActivity';
import type { Response, NextFunction } from 'express';
import type { FilterQuery } from 'mongoose';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { IStudyRoom, IStudyRoomParticipant, RoomPhase } from '../models/StudyRoom';
import type { IFacilitatorIntervention } from '../models/FacilitatorIntervention';
import { errorDetails } from '@ednova/shared/errors';

// Existing Python Contract 15 response and local-policy projection.
interface FacilitatorProposal {
  shouldIntervene: boolean;
  strategy: string;
  trigger?: string;
  interventionId?: string;
  targetSpeakerId?: string;
  targetUserId?: string;
  targetSpeakerName?: string;
  reasoning?: string;
  message?: string;
  messageText?: string;
  cooldownSeconds?: number;
  proposedUICommand?: IFacilitatorIntervention['proposedUICommand'];
}

interface RoomRequest extends DomainRequest {
  params: Record<string, string>;
  studyRoom?: IStudyRoom;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@ednova/shared/moduleClient');
import Joi from 'joi';
import { StudyRoom, FacilitatorIntervention, Course, StudentAttempt } from '../models';
import { buildInternalHeaders } from '../utils/sessionHelpers';
import { logger } from '@ednova/shared';
import { runRoomCommand } from '../services/roomCommands';
import { canReadCourse } from '../services/resourceAccess';
import {
  generateLiveKitToken,
  revokeLiveKitPublishPermissions,
  removeLiveKitParticipant
} from '../services/livekitControl';
import { assessConfusion, type ConfusionAssessment } from '../services/confusionSignals';
// Static imports: native dynamic import() cannot resolve .ts sources under tsx/cjs at runtime.
import { activeLearningRoom } from '../services/roomLearning';
import { getAttemptResult } from '../services/activityAttempt';
import type { DomainMiddleware } from '../../../../src/framework/contracts';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiClient = require('@ednova/shared/aiClient');

const router = createContracts();
const NOTIFICATION_URL = 'module://notifications';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateRoomId(): string {
  return `room_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export async function broadcastRoomState(room: IStudyRoom, req?: DomainRequest): Promise<void> {
  try {
    const activeParticipants = (room.participants || []).filter((p) => !p.leftAt);
    const publicSubmissionsCount = activeParticipants.filter((p) => p.hasSubmitted).length;

    const payload = {
      type: 'ROOM_STATE_SYNC',
      roomId: room.roomId,
      seq: room.seq,
      timestamp: new Date().toISOString(),
      presenterUserId: room.presenterUserId,
      activeActivityId: room.activeActivityId || null,
      courseId: room.courseId,
      revisionId: room.revisionId,
      activePin: room.activePin,
      activityRound: room.activityRound,
      currentPhase: room.currentPhase,
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        isOnline: p.isOnline,
        isSpeaking: !!p.isSpeaking,
        hasSubmitted: !!p.hasSubmitted
      })),
      publicSubmissionsCount
    };

    const authCookie = req?.headers?.cookie || req?.headers?.authorization;
    const headers = buildInternalHeaders(authCookie);

    await moduleClient.post(
      `${NOTIFICATION_URL}/api/v1/notifications/broadcast-session`,
      {
        roomId: room.roomId,
        sessionId: room.roomId,
        payload
      },
      { headers, timeout: 3000 }
    );
  } catch (err) {
    logger.warn(`Failed to broadcast room state for ${room.roomId}: ${errorDetails(err).message}`);
  }
}

async function broadcastFacilitatorIntervention(
  room: IStudyRoom,
  intervention: IFacilitatorIntervention,
  req?: DomainRequest
): Promise<void> {
  try {
    const payload = {
      type: 'FACILITATOR_INTERVENTION',
      roomId: room.roomId,
      seq: room.seq,
      timestamp: new Date().toISOString(),
      intervention: {
        interventionId: intervention.interventionId,
        strategy: intervention.strategy,
        trigger: intervention.trigger,
        targetUserId: intervention.targetUserId,
        targetSpeakerName: intervention.targetSpeakerName,
        reasoning: intervention.reasoning,
        message: intervention.message,
        proposedUICommand: intervention.proposedUICommand,
        status: intervention.status,
        cooldownSeconds: intervention.cooldownSeconds,
        createdAt: intervention.createdAt || new Date().toISOString()
      }
    };

    const authCookie = req?.headers?.cookie || req?.headers?.authorization;
    const headers = buildInternalHeaders(authCookie);

    await moduleClient.post(
      `${NOTIFICATION_URL}/api/v1/notifications/broadcast-session`,
      {
        roomId: room.roomId,
        sessionId: room.roomId,
        payload
      },
      { headers, timeout: 3000 }
    );
  } catch (err) {
    logger.warn(
      `Failed to broadcast facilitator intervention for ${room.roomId}: ${errorDetails(err).message}`
    );
  }
}

async function broadcastFacilitatorDeclined(
  room: IStudyRoom,
  interventionId: string,
  userId: string,
  req?: DomainRequest
): Promise<void> {
  try {
    const payload = {
      type: 'FACILITATOR_DECLINED',
      roomId: room.roomId,
      seq: room.seq,
      timestamp: new Date().toISOString(),
      interventionId,
      userId
    };

    const authCookie = req?.headers?.cookie || req?.headers?.authorization;
    const headers = buildInternalHeaders(authCookie);

    await moduleClient.post(
      `${NOTIFICATION_URL}/api/v1/notifications/broadcast-session`,
      {
        roomId: room.roomId,
        sessionId: room.roomId,
        payload
      },
      { headers, timeout: 3000 }
    );
  } catch (err) {
    logger.warn(
      `Failed to broadcast facilitator declined for ${room.roomId}: ${errorDetails(err).message}`
    );
  }
}

function evaluateLocalPeerFirstPolicy(obs: {
  transcriptText: string;
  actionType: string;
  hintLevel?: number;
  confusion?: ConfusionAssessment;
  currentPhase: string;
  participants: Array<Pick<IStudyRoomParticipant, 'userId' | 'name' | 'leftAt'>>;
  speakerName?: string;
  speakerUserId?: string;
}): {
  shouldIntervene: boolean;
  strategy: string;
  trigger: string;
  targetUserId?: string;
  targetSpeakerName?: string;
  reasoning: string;
  messageText: string;
  proposedUICommand?: IFacilitatorIntervention['proposedUICommand'];
} {
  const text = (obs.transcriptText || '').toLowerCase();
  const peers = (obs.participants || []).filter((p) => p.userId !== obs.speakerUserId && !p.leftAt);
  const targetPeer = peers.length > 0 ? peers[0] : null;

  // Rule 1: Direct answer requests are forbidden and deflected to peers
  if (
    obs.actionType === 'ask_facilitator' &&
    (text.includes('what is the answer') ||
      text.includes('give me the answer') ||
      text.includes('give me solution') ||
      text.includes('tell me the answer') ||
      text.includes('direct answer'))
  ) {
    const peerName = targetPeer ? targetPeer.name : 'your teammates';
    return {
      shouldIntervene: true,
      strategy: 'SOCRATIC_NUDGE',
      trigger: 'explicit_ask',
      targetUserId: targetPeer?.userId,
      targetSpeakerName: peerName,
      reasoning: 'Direct answer deflection: prompting peer collaborative reasoning.',
      messageText: `I cannot provide the direct answer to this problem. ${peerName}, how would you suggest we break down this concept from first principles?`
    };
  }

  // General questions to facilitator
  if (obs.actionType === 'ask_facilitator') {
    const peerName = targetPeer ? targetPeer.name : 'the group';
    return {
      shouldIntervene: true,
      strategy: 'PEER_CHALLENGE',
      trigger: 'explicit_ask',
      targetUserId: targetPeer?.userId,
      targetSpeakerName: peerName,
      reasoning: 'Peer-first deflection of student query.',
      messageText: `That is a great question to explore! ${peerName}, what is your take on ${obs.transcriptText || 'this problem'}?`
    };
  }

  // Rule 2: Misconception detection (e.g. 1NF atomicity vs primary key)
  if (
    (text.includes('1nf') || text.includes('first normal form')) &&
    (text.includes('primary key') || text.includes('unique'))
  ) {
    const peerName = targetPeer ? targetPeer.name : 'the team';
    return {
      shouldIntervene: true,
      strategy: 'PEER_CHALLENGE',
      trigger: 'misconception_detected',
      targetUserId: targetPeer?.userId,
      targetSpeakerName: peerName,
      reasoning: 'Confusing 1NF (atomic values) with entity integrity (primary key uniqueness).',
      messageText: `Notice ${obs.speakerName || 'the'}'s explanation about 1NF and primary keys. ${peerName}, does having a unique primary key guarantee atomicity in each column, or can repeating groups still exist?`
    };
  }

  // Rule 2b: Learner signalled they are stuck; peers reason first, before any explanation
  if (obs.actionType === 'statement' && obs.confusion?.tentative) {
    const peerName = targetPeer ? targetPeer.name : 'the team';
    return {
      shouldIntervene: true,
      strategy: 'PEER_CHALLENGE',
      trigger: 'confusion_signal',
      targetUserId: targetPeer?.userId,
      targetSpeakerName: peerName,
      reasoning: `Tentative confusion signal (${obs.confusion.reasons.join(', ')}): peer-first reasoning before explanation.`,
      messageText: `${obs.speakerName || 'A teammate'} may be stuck on this step. ${peerName}, how would you approach it from first principles?`
    };
  }

  // Rule 3: Graduated Socratic hint
  if (obs.actionType === 'request_hint') {
    const level = obs.hintLevel || 1;
    if (level === 1) {
      return {
        shouldIntervene: true,
        strategy: 'SOCRATIC_NUDGE',
        trigger: 'request_hint',
        targetUserId: obs.speakerUserId,
        targetSpeakerName: obs.speakerName,
        reasoning: 'Graduated Socratic hint Level 1: Conceptual invariant.',
        messageText:
          'Socratic Hint (Level 1): Consider the core invariant. Are any attributes storing multi-valued collections or delimited lists?'
      };
    } else {
      return {
        shouldIntervene: true,
        strategy: 'SOCRATIC_NUDGE',
        trigger: 'request_hint',
        targetUserId: obs.speakerUserId,
        targetSpeakerName: obs.speakerName,
        reasoning: 'Graduated Socratic hint Level 2: Structural breakdown.',
        messageText:
          'Socratic Hint (Level 2): Check the attributes table. If a student can take multiple subjects, should subjects be in one column or a separate relationship table?'
      };
    }
  }

  // Rule 4: Phase transition consensus check
  if (obs.actionType === 'phase_transition') {
    return {
      shouldIntervene: true,
      strategy: 'CONSENSUS_CHECK',
      trigger: 'phase_transition',
      reasoning: 'Validating team consensus before advancing to practice phase.',
      messageText:
        'Before advancing to individual practice, let us take 15 seconds: does anyone have an open question or alternative perspective?'
    };
  }

  return {
    shouldIntervene: false,
    strategy: 'CONCEPT_PROMPT',
    trigger: 'explicit_ask',
    reasoning: 'No intervention required.',
    messageText: ''
  };
}

// ── Validation schemas ──────────────────────────────────────────────────────────
const createRoomSchema = Joi.object({
  courseId: Joi.string().allow('', null).optional(),
  revisionId: Joi.string().allow('', null).optional(),
  title: Joi.string().max(200).allow('', null).optional(),
  maxParticipants: Joi.number().min(2).max(10).default(6),
  moderatorMode: Joi.string().valid('guided', 'on_demand', 'muted').default('guided'),
  enableVoice: Joi.boolean().default(true)
});

const joinRoomSchema = Joi.object({
  inviteCode: Joi.string().trim().max(12).optional(),
  roomId: Joi.string().trim().max(64).optional(),
  hasVoiceConsent: Joi.boolean().default(false)
}).or('inviteCode', 'roomId');

const updatePhaseSchema = Joi.object({
  currentPhase: Joi.string()
    .valid('idle', 'peer_discussion', 'individual_attempt', 'debrief')
    .required(),
  activeActivityId: Joi.string().allow('', null).optional()
});

const updatePresenterSchema = Joi.object({
  presenterUserId: Joi.string().required()
});

// Reuse the content owner's authorization boundary. Ingestion completion is
// never an enrollment grant. Contract 03 published revisions are not available yet.
async function verifyCourseAccess(
  courseId: string,
  req: DomainRequest
): Promise<{ authorized: boolean; title?: string }> {
  try {
    const response = await moduleClient.get(
      `module://study/api/v1/study/courses/${encodeURIComponent(courseId)}`,
      { headers: { Cookie: req.headers.cookie }, timeout: 5000 }
    );
    return { authorized: !!response.data?.course, title: response.data?.course?.title };
  } catch {
    if (req.user?.userId) {
      try {
        const canRead = await canReadCourse(req.user.userId, courseId);
        if (canRead) {
          const course = await Course.findOne({
            $or: [{ courseId }, { _id: courseId.match(/^[0-9a-fA-F]{24}$/) ? courseId : null }]
          }).lean();
          return { authorized: true, title: course?.title };
        }
      } catch {
        // Fall through
      }
    }
    return { authorized: false };
  }
}

// Applied explicitly per operation: contract middleware also runs in Nest's
// in-process dispatcher, not just the retained Express adapter.
async function requireActiveRoom(req: RoomRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const room = await StudyRoom.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (
      room.status !== 'active' ||
      !room.participants.some((p) => p.userId === userId && !p.leftAt)
    ) {
      return res.status(403).json({ error: 'Not an active participant in this room' });
    }
    if (room.courseId && !(await verifyCourseAccess(room.courseId, req)).authorized) {
      return res.status(403).json({ error: 'Course access is no longer available' });
    }
    await validateRoomRevision(userId, room);
    req.studyRoom = room;
    return next();
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err && typeof err.status === 'number')
      return res
        .status(err.status)
        .json({ error: err instanceof Error ? err.message : 'Unavailable' });
    return next(err);
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// Self-only consent is separate from join/replay and is idempotent. Missing
// consent never grants voice transport rights.
router.put('/:roomId/voice-consent', requireActiveRoom, async (req: RoomRequest, res: Response) => {
  if (
    !req.body ||
    Object.keys(req.body).some((key) => key !== 'hasVoiceConsent') ||
    typeof req.body.hasVoiceConsent !== 'boolean'
  )
    return res.status(400).json({ error: 'Explicit boolean consent required' });
  const actor = req.user!.userId;
  const member = { userId: actor, leftAt: { $exists: false } };
  let room = await StudyRoom.findOneAndUpdate(
    {
      roomId: req.params.roomId,
      status: 'active',
      participants: {
        $elemMatch: { ...member, hasVoiceConsent: { $ne: req.body.hasVoiceConsent } }
      }
    },
    {
      $set: {
        'participants.$.hasVoiceConsent': req.body.hasVoiceConsent,
        ...(!req.body.hasVoiceConsent ? { 'participants.$.isSpeaking': false } : {})
      },
      $inc: { seq: 1 }
    },
    { new: true }
  );
  if (!room)
    room = await StudyRoom.findOne({
      roomId: req.params.roomId,
      status: 'active',
      participants: { $elemMatch: member }
    });
  if (!room || (room.courseId && !(await canReadCourse(actor, room.courseId))))
    return res.status(403).json({ error: 'Room authorization lost' });

  // If consent was withdrawn, proactively revoke active LiveKit publish permission
  if (!req.body.hasVoiceConsent) {
    await revokeLiveKitPublishPermissions(room.roomId, actor).catch(() => {});
  }

  return res.json({
    roomId: room.roomId,
    hasVoiceConsent:
      room.participants.find((participant) => participant.userId === actor && !participant.leftAt)
        ?.hasVoiceConsent === true
  });
});

// Contract 11: LiveKit Access Token Issuance
router.post(
  '/:roomId/livekit-token',
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    const actor = req.user?.userId;
    if (!actor) return res.status(401).json({ error: 'Authentication required' });
    const room = await StudyRoom.findOne({
      roomId: req.params.roomId,
      status: 'active',
      participants: { $elemMatch: { userId: actor, leftAt: { $exists: false } } }
    }).lean();
    if (!room) return res.status(403).json({ error: 'Not an active participant in this room' });

    if (room.courseId && !(await canReadCourse(actor, room.courseId))) {
      return res.status(403).json({ error: 'Room course authorization lost' });
    }

    const participant = (room.participants || []).find((p) => p.userId === actor && !p.leftAt);
    const hasVoiceConsent = participant?.hasVoiceConsent === true;
    const canPublishAudio = hasVoiceConsent;
    const canSubscribeAudio = true;

    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    const livekitUrl = process.env.LIVEKIT_URL || 'wss://ednova-livekit.cloud.livekit.io';

    const token = generateLiveKitToken({
      apiKey,
      apiSecret,
      roomName: room.roomId,
      identity: actor,
      name: participant?.name || actor,
      canPublishAudio,
      canSubscribeAudio,
      ttlSeconds: 3600
    });

    return res.json({
      token,
      livekitUrl,
      roomName: room.roomId,
      participantIdentity: actor,
      participantName: participant?.name || actor,
      expiresInSeconds: 3600,
      canPublishAudio,
      canSubscribeAudio
    });
  }
);

// Contract 12: AI Moderator Dispatch
router.post(
  '/:roomId/ai-moderator/dispatch',
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    const actor = req.user?.userId;
    if (!actor) return res.status(401).json({ error: 'Authentication required' });
    const room = await StudyRoom.findOne({
      roomId: req.params.roomId,
      status: 'active',
      participants: { $elemMatch: { userId: actor, leftAt: { $exists: false } } }
    });
    if (!room) return res.status(403).json({ error: 'Not an active participant in this room' });

    if (room.courseId && !(await canReadCourse(actor, room.courseId))) {
      return res.status(403).json({ error: 'Room course authorization lost' });
    }

    await StudyRoom.updateOne(
      { roomId: room.roomId },
      { $set: { facilitatorActive: true }, $inc: { seq: 1 } }
    );

    return res.json({
      dispatched: true,
      roomId: room.roomId,
      agentIdentity: 'agent-ednova-moderator',
      mode: 'peer_first_facilitator',
      status: 'ready'
    });
  }
);

// Additive replay protocol on the existing contracts. Legacy callers without a
// command ID retain their original behavior, but cannot claim durable replay.
function durableRoomCommand(kind: Parameters<typeof runRoomCommand>[0]): DomainMiddleware {
  return async (req, res, next) => {
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'commandId')) return next();
    const actor = req.user;
    if (!actor?.userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await runRoomCommand(
      kind,
      { userId: actor.userId, name: typeof actor.name === 'string' ? actor.name : undefined },
      req.body,
      typeof req.params.roomId === 'string' ? req.params.roomId : undefined,
      (courseId) => verifyCourseAccess(courseId, req)
    );
    if (result.changedRoom) await broadcastRoomState(result.changedRoom, req);
    return res.status(result.status).json(result.body);
  };
}

// Demonstration cursor is separate from frozen assessed activity contracts.
router.get('/:roomId/visualization', async (req: RoomRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    return res.json(await readRoomVisualization(req.user.userId, req.params.roomId));
  } catch (error) {
    return res
      .status((error as { status?: number }).status || 503)
      .json({ error: 'Room visualization unavailable or unauthorized' });
  }
});
router.put('/:roomId/visualization', async (req: RoomRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.body?.commandId)
    return res.status(400).json({ error: 'Durable command identity required' });
  const result = await runRoomCommand(
    'visualization',
    { userId: req.user.userId },
    req.body,
    req.params.roomId,
    (courseId) => verifyCourseAccess(courseId, req)
  );
  if (result.changedRoom) await broadcastRoomState(result.changedRoom, req);
  if (result.status === 200) {
    try {
      await readRoomVisualization(req.user.userId, req.params.roomId);
    } catch {
      return res.status(403).json({ error: 'Room visualization access revoked' });
    }
  }
  return res.status(result.status).json(result.body);
});

// POST / — Create study room (Contract 10)
router.post('/', durableRoomCommand('create'), async (req: RoomRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { error, value } = createRoomSchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.details[0].message });

    let title = value.title;
    if (value.courseId) {
      const access = await verifyCourseAccess(value.courseId, req);
      if (!access.authorized) {
        return res
          .status(403)
          .json({ error: 'Forbidden: not enrolled or authorized for this course' });
      }
      if (!title && access.title) {
        title = `${access.title} Study Group`;
      }
    }
    await validateRoomRevision(userId, value);
    if (!title) title = 'Study Together Room';

    let inviteCode = generateInviteCode();
    let collisionCheck = await StudyRoom.findOne({ inviteCode, status: 'active' });
    let attempts = 0;
    while (collisionCheck && attempts < 5) {
      inviteCode = generateInviteCode();
      collisionCheck = await StudyRoom.findOne({ inviteCode, status: 'active' });
      attempts++;
    }

    const roomId = generateRoomId();

    const room = await StudyRoom.create({
      roomId,
      inviteCode,
      courseId: value.courseId || undefined,
      revisionId: value.revisionId || undefined,
      hostUserId: userId,
      presenterUserId: userId,
      title,
      maxParticipants: value.maxParticipants,
      moderatorMode: value.moderatorMode,
      currentPhase: 'idle',
      activeActivityId: null,
      status: 'active',
      seq: 1,
      participants: [
        {
          userId,
          name: req.user!.name || 'Host',
          role: 'host',
          hasVoiceConsent: !!value.enableVoice,
          isOnline: true,
          hasSubmitted: false,
          joinedAt: new Date()
        }
      ]
    });

    broadcastRoomState(room, req);

    return res.status(201).json({
      roomId: room.roomId,
      inviteCode: room.inviteCode,
      courseId: room.courseId,
      title: room.title,
      presenterUserId: room.presenterUserId,
      moderatorMode: room.moderatorMode,
      participantsCount: 1,
      currentPhase: room.currentPhase,
      createdAt: room.createdAt.toISOString()
    });
  } catch (err) {
    logger.error('Error creating study room:', err);
    return res
      .status((err as { status?: number }).status || 500)
      .json({ error: errorDetails(err).message || 'Internal server error' });
  }
});

// POST /join — Join room by inviteCode or roomId (Contract 10)
router.post('/join', durableRoomCommand('join'), async (req: RoomRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { error, value } = joinRoomSchema.validate(req.body || {});
    if (error) return res.status(400).json({ error: error.details[0].message });

    const filter: FilterQuery<IStudyRoom> = { status: 'active' };
    if (value.inviteCode) {
      filter.inviteCode = value.inviteCode.trim().toUpperCase();
    } else {
      filter.roomId = value.roomId.trim();
    }

    const room = await StudyRoom.findOne(filter);
    if (!room) return res.status(404).json({ error: 'Study room not found or closed' });

    // Validate course enrollment if course-bound
    if (room.courseId) {
      const access = await verifyCourseAccess(room.courseId, req);
      if (!access.authorized) {
        return res
          .status(403)
          .json({ error: 'Forbidden: not enrolled or authorized for this course' });
      }
    }
    await validateRoomRevision(userId, room);

    const existingParticipant = room.participants.find((p) => p.userId === userId);
    const activeParticipants = room.participants.filter((p) => !p.leftAt);
    if (!existingParticipant && !value.inviteCode) {
      return res.status(403).json({ error: 'An invite code is required to enter this room' });
    }

    // 1. Idempotent check: User is already an active participant
    if (existingParticipant && !existingParticipant.leftAt) {
      return res.status(200).json({
        roomId: room.roomId,
        inviteCode: room.inviteCode,
        courseId: room.courseId,
        title: room.title,
        presenterUserId: room.presenterUserId,
        moderatorMode: room.moderatorMode,
        participantsCount: activeParticipants.length,
        currentPhase: room.currentPhase,
        createdAt: room.createdAt.toISOString()
      });
    }

    // 2. Atomic Join with Capacity Check
    let updatedRoom: IStudyRoom | null;
    if (existingParticipant) {
      // Returning participant reactivation
      updatedRoom = await StudyRoom.findOneAndUpdate(
        {
          _id: room._id,
          status: 'active',
          participants: { $elemMatch: { userId, leftAt: { $exists: true } } },
          $expr: {
            $lt: [
              {
                $size: {
                  $filter: {
                    input: '$participants',
                    cond: { $not: '$$this.leftAt' }
                  }
                }
              },
              '$maxParticipants'
            ]
          }
        },
        {
          $unset: { 'participants.$.leftAt': 1 },
          $set: {
            'participants.$.isOnline': true,
            ...(value.hasVoiceConsent !== undefined
              ? { 'participants.$.hasVoiceConsent': !!value.hasVoiceConsent }
              : {})
          },
          $inc: { seq: 1 }
        },
        { new: true }
      );
    } else {
      // New participant addition
      updatedRoom = await StudyRoom.findOneAndUpdate(
        {
          _id: room._id,
          status: 'active',
          'participants.userId': { $ne: userId },
          $expr: {
            $lt: [
              {
                $size: {
                  $filter: {
                    input: '$participants',
                    cond: { $not: '$$this.leftAt' }
                  }
                }
              },
              '$maxParticipants'
            ]
          }
        },
        {
          $push: {
            participants: {
              userId,
              name: req.user!.name || 'Participant',
              role: 'participant',
              hasVoiceConsent: !!value.hasVoiceConsent,
              isOnline: true,
              hasSubmitted: false,
              joinedAt: new Date()
            }
          },
          $inc: { seq: 1 }
        },
        { new: true }
      );
    }

    if (!updatedRoom) {
      const fresh = await StudyRoom.findById(room._id).lean();
      if (
        fresh?.status === 'active' &&
        fresh.participants.some((p) => p.userId === userId && !p.leftAt)
      ) {
        return res.status(200).json({
          roomId: fresh.roomId,
          inviteCode: fresh.inviteCode,
          courseId: fresh.courseId,
          title: fresh.title,
          presenterUserId: fresh.presenterUserId,
          moderatorMode: fresh.moderatorMode,
          participantsCount: fresh.participants.filter((p) => !p.leftAt).length,
          currentPhase: fresh.currentPhase,
          createdAt: fresh.createdAt.toISOString()
        });
      }
      const currentActive = (fresh?.participants || []).filter((p) => !p.leftAt).length;
      if (fresh && currentActive >= fresh.maxParticipants) {
        return res.status(409).json({ error: 'Room has reached maximum capacity' });
      }
      return res.status(400).json({ error: 'Unable to join room' });
    }

    broadcastRoomState(updatedRoom, req);

    const updatedActive = updatedRoom.participants.filter((p) => !p.leftAt);
    return res.status(200).json({
      roomId: updatedRoom.roomId,
      inviteCode: updatedRoom.inviteCode,
      courseId: updatedRoom.courseId,
      title: updatedRoom.title,
      presenterUserId: updatedRoom.presenterUserId,
      moderatorMode: updatedRoom.moderatorMode,
      participantsCount: updatedActive.length,
      currentPhase: updatedRoom.currentPhase,
      createdAt: updatedRoom.createdAt.toISOString()
    });
  } catch (err) {
    logger.error('Error joining study room:', err);
    return res
      .status((err as { status?: number }).status || 500)
      .json({ error: errorDetails(err).message || 'Internal server error' });
  }
});

// GET / — List active rooms for user
router.get('/', async (req: RoomRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rooms = await StudyRoom.find({
      status: 'active',
      participants: { $elemMatch: { userId, leftAt: { $exists: false } } }
    })
      .sort({ createdAt: -1 })
      .lean();

    const accessible = await Promise.all(
      rooms.map(async (r) =>
        (!r.courseId || (await verifyCourseAccess(r.courseId, req)).authorized) &&
        (await validateRoomRevision(userId, r).then(
          () => true,
          () => false
        ))
          ? r
          : null
      )
    );
    const formatted = accessible
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({
        roomId: r.roomId,
        inviteCode: r.inviteCode,
        courseId: r.courseId,
        title: r.title,
        presenterUserId: r.presenterUserId,
        moderatorMode: r.moderatorMode,
        currentPhase: r.currentPhase,
        participantsCount: r.participants.filter((p) => !p.leftAt).length,
        createdAt: r.createdAt
      }));

    return res.json({ rooms: formatted });
  } catch (err) {
    return res
      .status((err as { status?: number }).status || 500)
      .json({ error: errorDetails(err).message });
  }
});

// GET /:roomId — Get room details & state
router.get('/:roomId', requireActiveRoom, async (req: RoomRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await StudyRoom.findOne({
      $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }]
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const activeParticipants = room.participants.filter((p) => !p.leftAt);
    const publicSubmissionsCount = activeParticipants.filter((p) => p.hasSubmitted).length;

    return res.json({
      room: {
        roomId: room.roomId,
        inviteCode: room.inviteCode,
        courseId: room.courseId,
        revisionId: room.revisionId,
        title: room.title,
        hostUserId: room.hostUserId,
        presenterUserId: room.presenterUserId,
        moderatorMode: room.moderatorMode,
        activeActivityId: room.activeActivityId,
        activePin: room.activePin,
        activityRound: room.activityRound,
        currentPhase: room.currentPhase,
        status: room.status,
        seq: room.seq,
        participantsCount: activeParticipants.length,
        publicSubmissionsCount,
        createdAt: room.createdAt
      },
      participants: activeParticipants.map((p) => ({
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        isOnline: p.isOnline,
        isSpeaking: !!p.isSpeaking,
        hasSubmitted: !!p.hasSubmitted
      }))
    });
  } catch (err) {
    return res
      .status((err as { status?: number }).status || 500)
      .json({ error: errorDetails(err).message });
  }
});

// GET /:roomId/participants — Participant roster (no leaked answers)
router.get('/:roomId/participants', requireActiveRoom, async (req: RoomRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = await StudyRoom.findOne({
      $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }]
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const active = room.participants.filter((p) => !p.leftAt);
    return res.json({
      roomId: room.roomId,
      participants: active.map((p) => ({
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        isOnline: p.isOnline,
        isSpeaking: !!p.isSpeaking,
        hasSubmitted: !!p.hasSubmitted,
        hasVoiceConsent: p.hasVoiceConsent
      }))
    });
  } catch (err) {
    return res
      .status((err as { status?: number }).status || 500)
      .json({ error: errorDetails(err).message });
  }
});

// POST /:roomId/leave — Leave study room (Contract 10)
router.post(
  '/:roomId/leave',
  durableRoomCommand('leave'),
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { roomId } = req.params;
      const room = await StudyRoom.findOne({
        $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }],
        status: 'active'
      });

      if (!room) return res.status(404).json({ error: 'Room not found or closed' });

      const participant = room.participants.find((p) => p.userId === userId && !p.leftAt);
      if (!participant) {
        return res.json({ success: true, message: 'User not currently in room' });
      }

      participant.leftAt = new Date();
      participant.isOnline = false;

      const remainingActive = room.participants.filter((p) => !p.leftAt);

      if (remainingActive.length === 0) {
        room.status = 'closed';
        room.closedAt = new Date();
      } else if (room.presenterUserId === userId) {
        // Reassign presenter to next active participant (host first, or next joined)
        const nextHost = remainingActive.find((p) => p.role === 'host') || remainingActive[0];
        room.presenterUserId = nextHost.userId;
      }

      const updatedRoom = await StudyRoom.findOneAndUpdate(
        { _id: room._id, status: 'active', seq: room.seq },
        {
          $set: {
            participants: room.participants,
            status: room.status,
            presenterUserId: room.presenterUserId,
            closedAt: room.closedAt
          },
          $inc: { seq: 1 }
        },
        { new: true }
      );
      if (!updatedRoom)
        return res.status(409).json({ error: 'Room changed; reload and retry leaving' });

      // If user was connected to LiveKit media session, proactively sever their connection
      await removeLiveKitParticipant(room.roomId, userId).catch(() => {});

      await broadcastRoomState(updatedRoom, req);

      return res.status(200).json({ success: true, roomId: room.roomId });
    } catch (err) {
      logger.error('Error leaving study room:', err);
      return res
        .status((err as { status?: number }).status || 500)
        .json({ error: errorDetails(err).message });
    }
  }
);

// PUT /:roomId/phase — Presenter updates currentPhase & activeActivityId (Contract 13)
router.put(
  '/:roomId/phase',
  durableRoomCommand('phase'),
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { roomId } = req.params;
      const { error, value } = updatePhaseSchema.validate(req.body || {});
      if (error) return res.status(400).json({ error: error.details[0].message });
      const room = req.studyRoom!;
      if (room.presenterUserId !== userId) {
        return res.status(403).json({ error: 'Only the active presenter can advance room phase' });
      }
      const selected = value.activeActivityId
        ? await resolveRoomActivity(userId, room, value.activeActivityId)
        : null;

      if (
        room.currentPhase === value.currentPhase &&
        (value.activeActivityId === undefined || room.activeActivityId === value.activeActivityId)
      ) {
        return res.json({
          success: true,
          roomId: room.roomId,
          seq: room.seq,
          currentPhase: room.currentPhase,
          activeActivityId: room.activeActivityId
        });
      }

      const updateOps: {
        $set: {
          currentPhase: RoomPhase;
          activeActivityId?: string | null;
          activePin?: IStudyRoom['activePin'];
          revisionId?: string;
          activityRound?: string;
          'participants.$[].hasSubmitted'?: boolean;
        };
        $inc: { seq: number };
      } = {
        $set: { currentPhase: value.currentPhase },
        $inc: { seq: 1 }
      };
      if (value.activeActivityId !== undefined) {
        updateOps.$set.activeActivityId = value.activeActivityId;
        updateOps.$set.activePin = selected?.pin || null;
        if (selected) updateOps.$set.revisionId = selected.pin.revisionId;
        updateOps.$set.activityRound = crypto.randomUUID();
        // Reset submission flags for the new round
        updateOps.$set['participants.$[].hasSubmitted'] = false;
      }

      const updatedRoom = await StudyRoom.findOneAndUpdate(
        {
          roomId,
          status: 'active',
          presenterUserId: userId,
          seq: room.seq,
          participants: { $elemMatch: { userId, leftAt: { $exists: false } } }
        },
        updateOps,
        { new: true }
      );

      if (!updatedRoom) {
        const exists = await StudyRoom.findOne({
          $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }]
        }).lean();
        if (!exists || exists.status !== 'active')
          return res.status(404).json({ error: 'Room not found or closed' });
        return res.status(409).json({ error: 'Room changed; reload before changing phase' });
      }

      broadcastRoomState(updatedRoom, req);

      return res.json({
        success: true,
        roomId: updatedRoom.roomId,
        seq: updatedRoom.seq,
        currentPhase: updatedRoom.currentPhase,
        activeActivityId: updatedRoom.activeActivityId
      });
    } catch (err) {
      return res
        .status((err as { status?: number }).status || 500)
        .json({ error: errorDetails(err).message });
    }
  }
);

// PUT /:roomId/presenter — Delegate presenter role
router.put(
  '/:roomId/presenter',
  durableRoomCommand('presenter'),
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { roomId } = req.params;
      const { error, value } = updatePresenterSchema.validate(req.body || {});
      if (error) return res.status(400).json({ error: error.details[0].message });
      const room = req.studyRoom!;
      if (room.presenterUserId !== userId) {
        return res
          .status(403)
          .json({ error: 'Only the active presenter can delegate presenter authority' });
      }
      if (value.presenterUserId === userId) {
        return res.json({
          success: true,
          roomId: room.roomId,
          seq: room.seq,
          presenterUserId: userId
        });
      }

      const updatedRoom = await StudyRoom.findOneAndUpdate(
        {
          roomId,
          status: 'active',
          presenterUserId: userId,
          seq: room.seq,
          participants: {
            $elemMatch: { userId: value.presenterUserId, leftAt: { $exists: false } }
          }
        },
        {
          $set: { presenterUserId: value.presenterUserId },
          $inc: { seq: 1 }
        },
        { new: true }
      );

      if (!updatedRoom) {
        const exists = await StudyRoom.findOne({
          $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }]
        }).lean();
        if (!exists || exists.status !== 'active')
          return res.status(404).json({ error: 'Room not found or closed' });
        if (exists.presenterUserId !== userId) {
          return res
            .status(403)
            .json({ error: 'Only current presenter or host can delegate presenter authority' });
        }
        if (!exists.participants.some((p) => p.userId === value.presenterUserId && !p.leftAt)) {
          return res
            .status(400)
            .json({ error: 'Target user is not an active participant in this room' });
        }
        return res
          .status(409)
          .json({ error: 'Room changed; reload before delegating presenter authority' });
      }

      broadcastRoomState(updatedRoom, req);

      return res.json({
        success: true,
        roomId: updatedRoom.roomId,
        seq: updatedRoom.seq,
        presenterUserId: updatedRoom.presenterUserId
      });
    } catch (err) {
      return res
        .status((err as { status?: number }).status || 500)
        .json({ error: errorDetails(err).message });
    }
  }
);

// A client declaration is not a verified private attempt (Contracts 05/06).
// Keep the existing route explicit until Tasnim's completion interface exists.
router.post('/:roomId/submit-flag', requireActiveRoom, async (_req: RoomRequest, res: Response) => {
  return res
    .status(503)
    .json({ error: 'Private assessment completion integration is unavailable' });
});

// ── ED-09: Collaborative Peer-First Facilitator Endpoints ────────────────────────

// POST /:roomId/facilitator/observe — Observe dialogue turn & prompt peer reasoning
router.post(
  '/:roomId/facilitator/observe',
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { roomId } = req.params;
      const room = await StudyRoom.findOne({
        $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }],
        status: 'active'
      });
      if (!room) return res.status(404).json({ error: 'Room not found or closed' });

      const participant = room.participants.find((p) => p.userId === userId && !p.leftAt);
      if (!participant)
        return res.status(403).json({ error: 'Not an active participant in this room' });

      const activeParticipants = room.participants.filter((p) => !p.leftAt);
      const {
        transcriptText = '',
        actionType = 'statement',
        hintLevel = 1,
        recentDialogue = []
      } = req.body;

      const confusion = assessConfusion({ transcriptText, hintLevel });

      // Check cooldown for automatic observations (routine dialogue throttled; misconceptions and confusion bypass)
      if (actionType === 'statement' && !req.body.force) {
        const lastIntervention = await FacilitatorIntervention.findOne({
          roomId: room.roomId
        }).sort({
          createdAt: -1
        });
        if (lastIntervention) {
          const elapsed = (Date.now() - new Date(lastIntervention.createdAt).getTime()) / 1000;
          const lower = transcriptText.toLowerCase();
          const hasKnownMisconception =
            (lower.includes('1nf') || lower.includes('normal form')) &&
            (lower.includes('primary key') || lower.includes('unique'));
          if (
            !hasKnownMisconception &&
            !confusion.tentative &&
            elapsed < (lastIntervention.cooldownSeconds || 15)
          ) {
            return res
              .status(200)
              .json({ success: true, intervened: false, reason: 'cooldown_active' });
          }
        }
      }

      const obsInput = {
        roomId: room.roomId,
        speakerUserId: userId,
        speakerName: participant.name || 'Student',
        transcriptText,
        actionType,
        currentPhase: room.currentPhase,
        activeActivityId: room.activeActivityId || null,
        learningContext: { courseId: room.courseId, title: room.title, confusion },
        confusion,
        participants: activeParticipants.map((p) => ({
          userId: p.userId,
          name: p.name || 'Student',
          role: p.role,
          hasSubmitted: !!p.hasSubmitted,
          isSpeaking: !!p.isSpeaking,
          isOnline: !!p.isOnline
        })),
        recentDialogue,
        hintLevel
      };

      let proposal: FacilitatorProposal | null = null;
      try {
        const aiRes: { data?: FacilitatorProposal } = await aiClient.post(
          '/api/ai/facilitator/observe',
          obsInput,
          {
            timeout: 4000
          }
        );
        if (aiRes?.data) proposal = aiRes.data;
      } catch (aiErr) {
        logger.info(
          `AI service unavailable for facilitator observe (${errorDetails(aiErr).message}), using peer-first policy engine.`
        );
        proposal = evaluateLocalPeerFirstPolicy(obsInput);
      }

      const currentRoom = await activeLearningRoom(userId, room.roomId);
      if (currentRoom.seq !== room.seq)
        return res.status(409).json({ error: 'Room changed during facilitation' });
      const proposalShape = Joi.object({
        shouldIntervene: Joi.boolean().required(),
        strategy: Joi.string()
          .valid(
            'PEER_CHALLENGE',
            'SOCRATIC_NUDGE',
            'CONCEPT_PROMPT',
            'INCLUSIVE_INVITATION',
            'CONSENSUS_CHECK',
            'DISAGREEMENT_RESOLUTION'
          )
          .when('shouldIntervene', { is: true, then: Joi.required() }),
        trigger: Joi.string().valid(
          'explicit_ask',
          'request_hint',
          'misconception_detected',
          'confusion_signal',
          'phase_transition',
          'consensus_check'
        ),
        message: Joi.string().max(8000),
        messageText: Joi.string().max(8000),
        reasoning: Joi.string().max(2000),
        interventionId: Joi.string().max(128),
        roomId: Joi.string().max(128),
        targetSpeakerId: Joi.string().max(128),
        targetUserId: Joi.string().max(128),
        targetSpeakerName: Joi.string().max(200),
        cooldownSeconds: Joi.number().integer().min(0).max(300),
        proposedUICommand: Joi.object({
          action: Joi.string().max(64).required(),
          activityId: Joi.string().max(128),
          reason: Joi.string().max(2000),
          targetPhase: Joi.string().valid(
            'idle',
            'peer_discussion',
            'individual_attempt',
            'debrief'
          )
        }).allow(null)
      }).unknown(false);
      if (proposal && proposalShape.validate(proposal, { convert: false }).error)
        return res.status(503).json({ error: 'Unsupported facilitator proposal' });
      const target = proposal?.targetSpeakerId || proposal?.targetUserId;
      if (target && !currentRoom.participants.some((p) => p.userId === target && !p.leftAt))
        return res.status(503).json({ error: 'Unsupported facilitator recipient' });
      if (!proposal || !proposal.shouldIntervene || !(proposal.messageText || proposal.message)) {
        return res.status(200).json({ success: true, intervened: false });
      }

      const updatedRoom = await StudyRoom.findOneAndUpdate(
        {
          _id: room._id,
          status: 'active',
          seq: room.seq,
          participants: { $elemMatch: { userId, leftAt: { $exists: false } } }
        },
        { $inc: { seq: 1 } },
        { new: true }
      );

      if (!updatedRoom) return res.status(409).json({ error: 'Room changed during facilitation' });
      const messageContent = proposal.message || proposal.messageText;
      const interventionDoc = await FacilitatorIntervention.create({
        interventionId: `int_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        roomId: room.roomId,
        strategy: proposal.strategy,
        trigger:
          proposal.trigger ||
          (actionType === 'ask_facilitator' ? 'explicit_ask' : 'misconception_detected'),
        targetUserId: proposal.targetSpeakerId || proposal.targetUserId,
        targetSpeakerName: proposal.targetSpeakerName,
        reasoning: proposal.reasoning || 'Fostering collaborative reasoning.',
        message: messageContent,
        proposedUICommand: proposal.proposedUICommand || null,
        status: 'delivered',
        cooldownSeconds: proposal.cooldownSeconds || 15
      });

      if (updatedRoom) {
        await broadcastFacilitatorIntervention(updatedRoom, interventionDoc, req);
      }

      await activeLearningRoom(userId, room.roomId);
      return res.status(200).json({
        success: true,
        intervened: true,
        seq: updatedRoom?.seq || room.seq + 1,
        intervention: interventionDoc
      });
    } catch (err) {
      return res
        .status((err as { status?: number }).status || 500)
        .json({ error: errorDetails(err).message });
    }
  }
);

// POST /:roomId/facilitator/action — Explicit learner action (ask, hint, decline, phase)
router.post(
  '/:roomId/facilitator/action',
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { roomId } = req.params;
      const room = await StudyRoom.findOne({
        $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }],
        status: 'active'
      });
      if (!room) return res.status(404).json({ error: 'Room not found or closed' });

      const participant = room.participants.find((p) => p.userId === userId && !p.leftAt);
      if (!participant)
        return res.status(403).json({ error: 'Not an active participant in this room' });

      const { actionType, promptText = '', hintLevel = 1, interventionId } = req.body;

      if (actionType === 'decline_prompt') {
        if (interventionId) {
          await FacilitatorIntervention.updateOne(
            { interventionId, roomId: room.roomId },
            { $set: { status: 'declined' } }
          );
        }
        await broadcastFacilitatorDeclined(room, interventionId || '', userId, req);
        return res.status(200).json({ success: true, status: 'declined' });
      }

      const activeParticipants = room.participants.filter((p) => !p.leftAt);
      const actionPayload = {
        roomId: room.roomId,
        actionType: actionType || 'ask_facilitator',
        userId,
        userName: participant.name || 'Student',
        promptText,
        hintLevel,
        currentPhase: room.currentPhase,
        activeActivityId: room.activeActivityId || null,
        learningContext: { courseId: room.courseId, title: room.title },
        participants: activeParticipants.map((p) => ({
          userId: p.userId,
          name: p.name || 'Student',
          role: p.role,
          hasSubmitted: !!p.hasSubmitted,
          isSpeaking: !!p.isSpeaking,
          isOnline: !!p.isOnline
        }))
      };

      let proposal: FacilitatorProposal | null = null;
      try {
        const aiRes: { data?: FacilitatorProposal } = await aiClient.post(
          '/api/ai/facilitator/action',
          actionPayload,
          {
            timeout: 4000
          }
        );
        if (aiRes?.data) proposal = aiRes.data;
      } catch (aiErr) {
        logger.info(
          `AI service unavailable for facilitator action (${errorDetails(aiErr).message}), using peer-first policy engine.`
        );
        proposal = evaluateLocalPeerFirstPolicy({
          ...actionPayload,
          speakerUserId: userId,
          speakerName: participant.name,
          transcriptText: promptText
        });
      }

      const currentRoom = await activeLearningRoom(userId, room.roomId);
      if (currentRoom.seq !== room.seq)
        return res.status(409).json({ error: 'Room changed during facilitation' });
      const proposalShape = Joi.object({
        shouldIntervene: Joi.boolean().required(),
        strategy: Joi.string()
          .valid(
            'PEER_CHALLENGE',
            'SOCRATIC_NUDGE',
            'CONCEPT_PROMPT',
            'INCLUSIVE_INVITATION',
            'CONSENSUS_CHECK',
            'DISAGREEMENT_RESOLUTION'
          )
          .when('shouldIntervene', { is: true, then: Joi.required() }),
        trigger: Joi.string().valid(
          'explicit_ask',
          'request_hint',
          'misconception_detected',
          'confusion_signal',
          'phase_transition',
          'consensus_check'
        ),
        message: Joi.string().max(8000),
        messageText: Joi.string().max(8000),
        reasoning: Joi.string().max(2000),
        interventionId: Joi.string().max(128),
        roomId: Joi.string().max(128),
        targetSpeakerId: Joi.string().max(128),
        targetUserId: Joi.string().max(128),
        targetSpeakerName: Joi.string().max(200),
        cooldownSeconds: Joi.number().integer().min(0).max(300),
        proposedUICommand: Joi.object({
          action: Joi.string().max(64).required(),
          activityId: Joi.string().max(128),
          reason: Joi.string().max(2000),
          targetPhase: Joi.string().valid(
            'idle',
            'peer_discussion',
            'individual_attempt',
            'debrief'
          )
        }).allow(null)
      }).unknown(false);
      if (proposal && proposalShape.validate(proposal, { convert: false }).error)
        return res.status(503).json({ error: 'Unsupported facilitator proposal' });
      const target = proposal?.targetSpeakerId || proposal?.targetUserId;
      if (target && !currentRoom.participants.some((p) => p.userId === target && !p.leftAt))
        return res.status(503).json({ error: 'Unsupported facilitator recipient' });
      if (!proposal || !proposal.shouldIntervene || !(proposal.messageText || proposal.message)) {
        return res.status(200).json({ success: true, intervened: false });
      }

      const updatedRoom = await StudyRoom.findOneAndUpdate(
        {
          _id: room._id,
          status: 'active',
          seq: room.seq,
          participants: { $elemMatch: { userId, leftAt: { $exists: false } } }
        },
        { $inc: { seq: 1 } },
        { new: true }
      );

      if (!updatedRoom) return res.status(409).json({ error: 'Room changed during facilitation' });
      const messageContent = proposal.message || proposal.messageText;
      const interventionDoc = await FacilitatorIntervention.create({
        interventionId: `int_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
        roomId: room.roomId,
        strategy: proposal.strategy,
        trigger:
          proposal.trigger || (actionType === 'request_hint' ? 'request_hint' : 'explicit_ask'),
        targetUserId: proposal.targetSpeakerId || proposal.targetUserId,
        targetSpeakerName: proposal.targetSpeakerName,
        reasoning: proposal.reasoning || 'Action processed.',
        message: messageContent,
        proposedUICommand: proposal.proposedUICommand || null,
        status: 'delivered',
        cooldownSeconds: proposal.cooldownSeconds || 15
      });

      if (updatedRoom) {
        await broadcastFacilitatorIntervention(updatedRoom, interventionDoc, req);
      }

      await activeLearningRoom(userId, room.roomId);
      return res.status(200).json({
        success: true,
        intervened: true,
        seq: updatedRoom?.seq || room.seq + 1,
        intervention: interventionDoc
      });
    } catch (err) {
      return res
        .status((err as { status?: number }).status || 500)
        .json({ error: errorDetails(err).message });
    }
  }
);

// GET /:roomId/facilitator/interventions — Fetch recent interventions for room
router.get(
  '/:roomId/facilitator/interventions',
  requireActiveRoom,
  async (req: RoomRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { roomId } = req.params;
      const room = await StudyRoom.findOne({
        $or: [{ roomId }, { _id: roomId.match(/^[0-9a-fA-F]{24}$/) ? roomId : null }],
        status: 'active'
      });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const isMember = room.participants.some((p) => p.userId === userId && !p.leftAt);
      if (!isMember) return res.status(403).json({ error: 'Access denied' });

      const interventions = await FacilitatorIntervention.find({ roomId: room.roomId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      return res.status(200).json({
        success: true,
        roomId: room.roomId,
        interventions
      });
    } catch (err) {
      return res
        .status((err as { status?: number }).status || 500)
        .json({ error: errorDetails(err).message });
    }
  }
);

// GET /:roomId/debrief — Group recap & recipient-only private check outcome (ED-11)
router.get('/:roomId/debrief', requireActiveRoom, async (req: RoomRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const room = req.studyRoom!;
    const activeParticipants = room.participants.filter((p) => !p.leftAt);
    const publicSubmissionsCount = activeParticipants.filter((p) => p.hasSubmitted).length;

    // 1. Group Public Recap (Strictly zero private answers/scores)
    const interventions = await FacilitatorIntervention.find({ roomId: room.roomId }).lean();
    const groupRecap = {
      roomId: room.roomId,
      title: room.title,
      courseId: room.courseId,
      currentPhase: room.currentPhase,
      activeActivityId: room.activeActivityId || null,
      participantsCount: activeParticipants.length,
      publicSubmissionsCount,
      completionRate:
        activeParticipants.length > 0 ? publicSubmissionsCount / activeParticipants.length : 0,
      facilitatorSummary: {
        totalInterventions: interventions.length,
        strategiesUsed: [...new Set(interventions.map((i) => i.strategy))]
      }
    };

    // 2. Per-Learner Private Outcome (Strictly recipient-only)
    let privateOutcome: Record<string, unknown> = {
      status: 'untested',
      message: 'No attempt recorded for this activity.'
    };

    if (room.activeActivityId) {
      const studentAttempt = await StudentAttempt.findOne({
        userId,
        activityId: room.activeActivityId,
        roomId: room.roomId
      })
        .sort({ submittedAt: -1 })
        .lean();

      if (studentAttempt && studentAttempt.assessmentResult) {
        const verified = await getAttemptResult(
          userId,
          studentAttempt.attemptId,
          room.activeActivityId
        );
        if (verified.status !== 'graded')
          return res.json({ recap: groupRecap, privateOutcome: verified });
        privateOutcome = {
          status: studentAttempt.status,
          score: verified.score,
          isCorrect: verified.isCorrect,
          feedback: verified.feedback,
          socraticHint: verified.socraticHint,
          recommendedNextStep: verified.recommendedNextStep,
          evidenceId: studentAttempt.evidenceId || null,
          evaluatedAt: verified.evaluatedAt
        };
      }
    }

    return res.json({
      recap: groupRecap,
      privateOutcome
    });
  } catch (err) {
    return res
      .status((err as { status?: number }).status || 500)
      .json({ error: errorDetails(err).message });
  }
});

export default router;
module.exports = router;
module.exports.broadcastRoomState = broadcastRoomState;
