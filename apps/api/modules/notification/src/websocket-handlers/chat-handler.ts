import type { WebSocket } from 'ws';
import { errorDetails } from '@noveris/shared/errors';
import { processSearchQuery } from '../services/chatService';

export interface ChatHandlerContext {
  userId: string;
  sessionId: string;
  broadcastToSession: (sessionId: string, payload: Record<string, unknown>) => Promise<void> | void;
}

export interface HandleChatQueryArgs {
  ws: Pick<WebSocket, 'send'>;
  payload: { query?: string };
  context: ChatHandlerContext;
}

export async function handleChatQuery({
  ws,
  payload,
  context
}: HandleChatQueryArgs): Promise<void> {
  const query = (payload?.query || '').trim();
  if (!query) {
    ws.send(JSON.stringify({ type: 'chat_error', error: 'Query is required' }));
    return;
  }

  const { userId, sessionId, broadcastToSession } = context;

  broadcastToSession(sessionId, {
    type: 'chat_query',
    sessionId,
    userId,
    query,
    createdAt: new Date().toISOString()
  });

  try {
    const result = await processSearchQuery({
      sessionId,
      userId,
      query
    });

    broadcastToSession(sessionId, {
      type: 'chat_result',
      ...result
    });
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'chat_error',
        error: 'Search request failed',
        details: errorDetails(err).message
      })
    );
  }
}
