import { updateSpeakingStatus, updateMute } from '../services/voiceService';

export interface VoiceHandlerContext {
  sessionId: string;
  userId: string;
  broadcastToSession: (sessionId: string, payload: any) => Promise<void> | void;
}

export interface VoiceHandlerArgs {
  payload: any;
  context: VoiceHandlerContext;
}

export async function handleVoiceSignal({ payload, context }: VoiceHandlerArgs): Promise<void> {
  const { sessionId, userId, broadcastToSession } = context;

  broadcastToSession(sessionId, {
    type: 'voice_signal',
    sessionId,
    fromUserId: userId,
    signalType: payload?.signalType || 'unknown',
    targetUserId: payload?.targetUserId || null,
    signal: payload?.signal || null,
    createdAt: new Date().toISOString()
  });
}

export async function handleMuteState({ payload, context }: VoiceHandlerArgs): Promise<void> {
  const { sessionId, userId, broadcastToSession } = context;
  const isMuted = !!payload?.isMuted;

  await updateMute({ sessionId, userId, isMuted });

  broadcastToSession(sessionId, {
    type: 'voice_mute',
    sessionId,
    userId,
    isMuted,
    createdAt: new Date().toISOString()
  });
}

export async function handleSpeakingState({ payload, context }: VoiceHandlerArgs): Promise<void> {
  const { sessionId, userId, broadcastToSession } = context;
  const speakingStatus = payload?.speakingStatus || 'silent';

  await updateSpeakingStatus({ sessionId, userId, speakingStatus });

  broadcastToSession(sessionId, {
    type: 'voice_speaking',
    sessionId,
    userId,
    speakingStatus,
    createdAt: new Date().toISOString()
  });
}
