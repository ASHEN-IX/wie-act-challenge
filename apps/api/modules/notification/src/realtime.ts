import { randomUUID } from 'node:crypto';
import { assertApiInstance } from '../../../src/framework/single-instance';
import type { IncomingMessage, Server } from 'node:http';
import { logger } from '@study-partner/shared';
import moduleClient from '@study-partner/shared/moduleClient';
import { WebSocketServer, WebSocket } from 'ws';
import { handleChatQuery } from './websocket-handlers/chat-handler';
import {
  handleVoiceSignal,
  handleMuteState,
  handleSpeakingState
} from './websocket-handlers/voice-handler';
import { joinParticipant, leaveParticipant } from './services/voiceService';
import { normalizeSignalPayload } from './utils/rtc-signaling';
import { verifySessionMembership, verifyVoiceConsent } from './utils/session-access';
import { errorDetails } from '@study-partner/shared/errors';
import type { IStudyRoom, IStudyRoomParticipant } from '../../study/src/models/StudyRoom';
export { verifySessionMembership } from './utils/session-access';

const PORT = process.env.PORT || 3000;
const USER_PROFILE_URL = 'module://users';
const STUDY_SERVICE_URL = 'module://study';

interface ManagedSocket extends WebSocket {
  authRequest?: IncomingMessage;
  userId?: string;
  sessionId?: string;
  realtimeRegistered?: boolean;
  cleanupRealtime?: () => void;
  isAlive?: boolean;
  checking?: boolean;
}
type RegisteredSocket = ManagedSocket & { authRequest: IncomingMessage; userId: string };
interface RoomSnapshot {
  room?: Pick<
    IStudyRoom,
    | 'roomId'
    | 'seq'
    | 'presenterUserId'
    | 'activeActivityId'
    | 'currentPhase'
    | 'activePin'
    | 'courseId'
    | 'revisionId'
    | 'activityRound'
  >;
  participants?: IStudyRoomParticipant[];
}
function messageObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid message object');
  }
  return value as Record<string, unknown>;
}

// ── WebSocket client registry ───────────────────────
// Map<userId, Set<WebSocket>>
const clients = new Map<string, Set<RegisteredSocket>>();
// Map<sessionId, Map<userId, Set<WebSocket>>>
const sessionClients = new Map<string, Map<string, Set<RegisteredSocket>>>();

export async function broadcastToUser(
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  assertApiInstance();
  const userClients = clients.get(userId);
  if (!userClients) return;
  const msg = JSON.stringify(payload);
  for (const ws of userClients) {
    if (await authenticateWsRequest(ws.authRequest, ws.userId || null)) {
      ws.close(4401, 'Session invalidated');
      continue;
    }
    if (
      (payload.type === 'session_start' &&
        typeof payload.sessionId === 'string' &&
        !(await verifySessionMembership(
          ws.authRequest.headers.cookie,
          userId,
          payload.sessionId
        ))) ||
      (payload.type === 'PRIVATE_ROOM_HELP_READY' &&
        typeof payload.roomId === 'string' &&
        !(await verifySessionMembership(ws.authRequest.headers.cookie, userId, payload.roomId)))
    )
      continue;
    if (ws.readyState === 1) {
      assertApiInstance();
      ws.send(msg);
    }
  }
}

function addRealtimeClient(sessionId: string, userId: string, ws: RegisteredSocket): void {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Map());
  }
  const sessionMap = sessionClients.get(sessionId)!;
  if (!sessionMap.has(userId)) {
    sessionMap.set(userId, new Set());
  }
  sessionMap.get(userId)!.add(ws);
}

function removeRealtimeClient(sessionId: string, userId: string, ws: ManagedSocket): void {
  const sessionMap = sessionClients.get(sessionId);
  if (!sessionMap) return;

  const userSockets = sessionMap.get(userId);
  if (!userSockets) return;

  for (const registered of userSockets) {
    if (registered === ws) userSockets.delete(registered);
  }
  if (userSockets.size === 0) {
    sessionMap.delete(userId);
  }
  if (sessionMap.size === 0) {
    sessionClients.delete(sessionId);
  }
}

// Ephemeral ordering is independent of durable room seq. No per-room history is retained.
const presenceEpoch = randomUUID();
let presenceVersion = 0;
const deliveries = new Map<string, Promise<void>>();

export function broadcastToSession(
  sessionId: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Serialize authorization, aggregation and send per room. Cleanup may enqueue a
  // subsequent publication, but never waits recursively on this queue.
  const previous = deliveries.get(sessionId) || Promise.resolve();
  const delivery = previous
    .catch(() => {})
    .then(async () => {
      assertApiInstance();
      const sessionMap = sessionClients.get(sessionId);
      if (!sessionMap) return;
      const eligible: RegisteredSocket[] = [];
      for (const socket of [...sessionMap.values()].flatMap((set) => [...set])) {
        if (socket.readyState !== WebSocket.OPEN) continue;
        const authError = await authenticateWsRequest(socket.authRequest, socket.userId);
        const member =
          !authError &&
          (await verifySessionMembership(
            socket.authRequest.headers.cookie,
            socket.userId,
            sessionId
          ));
        if (!member) {
          socket.cleanupRealtime?.();
          socket.close(authError ? 4401 : 4403, 'Room authorization lost');
        } else if (socket.readyState === WebSocket.OPEN && socket.realtimeRegistered) {
          eligible.push(socket);
        }
      }
      const recipients = eligible.filter(
        (socket) => socket.readyState === WebSocket.OPEN && socket.realtimeRegistered
      );
      const onlineUserIds = [...new Set(recipients.map((socket) => socket.userId))];
      let outgoing = payload;
      if (
        sessionId.startsWith('room_') &&
        (payload.type === 'ROOM_STATE_SYNC' || payload.type === 'ROOM_PRESENCE_SYNC')
      ) {
        outgoing = {
          ...payload,
          roomId: sessionId,
          presenceEpoch,
          presenceVersion: ++presenceVersion,
          onlineUserIds
        };
        if (payload.type === 'ROOM_STATE_SYNC') {
          outgoing.participants = (
            Array.isArray(payload.participants) ? payload.participants : []
          ).map((value: unknown) => {
            const p = messageObject(value);
            return {
              ...p,
              isOnline: typeof p.userId === 'string' && onlineUserIds.includes(p.userId)
            };
          });
        }
      }
      const raw = JSON.stringify(outgoing);
      for (const socket of recipients) {
        if (
          payload.type === 'voice_signal' &&
          typeof payload.targetUserId === 'string' &&
          socket.userId !== payload.targetUserId
        )
          continue;
        if (
          typeof payload.type === 'string' &&
          payload.type.startsWith('voice_') &&
          !(await verifyVoiceConsent(socket.authRequest.headers.cookie, socket.userId, sessionId))
        )
          continue;
        if (socket.readyState === WebSocket.OPEN && socket.realtimeRegistered) socket.send(raw);
      }
    });
  deliveries.set(sessionId, delivery);
  void delivery
    .finally(() => {
      if (deliveries.get(sessionId) === delivery) deliveries.delete(sessionId);
    })
    .catch(() => {});
  return delivery;
}

async function updateOnlineStatus(
  userId: string,
  status: string,
  authorization: string | undefined
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
  } catch (err) {
    logger.warn(`Failed to update online status for ${userId}: ${errorDetails(err).message}`);
  }
}

export async function authenticateWsRequest(
  req: IncomingMessage,
  requestedUserId: string | null
): Promise<string | null> {
  if (!requestedUserId) return 'userId required';
  try {
    const { resolveIdentity } =
      require('@study-partner/shared/sessionIdentity') as typeof import('@study-partner/shared/sessionIdentity');
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

function guardSocket(socket: WebSocket) {
  socket.send = function (...args: unknown[]) {
    assertApiInstance();
    Reflect.apply(WebSocket.prototype.send, this, args);
  };
}
export function attachRealtime(
  server: Server,
  options: { heartbeatMs?: number } = {}
): () => Promise<void> {
  let stopping = false;
  const wssNotifications = new WebSocketServer({ noServer: true });
  const wssRealtime = new WebSocketServer({ noServer: true });
  const pendingDisconnects = new Set<Promise<void>>();

  server.on('upgrade', (req, socket, head) => {
    try {
      assertApiInstance();
    } catch {
      socket.destroy();
      return;
    }
    const requestUrl = new URL(req.url || '/', `http://localhost:${PORT}`);

    if (requestUrl.pathname === '/ws/notifications') {
      wssNotifications.handleUpgrade(req, socket, head, (ws) => {
        guardSocket(ws);
        wssNotifications.emit('connection', ws, req);
      });
      return;
    }

    if (requestUrl.pathname === '/ws/realtime') {
      wssRealtime.handleUpgrade(req, socket, head, (ws) => {
        guardSocket(ws);
        wssRealtime.emit('connection', ws, req);
      });
      return;
    }

    socket.destroy();
  });

  wssNotifications.on('connection', async (ws: ManagedSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const userId = url.searchParams.get('userId');

    const authError = await authenticateWsRequest(req, userId);
    if (authError) {
      ws.close(4401, authError);
      return;
    }

    const authorization = req.headers.cookie;

    ws.authRequest = req;
    ws.userId = userId!;
    if (!clients.has(userId!)) {
      clients.set(userId!, new Set());
    }
    clients.get(userId!)!.add(Object.assign(ws, { authRequest: req, userId: userId! }));
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

    ws.on('message', async (data) => {
      if (await authenticateWsRequest(req, userId)) return ws.close(4401, 'Session invalidated');
      try {
        const msg = messageObject(JSON.parse(data.toString()));
        if (
          msg.type === 'status_update' &&
          typeof msg.status === 'string' &&
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
        userSet.delete(Object.assign(ws, { authRequest: req, userId: userId! }));
        if (userSet.size === 0) {
          clients.delete(userId!);
          updateOnlineStatus(userId!, 'offline', authorization);
        }
      }
      logger.info(`WS client disconnected for user ${userId}`);
    });

    ws.on('error', (err: Error) => {
      logger.warn(`WS error for user ${userId}: ${errorDetails(err).message}`);
    });
  });

  wssRealtime.on('connection', async (ws: ManagedSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const userId = url.searchParams.get('userId');
    const sessionId = url.searchParams.get('roomId') || url.searchParams.get('sessionId');
    const token = req.headers.cookie;
    const isRoom = !!sessionId?.startsWith('room_');
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    // Install before the first await: an abandoned authorization cannot register later.
    ws.cleanupRealtime = () => {
      if (!ws.realtimeRegistered) return;
      ws.realtimeRegistered = false;
      removeRealtimeClient(sessionId!, userId!, ws);
      if (stopping) return;
      const cleanup = (async () => {
        try {
          if (isRoom) {
            await broadcastToSession(sessionId!, { type: 'ROOM_PRESENCE_SYNC' });
          } else if (!sessionClients.get(sessionId!)?.has(userId!)) {
            await leaveParticipant({ sessionId: sessionId!, userId: userId! });
            await broadcastToSession(sessionId!, {
              type: 'participant_left',
              sessionId,
              userId,
              createdAt: new Date().toISOString()
            });
          }
        } catch {
          logger.warn('Realtime disconnect cleanup unavailable');
        }
      })();
      pendingDisconnects.add(cleanup);
      void cleanup.finally(() => pendingDisconnects.delete(cleanup));
    };
    ws.on('close', ws.cleanupRealtime);
    ws.on('error', () => {
      ws.cleanupRealtime?.();
      ws.terminate();
    });

    const authError = await authenticateWsRequest(req, userId);
    if (authError) {
      ws.close(4401, authError);
      return;
    }

    if (!sessionId) {
      ws.close(4001, 'sessionId or roomId required');
      return;
    }

    if (!(await verifySessionMembership(token, userId!, sessionId))) {
      ws.close(4403, 'Not a member of this session');
      return;
    }

    if (stopping || ws.readyState !== WebSocket.OPEN) return;
    ws.authRequest = req;
    ws.sessionId = sessionId;
    ws.userId = userId!;
    ws.isAlive = true;

    ws.realtimeRegistered = true;
    addRealtimeClient(sessionId, userId!, Object.assign(ws, { authRequest: req, userId: userId! }));
    if (isRoom) {
      void broadcastToSession(sessionId, { type: 'ROOM_PRESENCE_SYNC' });
    } else {
      await joinParticipant({ sessionId, userId: userId!, peerId: userId! });
      void broadcastToSession(sessionId, {
        type: 'participant_joined',
        sessionId,
        userId,
        createdAt: new Date().toISOString()
      });
    }

    // Send initial snapshot of room state if this is an active StudyRoom
    try {
      const roomDetails = await moduleClient.get<RoomSnapshot>(
        `${STUDY_SERVICE_URL}/api/v1/study/rooms/${sessionId}`,
        { headers: { Cookie: token }, timeout: 3000 }
      );
      if (
        roomDetails.data?.room &&
        ws.readyState === 1 &&
        !(await authenticateWsRequest(req, userId)) &&
        (await verifySessionMembership(req.headers.cookie, userId!, sessionId))
      ) {
        const r = roomDetails.data.room;
        const parts = roomDetails.data.participants || [];
        const publicSubmissionsCount = parts.filter((p) => p.hasSubmitted).length;
        await broadcastToSession(sessionId, {
          type: 'ROOM_STATE_SYNC',
          roomId: r.roomId,
          seq: r.seq,
          timestamp: new Date().toISOString(),
          presenterUserId: r.presenterUserId,
          activeActivityId: r.activeActivityId || null,
          courseId: r.courseId,
          revisionId: r.revisionId,
          activePin: r.activePin,
          activityRound: r.activityRound,
          currentPhase: r.currentPhase,
          participants: parts.map((p) => ({
            userId: p.userId,
            name: p.name,
            avatar: p.avatar,
            role: p.role,
            isOnline: p.isOnline,
            isSpeaking: !!p.isSpeaking,
            hasSubmitted: !!p.hasSubmitted
          })),
          publicSubmissionsCount
        });
      }
    } catch {
      // room snapshot lookup optional
    }

    ws.on('message', async (raw) => {
      const authError = await authenticateWsRequest(req, userId);
      if (authError || !(await verifySessionMembership(req.headers.cookie, userId!, sessionId))) {
        ws.cleanupRealtime?.();
        return ws.close(authError ? 4401 : 4403, 'Room authorization lost');
      }
      let payload: Record<string, unknown>;
      try {
        payload = messageObject(JSON.parse(raw.toString()));
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON payload' }));
        return;
      }

      if (
        typeof payload.type === 'string' &&
        payload.type.startsWith('voice_') &&
        !(await verifyVoiceConsent(req.headers.cookie, userId!, sessionId))
      ) {
        ws.send(
          JSON.stringify({ type: 'error', error: 'Explicit current microphone consent required' })
        );
        return;
      }
      const context = {
        userId: userId!,
        sessionId,
        broadcastToSession
      };

      try {
        if (payload.type === 'ROOM_ACTION' || payload.type === 'room_action') {
          if (payload.action === 'change_phase' && payload.currentPhase) {
            await moduleClient.put(
              `${STUDY_SERVICE_URL}/api/v1/study/rooms/${sessionId}/phase`,
              {
                currentPhase: payload.currentPhase,
                activeActivityId: payload.activeActivityId,
                ...(payload.commandId !== undefined
                  ? { commandId: payload.commandId, expectedSeq: payload.expectedSeq }
                  : {})
              },
              { headers: { Cookie: req.headers.cookie }, timeout: 5000 }
            );
          } else if (payload.action === 'change_presenter' && payload.presenterUserId) {
            await moduleClient.put(
              `${STUDY_SERVICE_URL}/api/v1/study/rooms/${sessionId}/presenter`,
              {
                presenterUserId: payload.presenterUserId,
                ...(payload.commandId !== undefined
                  ? { commandId: payload.commandId, expectedSeq: payload.expectedSeq }
                  : {})
              },
              { headers: { Cookie: req.headers.cookie }, timeout: 5000 }
            );
          } else if (payload.action === 'submit_flag') {
            await moduleClient.post(
              `${STUDY_SERVICE_URL}/api/v1/study/rooms/${sessionId}/submit-flag`,
              {},
              { headers: { Cookie: req.headers.cookie }, timeout: 5000 }
            );
          } else if (
            payload.action === 'ask_facilitator' ||
            payload.action === 'request_hint' ||
            payload.action === 'decline_prompt'
          ) {
            await moduleClient.post(
              `${STUDY_SERVICE_URL}/api/v1/study/rooms/${sessionId}/facilitator/action`,
              {
                actionType: payload.action,
                promptText: payload.promptText || payload.text || '',
                hintLevel: payload.hintLevel || 1,
                interventionId: payload.interventionId
              },
              { headers: { Cookie: req.headers.cookie }, timeout: 10000 }
            );
          }
          return;
        }

        if (payload.type === 'chat_query') {
          if (payload.query !== undefined && typeof payload.query !== 'string')
            throw new Error('Invalid query');
          await handleChatQuery({ ws, payload: { query: payload.query }, context });
          return;
        }

        if (payload.type === 'voice_signal') {
          await handleVoiceSignal({
            payload: normalizeSignalPayload({
              signalType: typeof payload.signalType === 'string' ? payload.signalType : undefined,
              targetUserId: typeof payload.targetUserId === 'string' ? payload.targetUserId : null,
              signal: payload.signal
            }),
            context
          });
          return;
        }

        if (payload.type === 'voice_mute') {
          await handleMuteState({ payload: { isMuted: payload.isMuted }, context });
          return;
        }

        if (payload.type === 'voice_speaking') {
          if (
            payload.speakingStatus !== undefined &&
            payload.speakingStatus !== 'silent' &&
            payload.speakingStatus !== 'speaking' &&
            payload.speakingStatus !== 'loud'
          )
            throw new Error('Invalid speaking status');
          await handleSpeakingState({
            payload: { speakingStatus: payload.speakingStatus },
            context
          });
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: errorDetails(err).message }));
      }
    });
  });

  const heartbeatInterval = setInterval(() => {
    const allSockets = [...wssNotifications.clients, ...wssRealtime.clients];
    allSockets.forEach(async (ws: ManagedSocket) => {
      // Authorization in progress is not a registered connection. Never overlap checks.
      if (!ws.authRequest || ws.readyState !== WebSocket.OPEN) return;
      if (!ws.isAlive) {
        ws.cleanupRealtime?.();
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
      if (ws.checking) return;
      ws.checking = true;
      try {
        const authError = await authenticateWsRequest(ws.authRequest, ws.userId || null);
        if (
          authError ||
          (ws.sessionId &&
            !(await verifySessionMembership(
              ws.authRequest.headers.cookie,
              ws.userId!,
              ws.sessionId
            )))
        ) {
          ws.cleanupRealtime?.();
          ws.close(authError ? 4401 : 4403, 'Room authorization lost');
        }
      } finally {
        ws.checking = false;
      }
    });
  }, options.heartbeatMs ?? 30000);

  wssNotifications.on('close', () => clearInterval(heartbeatInterval));
  wssRealtime.on('close', () => clearInterval(heartbeatInterval));

  return async () => {
    stopping = true;
    clearInterval(heartbeatInterval);
    for (const ws of [...wssNotifications.clients, ...wssRealtime.clients]) ws.terminate();
    await Promise.all(
      [wssNotifications, wssRealtime].map((wss) => new Promise((resolve) => wss.close(resolve)))
    );
    await Promise.allSettled(pendingDisconnects);
    await Promise.allSettled(deliveries.values());
    clients.clear();
    sessionClients.clear();
  };
}
