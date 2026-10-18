import type { Request, Response, NextFunction, RequestHandler } from 'express';
export interface DomainIdentity {
  userId: string;
  role: string;
  [key: string]: unknown;
}
export interface DomainRequest extends Request {
  user?: DomainIdentity;
  auth?: { identity: DomainIdentity; [key: string]: unknown };
  requestId?: string;
}
export interface DomainOperation {
  method: string;
  path: string;
  handlers: RequestHandler[];
}
export interface DomainDefinition {
  name: string;
  directory: string;
  operations: DomainOperation[];
}
export interface DomainExecutor {
  execute(operation: string, request: DomainRequest, response: Response): Promise<void>;
}
export type DomainMiddleware = (
  request: DomainRequest,
  response: Response,
  next: NextFunction
) => unknown;

export interface CreateTaskDto {
  title: string;
  description?: string;
  topicId?: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedTime?: number;
  dueDate?: string;
  tags?: string[];
}
export interface ApiErrorResponse {
  error: string;
  requestId?: string;
  code?: string;
}
export interface ApiHealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
  db?: string;
}
export interface ApplicationConfiguration {
  port: number;
  trustedOrigins: string[];
  mongoUri: string;
  environment: string;
}
