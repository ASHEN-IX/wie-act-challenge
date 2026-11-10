import crypto from 'node:crypto';
import logger from '../../../../shared/logger';

export interface LiveKitTokenOptions {
  apiKey?: string;
  apiSecret?: string;
  roomName: string;
  identity: string;
  name: string;
  canPublishAudio: boolean;
  canSubscribeAudio?: boolean;
  ttlSeconds?: number;
}

export function isLiveKitConfigured() {
  return Boolean(
    process.env.LIVEKIT_API_KEY?.trim() &&
    process.env.LIVEKIT_API_SECRET?.trim() &&
    /^wss?:\/\//.test(process.env.LIVEKIT_URL ?? '')
  );
}

export function getLiveKitConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
  const livekitUrl = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';
  const httpUrl = livekitUrl.replace(/^wss?:\/\//, (match) =>
    match === 'wss://' ? 'https://' : 'http://'
  );
  return { apiKey, apiSecret, livekitUrl, httpUrl };
}

export function generateLiveKitToken(options: LiveKitTokenOptions): string {
  const { apiKey: envKey, apiSecret: envSecret } = getLiveKitConfig();
  const apiKey = options.apiKey || envKey;
  const apiSecret = options.apiSecret || envSecret;
  const ttl = options.ttlSeconds || 3600;
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    sub: options.identity,
    name: options.name,
    iss: apiKey,
    nbf: now,
    exp: now + ttl,
    video: {
      room: options.roomName,
      roomJoin: true,
      canPublish: options.canPublishAudio,
      canSubscribe: options.canSubscribeAudio ?? true,
      canPublishData: false,
      canPublishSources: ['microphone']
    }
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function generateLiveKitAdminToken(roomName?: string): string {
  const { apiKey, apiSecret } = getLiveKitConfig();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: apiKey,
    sub: 'admin',
    nbf: now,
    exp: now + 600,
    video: {
      roomList: true,
      roomAdmin: true,
      roomCreate: true,
      ...(roomName ? { room: roomName } : {})
    }
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function revokeLiveKitPublishPermissions(
  roomName: string,
  identity: string
): Promise<{ success: boolean; error?: string }> {
  if (!isLiveKitConfigured()) return { success: false };
  const { httpUrl } = getLiveKitConfig();
  const adminToken = generateLiveKitAdminToken(roomName);

  try {
    const res = await fetch(`${httpUrl}/twirp/livekit.RoomService/UpdateParticipant`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        room: roomName,
        identity,
        permission: {
          canPublish: false,
          canSubscribe: true,
          canPublishData: true
        }
      }),
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      logger.info('LiveKit participant publish permission revoked server-side', {
        room: roomName,
        identity
      });
      return { success: true };
    }
    const errorBody = await res.text();
    logger.warn('LiveKit participant update returned non-200', {
      status: res.status,
      body: errorBody
    });
    return { success: false, error: errorBody };
  } catch (err) {
    logger.warn('LiveKit server unreachable for participant permission revocation', {
      error: (err as Error).message
    });
    return { success: false, error: (err as Error).message };
  }
}

export async function removeLiveKitParticipant(
  roomName: string,
  identity: string
): Promise<{ success: boolean; error?: string }> {
  if (!isLiveKitConfigured()) return { success: false };
  const { httpUrl } = getLiveKitConfig();
  const adminToken = generateLiveKitAdminToken(roomName);

  try {
    const res = await fetch(`${httpUrl}/twirp/livekit.RoomService/RemoveParticipant`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        room: roomName,
        identity
      }),
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      logger.info('LiveKit participant removed from room server-side', {
        room: roomName,
        identity
      });
      return { success: true };
    }
    const errorBody = await res.text();
    return { success: false, error: errorBody };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

interface AgentDispatch {
  id: string;
  agent_name?: string;
  agentName?: string;
  room: string;
}

export async function requestLiveKitModerator(room: string, agentName: string) {
  const { httpUrl } = getLiveKitConfig();
  const call = async (method: string, body: object) => {
    const response = await fetch(`${httpUrl}/twirp/livekit.AgentDispatchService/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${generateLiveKitAdminToken(room)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) throw new Error('LiveKit rejected the moderator request');
    return response.json();
  };
  const existing = (await call('ListDispatch', { room })) as {
    agent_dispatches?: AgentDispatch[];
    agentDispatches?: AgentDispatch[];
  };
  const current = (existing.agent_dispatches ?? existing.agentDispatches ?? []).find(
    (entry) => (entry.agent_name ?? entry.agentName) === agentName
  );
  const dispatch = current ?? (await call('CreateDispatch', { room, agent_name: agentName }));
  if (typeof dispatch?.id !== 'string' || dispatch.room !== room) {
    throw new Error('LiveKit did not return a moderator dispatch');
  }
  return dispatch.id as string;
}
