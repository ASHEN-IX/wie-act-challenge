import { logger } from '@study-partner/shared';
import moduleClient from '@study-partner/shared/moduleClient';
import { WebSocketServer, WebSocket } from 'ws';
import app from './app';
import { handleChatQuery } from './websocket-handlers/chat-handler';
import {
  handleVoiceSignal,
  handleMuteState,
  handleSpeakingState
} from './websocket-handlers/voice-handler';
import { joinParticipant, leaveParticipant } from './services/voiceService';
import { normalizeSignalPayload } from './utils/rtc-signaling';

const PORT = process.env.PORT || 3000;
const USER_PROFILE_URL = 'module://users';
const STUDY_SERVICE_URL = 'module://study';

// ── WebSocket client registry ───────────────────────
// Map<userId, Set<WebSocket>>
const clients = new Map<string, Set<any>>();
// Map<sessionId, Map<userId, Set<WebSocket>>>
const sessionClients = new Map<string, Map<string, Set<any>>>();

export async function broadcastToUser(userId: string, payload: any): Promise<void> {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const msg = JSON.stringify(payload);
  for (const ws of userClients) {
    if (await authenticateWsRequest(ws.authRequest, ws.userId)) {
      ws.close(4401, 'Session invalidated');
      continue;
    }
    if (ws.readyState === 1) {
      ws.send(msg);
    }
  }
}

function addRealtimeClient(sessionId: string, userId: string, ws: any): void {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Map());
  }
  const sessionMap = sessionClients.get(sessionId)!;
  if (!sessionMap.has(userId)) {
    sessionMap.set(userId, new Set());
  }
  sessionMap.get(userId)!.add(ws);
}

function removeRealtimeClient(sessionId: string, userId: string, ws: any): void {
  const sessionMap = sessionClients.get(sessionId);
  if (!sessionMap) return;

  const userSockets = sessionMap.get(userId);
  if (!userSockets) return;

  userSockets.delete(ws);
  if (userSockets.size === 0) {
    sessionMap.delete(userId);
  }
  if (sessionMap.size === 0) {
    sessionClients.delete(sessionId);
  }
}

export async function broadcastToSession(sessionId: string, payload: any): Promise<void> {
  const sessionMap = sessionClients.get(sessionId);
  if (!sessionMap) return;
  const raw = JSON.stringify(payload);

  for (const sockets of sessionMap.values()) {
    for (const socket of sockets) {
      if (socket.readyState === 1) {
        socket.send(raw);
      }
    }
  }
}

// Expose broadcast function so routes can use it
(app.locals as any).broadcastToUser = broadcastToUser;

async function updateOnlineStatus(
  userId: string,
  status: string,
  authorization: any
): Promise<void> {
  try {
    await moduleClient.put(
      `${USER_PROFILE_URL}/api/v1/users/profile/online-status`,
      {
        userId,
        onlineStatus: status
      },
      { headers: { Cookie: authorization } }
    );
  } catch (err: any) {
    logger.warn(`Failed to update online status for ${userId}: ${err.message}`);
  }
}

export async function authenticateWsRequest(
  req: any,
  requestedUserId: string | null
): Promise<string | null> {
  if (!requestedUserId) return 'userId required';
  try {
    const { resolveIdentity } = require('@study-partner/shared/sessionIdentity');
    const trustedOrigins = () =>
      (process.env.AUTH_TRUSTED_ORIGINS || 'http://localhost:5173').split(',');
    if (req.headers.origin && !trustedOrigins().includes(req.headers.origin))
      return 'Unauthorized origin';
    const auth = await resolveIdentity(req.headers);
    return auth && String(auth.identity.userId) === String(requestedUserId) ? null : 'Unauthorized';
  } catch {
    return 'Unauthorized';
  }
}

export async function verifySessionMembership(
  token: any,
  userId: string,
  sessionId: string
): Promise<boolean> {
  try {
    const resp: any = await moduleClient.get(
      `${STUDY_SERVICE_URL}/api/v1/study/sessions/team/${sessionId}/participants`,
      { headers: { Cookie: token }, timeout: 5000 }
    );
    const participants = resp.data?.participants || [];
    return participants.some((p: any) => String(p.userId) === String(userId));
  } catch (err: any) {
    logger.warn(
      `Failed to verify session membership for ${userId} in ${sessionId}: ${err.message}`
    );
    return false;
  }
}

export function attachRealtime(server: any): () => Promise<void> {
  const wssNotifications = new WebSocketServer({ noServer: true });
  const wssRealtime = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: any, socket: any, head: any) => {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

    if (requestUrl.pathname === '/ws/notifications') {
      wssNotifications.handleUpgrade(req, socket, head, (ws: any) => {
        wssNotifications.emit('connection', ws, req);
      });
      return;
    }

    if (requestUrl.pathname === '/ws/realtime') {
      wssRealtime.handleUpgrade(req, socket, head, (ws: any) => {
        wssRealtime.emit('connection', ws, req);
      });
      return;
    }

    socket.destroy();
  });

  wssNotifications.on('connection', async (ws: any, req: any) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const userId = url.searchParams.get('userId');

    const authError = await authenticateWsRequest(req, userId);
    if (authError) {
      ws.close(4401, authError);
      return;
    }

    const authorization = req.headers.cookie;

    ws.authRequest = req;
    ws.userId = userId;
    if (!clients.has(userId!)) {
      clients.set(userId!, new Set());
    }
    clients.get(userId!)!.add(ws);
    logger.info(
      `WS client connected for user ${userId} (${clients.get(userId!)!.size} connections)`
    );

    if (clients.get(userId!)!.size === 1) {
      updateOnlineStatus(userId!, 'online', authorization);
    }

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data: any) => {
      if (await authenticateWsRequest(req, userId)) return ws.close(4401, 'Session invalidated');
      try {
        const msg = JSON.parse(data.toString());
        if (
          msg.type === 'status_update' &&
          ['online', 'studying', 'offline'].includes(msg.status)
        ) {
          updateOnlineStatus(userId!, msg.status, authorization);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      const userSet = clients.get(userId!);
      if (userSet) {
        userSet.delete(ws);
        if (userSet.size === 0) {
          clients.delete(userId!);
          updateOnlineStatus(userId!, 'offline', authorization);
        }
      }
      logger.info(`WS client disconnected for user ${userId}`);
    });

    ws.on('error', (err: Error) => {
      logger.warn(`WS error for user ${userId}: ${err.message}`);
    });
  });

  wssRealtime.on('connection', async (ws: any, req: any) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const userId = url.searchParams.get('userId');
    const sessionId = url.searchParams.get('sessionId');
    const token = req.headers.cookie;

    const authError = await authenticateWsRequest(req, userId);
    if (authError) {
      ws.close(4401, authError);
      return;
    }

    if (!sessionId) {
      ws.close(4001, 'sessionId required');
      return;
    }

    if (!(await verifySessionMembership(token, userId!, sessionId))) {
      ws.close(4403, 'Not a member of this session');
      return;
    }

    ws.authRequest = req;
    ws.sessionId = sessionId;
    ws.userId = userId;
    ws.isAlive = true;

    addRealtimeClient(sessionId, userId!, ws);
    await joinParticipant({ sessionId, userId: userId!, peerId: userId! });

    broadcastToSession(sessionId, {
      type: 'participant_joined',
      sessionId,
      userId,
      createdAt: new Date().toISOString()
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (raw: any) => {
      if (await authenticateWsRequest(req, userId)) return ws.close(4401, 'Session invalidated');
      if (!(await verifySessionMembership(req.headers.cookie, userId!, sessionId)))
        return ws.close(4403, 'Session membership revoked');
      let payload: any;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON payload' }));
        return;
      }

      const context = {
        userId: userId!,
        sessionId,
        broadcastToSession
      };

      try {
        if (payload.type === 'chat_query') {
          await handleChatQuery({ ws, payload, context });
          return;
        }

        if (payload.type === 'voice_signal') {
          await handleVoiceSignal({
            payload: normalizeSignalPayload(payload),
            context
          });
          return;
        }

        if (payload.type === 'voice_mute') {
          await handleMuteState({ payload, context });
          return;
        }

        if (payload.type === 'voice_speaking') {
          await handleSpeakingState({ payload, context });
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', error: err.message }));
      }
    });

    ws.on('close', async () => {
      removeRealtimeClient(sessionId, userId!, ws);
      await leaveParticipant({ sessionId, userId: userId! });

      broadcastToSession(sessionId, {
        type: 'participant_left',
        sessionId,
        userId,
        createdAt: new Date().toISOString()
      });
    });
  });

  const heartbeatInterval = setInterval(() => {
    const allSockets = [...wssNotifications.clients, ...wssRealtime.clients];
    allSockets.forEach(async (ws: any) => {
      if (await authenticateWsRequest(ws.authRequest, ws.userId))
        return ws.close(4401, 'Session invalidated');
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wssNotifications.on('close', () => clearInterval(heartbeatInterval));
  wssRealtime.on('close', () => clearInterval(heartbeatInterval));

  return async () => {
    clearInterval(heartbeatInterval);
    for (const ws of [...wssNotifications.clients, ...wssRealtime.clients]) ws.terminate();
    await Promise.all(
      [wssNotifications, wssRealtime].map((wss) => new Promise((resolve) => wss.close(resolve)))
    );
    clients.clear();
    sessionClients.clear();
  };
}
