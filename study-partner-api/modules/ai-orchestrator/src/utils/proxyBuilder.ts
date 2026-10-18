import moduleClient from '@study-partner/shared/moduleClient';
import { logger } from '@study-partner/shared';
import { Request, Response, NextFunction } from 'express';

export const requireOwnedUser = (req: Request, res: Response, next: NextFunction): any => {
  const targetUserId = req.params.userId;
  const isAdmin = (req as any).user?.role === 'admin' || (req as any).user?.isAdmin === true;
  if (String((req as any).user?.userId) === String(targetUserId) || isAdmin) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden: cannot access another user's data" });
};

export interface ProxyOptions {
  method?: string;
  path: string | ((req: Request) => string);
  targetUrl: string;
  timeout?: number;
  schema?: any;
  tier?: string[];
  requireOwnership?: boolean;
  userIdField?: string | boolean;
  forwardQuery?: boolean;
  forwardAuth?: boolean;
  mapBody?: (req: Request, body?: any) => any;
  mapResponse?: (data: any, req: Request) => any;
  validateBody?: (body: any) => string | void;
}

export function createProxy(options: ProxyOptions): any[] {
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

  const middlewares: any[] = [];
  if (tier) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tierGate } = require('@study-partner/shared/tierGate');
    middlewares.push(tierGate(...tier));
  }
  if (requireOwnership) {
    middlewares.push(requireOwnedUser);
  }

  const handler = async (req: Request, res: Response): Promise<any> => {
    const targetPath = typeof path === 'function' ? path(req) : path;
    const url = `${targetUrl}${targetPath}`;
    try {
      let validatedBody = req.body;
      if (schema) {
        const { error, value } = schema.validate(req.body || {});
        if (error) {
          return res.status(400).json({ error: error.details[0].message });
        }
        validatedBody = value;
      }

      let body: any;
      if (mapBody) {
        body = mapBody(req, validatedBody);
      } else if (userIdField) {
        body = { ...validatedBody, [userIdField as string]: (req as any).user?.userId };
      } else {
        body = validatedBody;
      }

      if (validateBody) {
        const msg = validateBody(body);
        if (msg) return res.status(400).json({ error: msg });
      }

      const config: any = { timeout };
      if (forwardQuery) config.params = req.query;
      if (forwardAuth) config.headers = { Cookie: req.headers.cookie };

      const httpMethod = method.toUpperCase();
      let response: any;
      if (httpMethod === 'GET' || httpMethod === 'DELETE') {
        response = await (moduleClient as any)[httpMethod.toLowerCase()](url, config);
      } else {
        response = await (moduleClient as any)[httpMethod.toLowerCase()](url, body, config);
      }

      if (mapResponse) {
        return res.json(mapResponse(response.data, req));
      }
      return res.json(response.data);
    } catch (err: any) {
      // SEC-08: never leak upstream status bodies, stack traces, or internal
      // error details to the client. Log the full error server-side and return
      // generic statuses only.
      try {
        logger.error('AI proxy upstream error', {
          method: req.method,
          url: `${targetUrl}${targetPath}`,
          upstreamStatus: err.response?.status,
          errorCode: err.code || 'AI_UPSTREAM_ERROR'
        });
      } catch (_) {
        // Logging must never break the request path.
      }

      if (err.response) {
        return res.status(502).json({ error: 'Upstream service error' });
      }
      if (err.request) {
        return res.status(503).json({ error: 'AI service unavailable' });
      }
      return res.status(500).json({ error: 'Request failed' });
    }
  };

  return [...middlewares, handler];
}

export default { createProxy, requireOwnedUser };
module.exports = { createProxy, requireOwnedUser };
