export interface SignalPayload {
  signalType: string;
  targetUserId: string | null;
  signal: any;
}

export function normalizeSignalPayload(payload: any = {}): SignalPayload {
  return {
    signalType: payload.signalType || 'unknown',
    targetUserId: payload.targetUserId || null,
    signal: payload.signal || null
  };
}
