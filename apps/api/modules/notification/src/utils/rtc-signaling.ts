export interface SignalPayload {
  signalType: string;
  targetUserId: string | null;
  signal: unknown;
}

export function normalizeSignalPayload(
  payload: { signalType?: string; targetUserId?: string | null; signal?: unknown } = {}
): SignalPayload {
  return {
    signalType: payload.signalType || 'unknown',
    targetUserId: payload.targetUserId || null,
    signal: payload.signal || null
  };
}
