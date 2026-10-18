import { processSearchQuery } from '../services/chatService';

export interface ChatHandlerContext {
  userId: string;
  sessionId: string;
  broadcastToSession: (sessionId: string, payload: any) => Promise<void> | void;
}

export interface HandleChatQueryArgs {
  ws: any;
  payload: any;
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
      sessionId,
      userId,
      ...result
    });
  } catch (err: any) {
    ws.send(
      JSON.stringify({
        type: 'chat_error',
        error: 'Search request failed',
        details: err.message
      })
    );
  }
}
