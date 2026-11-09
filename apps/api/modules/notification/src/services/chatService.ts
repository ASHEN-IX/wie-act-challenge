interface SearchSource {
  title?: string;
  source?: string;
  snippet?: string;
  content?: string;
  url?: string;
  relevance_score?: number;
  relevanceScore?: number;
}
interface SearchResponse {
  answer?: string;
  response?: string;
  summary?: string;
  sources?: SearchSource[];
  results?: SearchSource[];
}
import moduleClient from '@ednova/shared/moduleClient';
import { getBaseUrl } from '@ednova/shared/aiClient';
import SessionChat, { ISessionChat } from '../models/SessionChat';

const AI_SERVICE_URL = getBaseUrl();

export interface StoreQueryMessageArgs {
  sessionId: string;
  userId: string;
  query: string;
}

export async function storeQueryMessage({
  sessionId,
  userId,
  query
}: StoreQueryMessageArgs): Promise<ISessionChat> {
  return SessionChat.create({
    sessionId,
    userId,
    messageType: 'query',
    content: query,
    searchQuery: query
  });
}

export interface StoreResultMessageArgs {
  sessionId: string;
  userId: string;
  query: string;
  answer?: string;
  results?: SearchSource[];
}

export async function storeResultMessage({
  sessionId,
  userId,
  query,
  answer,
  results
}: StoreResultMessageArgs): Promise<ISessionChat> {
  const normalizedResults = (results || []).slice(0, 10).map((item) => ({
    title: item.title || item.source || 'Result',
    snippet: item.snippet || item.content || '',
    source: item.source || item.url || 'web',
    url: item.url || '',
    relevanceScore: Number(item.relevance_score || item.relevanceScore || 0)
  }));

  return SessionChat.create({
    sessionId,
    userId,
    messageType: 'result',
    content: answer || 'No answer returned.',
    searchQuery: query,
    searchResults: normalizedResults
  });
}

export interface RunSearchArgs {
  question: string;
  userId: string;
  sessionId: string;
}

export async function runSearch({
  question,
  userId,
  sessionId
}: RunSearchArgs): Promise<SearchResponse> {
  const response: { data: SearchResponse } = await moduleClient.post(
    `${AI_SERVICE_URL}/api/ai/search/ask`,
    {
      question,
      user_id: userId,
      session_id: sessionId
    },
    { timeout: 120000 }
  );

  return response.data;
}

export interface ProcessSearchQueryArgs {
  sessionId: string;
  userId: string;
  query: string;
}

export async function processSearchQuery({ sessionId, userId, query }: ProcessSearchQueryArgs) {
  await storeQueryMessage({ sessionId, userId, query });

  const aiResult = await runSearch({ question: query, userId, sessionId });
  const answer = aiResult.answer || aiResult.response || aiResult.summary || '';
  const sources = aiResult.sources || aiResult.results || [];

  const stored = await storeResultMessage({
    sessionId,
    userId,
    query,
    answer,
    results: sources
  });

  return {
    messageId: stored._id,
    sessionId,
    userId,
    question: query,
    answer: stored.content,
    results: stored.searchResults,
    createdAt: stored.createdAt
  };
}

export interface GetHistoryArgs {
  sessionId: string;
  limit?: number;
  offset?: number;
}

export async function getHistory({ sessionId, limit = 50, offset = 0 }: GetHistoryArgs) {
  const items = await SessionChat.findMany(
    { sessionId, messageType: { not: 'peer_stream' } },
    { createdAt: 'desc' },
    { skip: offset, take: limit }
  );
  return items;
}

export interface DeleteMessageArgs {
  sessionId: string;
  messageId: string;
  userId: string;
}

export async function deleteMessage({
  sessionId,
  messageId,
  userId
}: DeleteMessageArgs): Promise<{ deleted: boolean; reason?: string }> {
  const message = await SessionChat.findOne({ id: messageId, sessionId });
  if (!message) return { deleted: false, reason: 'not_found' };
  if (message.messageType === 'peer_stream' || String(message.userId) !== String(userId)) {
    return { deleted: false, reason: 'forbidden' };
  }
  await SessionChat.deleteOne({ id: messageId });
  return { deleted: true };
}
