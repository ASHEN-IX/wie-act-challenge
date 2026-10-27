import moduleClient from '@study-partner/shared/moduleClient';

/** Reuse the owning study module's current membership/source decision. */
export async function verifySessionMembership(
  cookie: string | undefined,
  userId: string,
  sessionId: string
): Promise<boolean> {
  if (!cookie || !userId || !sessionId) return false;
  const endpoint = sessionId.startsWith('room_')
    ? `/api/v1/study/rooms/${encodeURIComponent(sessionId)}/participants`
    : `/api/v1/study/sessions/team/${encodeURIComponent(sessionId)}/participants`;
  try {
    const response = await moduleClient.get<{
      participants?: Array<{ userId?: unknown; leftAt?: unknown }>;
    }>(`module://study${endpoint}`, {
      headers: { Cookie: cookie },
      timeout: 5000
    });
    return (
      Array.isArray(response.data?.participants) &&
      response.data.participants.some(
        (p: { userId?: unknown; leftAt?: unknown }) =>
          String(p.userId) === String(userId) && !p.leftAt
      )
    );
  } catch {
    // Denial/unavailability must never downgrade a room to a legacy access path.
    return false;
  }
}

/** Membership is not microphone consent. Missing legacy consent fails closed. */
export async function verifyVoiceConsent(
  cookie: string | undefined,
  userId: string,
  sessionId: string
): Promise<boolean> {
  if (!cookie || !userId || !sessionId) return false;
  const endpoint = sessionId.startsWith('room_')
    ? `/api/v1/study/rooms/${encodeURIComponent(sessionId)}/participants`
    : `/api/v1/study/sessions/team/${encodeURIComponent(sessionId)}/participants`;
  try {
    const response = await moduleClient.get<{
      participants?: Array<{ userId?: unknown; leftAt?: unknown; hasVoiceConsent?: unknown }>;
    }>(`module://study${endpoint}`, { headers: { Cookie: cookie }, timeout: 5000 });
    return !!response.data?.participants?.some(
      (participant) =>
        String(participant.userId) === userId &&
        !participant.leftAt &&
        participant.hasVoiceConsent === true
    );
  } catch {
    return false;
  }
}
