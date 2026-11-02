import { errorDetails } from '@ednova/shared/errors';
import VoiceSession, { IVoiceSession } from '../models/VoiceSession';

function findParticipantIndex(session: IVoiceSession, userId: string): number {
  return session.participants.findIndex((p) => p.userId === userId && !p.leftAt);
}

export async function ensureVoiceSession(sessionId: string): Promise<IVoiceSession> {
  let session = await VoiceSession.findOne({ sessionId });
  if (!session) {
    try {
      session = await VoiceSession.create({ sessionId, isActive: true, participants: [] });
    } catch (err) {
      if (errorDetails(err).code === 11000) {
        session = await VoiceSession.findOne({ sessionId });
      } else {
        throw err;
      }
    }
  }
  return session!;
}

export async function startVoiceSession(sessionId: string): Promise<IVoiceSession> {
  const session = await ensureVoiceSession(sessionId);
  session.isActive = true;
  session.startedAt = session.startedAt || new Date();
  session.endedAt = null;
  await session.save();
  return session;
}

export async function endVoiceSession(sessionId: string): Promise<IVoiceSession | null> {
  const session = await VoiceSession.findOne({ sessionId });
  if (!session) return null;
  session.isActive = false;
  session.endedAt = new Date();
  await session.save();
  return session;
}

export interface JoinParticipantArgs {
  sessionId: string;
  userId: string;
  peerId?: string;
}

export async function joinParticipant({
  sessionId,
  userId,
  peerId
}: JoinParticipantArgs): Promise<IVoiceSession> {
  const session = await ensureVoiceSession(sessionId);
  const idx = findParticipantIndex(session, userId);

  if (idx >= 0) {
    session.participants[idx].peerId = peerId || session.participants[idx].peerId;
    session.participants[idx].connectionState = 'connected';
    session.participants[idx].lastHeartbeat = new Date();
  } else {
    session.participants.push({
      userId,
      peerId: peerId || '',
      isMuted: false,
      speakingStatus: 'silent',
      connectionState: 'connected',
      speakingTime: 0,
      mutedDuration: 0,
      joinedAt: new Date(),
      lastHeartbeat: new Date()
    });
  }

  await session.save();
  return session;
}

export interface LeaveParticipantArgs {
  sessionId: string;
  userId: string;
}

export async function leaveParticipant({
  sessionId,
  userId
}: LeaveParticipantArgs): Promise<IVoiceSession | null> {
  const session = await VoiceSession.findOne({ sessionId });
  if (!session) return null;

  const idx = findParticipantIndex(session, userId);
  if (idx >= 0) {
    session.participants[idx].leftAt = new Date();
    session.participants[idx].connectionState = 'disconnected';
  }

  await session.save();
  return session;
}

export interface UpdateMuteArgs {
  sessionId: string;
  userId: string;
  isMuted: boolean;
}

export async function updateMute({
  sessionId,
  userId,
  isMuted
}: UpdateMuteArgs): Promise<IVoiceSession | null> {
  const session = await VoiceSession.findOne({ sessionId });
  if (!session) return null;

  const idx = findParticipantIndex(session, userId);
  if (idx >= 0) {
    session.participants[idx].isMuted = !!isMuted;
    session.participants[idx].lastHeartbeat = new Date();
  }

  await session.save();
  return session;
}

export interface UpdateSpeakingStatusArgs {
  sessionId: string;
  userId: string;
  speakingStatus: 'silent' | 'speaking' | 'loud';
}

export async function updateSpeakingStatus({
  sessionId,
  userId,
  speakingStatus
}: UpdateSpeakingStatusArgs): Promise<IVoiceSession | null> {
  const session = await VoiceSession.findOne({ sessionId });
  if (!session) return null;

  const idx = findParticipantIndex(session, userId);
  if (idx >= 0) {
    session.participants[idx].speakingStatus = speakingStatus || 'silent';
    session.participants[idx].lastHeartbeat = new Date();
  }

  await session.save();
  return session;
}

export async function getVoiceStatus(sessionId: string) {
  const session = await VoiceSession.findOne({ sessionId }).lean();
  if (!session) return null;

  return {
    sessionId,
    isActive: session.isActive,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    participants: (session.participants || []).filter((p) => !p.leftAt)
  };
}
