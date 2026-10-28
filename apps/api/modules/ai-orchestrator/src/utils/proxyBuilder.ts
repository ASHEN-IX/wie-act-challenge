import { canReadCourse } from '../../../study/src/services/resourceAccess';
import moduleClient from '@study-partner/shared/moduleClient';
import { logger } from '@study-partner/shared';
import type { Response, NextFunction } from 'express';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { ContractHandler } from '@study-partner/shared/domainContracts';
import type { Schema } from 'joi';
import type { AxiosRequestConfig } from 'axios';
import type { ModuleResponse } from '@study-partner/shared/moduleClient';
import { errorDetails } from '@study-partner/shared/errors';

export const requireOwnedUser = (req: DomainRequest, res: Response, next: NextFunction) => {
  const targetUserId = req.params.userId;
  if (String(req.user?.userId) === String(targetUserId)) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden: cannot access another user's data" });
};

export interface ProxyOptions {
  method?: 'GET' | 'DELETE' | 'POST' | 'PUT' | 'PATCH';
  path: string | ((req: DomainRequest) => string);
  targetUrl: string;
  timeout?: number;
  schema?: Schema;
  tier?: string[];
  requireOwnership?: boolean;
  userIdField?: string | boolean;
  forwardQuery?: boolean;
  forwardAuth?: boolean;
  mapBody?: (req: DomainRequest, body?: unknown) => unknown;
  mapResponse?: (data: unknown, req: DomainRequest) => unknown;
  validateBody?: (body: unknown) => string | void;
}

export function createProxy(options: ProxyOptions): ContractHandler[] {
  const {
    method = 'POST',
    path,
    targetUrl,
    timeout = 30000,
    schema,
    tier,
    requireOwnership = false,
    userIdField = false,
    forwardQuery = false,
    forwardAuth = false,
    mapBody,
    mapResponse,
    validateBody
  } = options;

  const middlewares: ContractHandler[] = [];
  if (tier) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tierGate } = require('@study-partner/shared/tierGate');
    middlewares.push(tierGate(...tier));
  }
  if (requireOwnership) {
    middlewares.push(requireOwnedUser);
  }

  const handler = async (req: DomainRequest, res: Response) => {
    const targetPath = typeof path === 'function' ? path(req) : path;
    const url = `${targetUrl}${targetPath}`;
    try {
      let validatedBody: unknown = req.body;
      if (schema) {
        const { error, value } = schema.validate(req.body || {});
        if (error) {
          return res.status(400).json({ error: error.details[0].message });
        }
        validatedBody = value;
      }

      let body: unknown;
      if (mapBody) {
        body = await mapBody(req, validatedBody);
      } else if (userIdField) {
        body = {
          ...(validatedBody && typeof validatedBody === 'object' ? validatedBody : {}),
          [userIdField as string]: req.user?.userId
        };
      } else {
        body = validatedBody;
      }

      if (validateBody) {
        const msg = validateBody(body);
        if (msg) return res.status(400).json({ error: msg });
      }

      const config: AxiosRequestConfig = { timeout };
      if (forwardQuery) config.params = req.query;
      if (forwardAuth) config.headers = { Cookie: req.headers.cookie };

      const httpMethod = method.toUpperCase();
      let response: ModuleResponse;
      switch (httpMethod) {
        case 'GET':
          response = await moduleClient.get(url, config);
          break;
        case 'DELETE':
          response = await moduleClient.delete(url, config);
          break;
        case 'POST':
          response = await moduleClient.post(url, body, config);
          break;
        case 'PUT':
          response = await moduleClient.put(url, body, config);
          break;
        case 'PATCH':
          response = await moduleClient.patch(url, body, config);
          break;
        default:
          throw new Error('Unsupported proxy method');
      }

      const courseId =
        res.locals.sourceCourseId ||
        req.params.courseId ||
        req.body?.courseId ||
        req.body?.course_id;
      if (courseId && !(await canReadCourse(req.user!.userId, courseId)))
        return res.status(404).json({ error: 'Resource not found' });
      if (mapResponse) {
        return res.json(mapResponse(response.data, req));
      }
      return res.json(response.data);
    } catch (err) {
      // SEC-08: never leak upstream status bodies, stack traces, or internal
      // error details to the client. Log the full error server-side and return
      // generic statuses only.
      try {
        logger.error('AI proxy upstream error', {
          method: req.method,
          url: `${targetUrl}${targetPath}`,
          upstreamStatus: errorDetails(err).status,
          errorCode: errorDetails(err).code || 'AI_UPSTREAM_ERROR'
        });
      } catch {
        // Logging must never break the request path.
      }

      if (err && typeof err === 'object' && 'response' in err && err.response) {
        return res.status(502).json({ error: 'Upstream service error' });
      }
      if (err && typeof err === 'object' && 'request' in err && err.request) {
        return res.status(503).json({ error: 'AI service unavailable' });
      }
      return res.status(500).json({ error: 'Request failed' });
    }
  };

  return [...middlewares, handler];
}

export default { createProxy, requireOwnedUser };
module.exports = { createProxy, requireOwnedUser };
