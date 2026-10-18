import { voiceAPI } from "@/services/api";

export async function startVoiceSession(sessionId: string) {
  return voiceAPI.start(sessionId);
}

export async function endVoiceSession(sessionId: string) {
  return voiceAPI.end(sessionId);
}

export async function joinVoiceSession(sessionId: string, peerId: string = "") {
  return voiceAPI.join(sessionId, peerId);
}

export async function leaveVoiceSession(sessionId: string) {
  return voiceAPI.leave(sessionId);
}

export async function setVoiceMute(sessionId: string, isMuted: boolean) {
  return voiceAPI.mute(sessionId, isMuted);
}

export async function getVoiceStatus(sessionId: string) {
  return voiceAPI.status(sessionId);
}
