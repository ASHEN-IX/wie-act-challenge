import type { Request, Response, NextFunction, Router } from 'express';
import type { DomainRequest } from '../src/framework/contracts';

export type ContractHandler = (req: DomainRequest, res: Response, next: NextFunction) => unknown;
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
type HandlerInput = ContractHandler | ContractHandler[];

export interface ContractOperation {
  method: HttpMethod;
  path: string;
  handlers: ContractHandler[];
  [key: string]: unknown;
}

export interface ContractMiddlewareEntry {
  path: string;
  handlers: ContractHandler[];
}

export interface DomainContractRouter {
  (req: Request, res: Response, next: NextFunction): unknown;
  operations: ContractOperation[];
  middleware: ContractMiddlewareEntry[];
  use: (
    path: string | ContractHandler | DomainContractRouter,
    ...handlers: Array<HandlerInput | DomainContractRouter>
  ) => DomainContractRouter;
  get: (path: string, ...handlers: HandlerInput[]) => DomainContractRouter;
  post: (path: string, ...handlers: HandlerInput[]) => DomainContractRouter;
  put: (path: string, ...handlers: HandlerInput[]) => DomainContractRouter;
  patch: (path: string, ...handlers: HandlerInput[]) => DomainContractRouter;
  delete: (path: string, ...handlers: HandlerInput[]) => DomainContractRouter;
  head: (path: string, ...handlers: HandlerInput[]) => DomainContractRouter;
  options: (path: string, ...handlers: HandlerInput[]) => DomainContractRouter;
}

/** Declarative domain operations. Nest owns production HTTP routing.
 * The lazy Express adapter exists for retained contract tests during incremental migration.
 */
export function createContracts(): DomainContractRouter {
  const operations: ContractOperation[] = [];
  const middleware: ContractMiddlewareEntry[] = [];
  let testRouter: Router | undefined;

  const contracts = function (req: Request, res: Response, next: NextFunction) {
    if (!testRouter) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const express: typeof import('express') = require('express');
      testRouter = express.Router();
      for (const entry of middleware) testRouter.use(entry.path, ...entry.handlers);
      for (const entry of operations) testRouter[entry.method](entry.path, ...entry.handlers);
    }
    return testRouter(req, res, next);
  } as DomainContractRouter;

  contracts.operations = operations;
  contracts.middleware = middleware;
  contracts.use = (path, ...handlers) => {
    if (typeof path !== 'string') {
      handlers.unshift(path);
      path = '/';
    }
    for (const handler of handlers.flat()) {
      if (handler && 'operations' in handler) {
        const join = (child: string) =>
          (path.replace(/\/$/, '') + '/' + child.replace(/^\//, '')).replace(/\/$/, '') || '/';
        for (const operation of handler.operations)
          operations.push({
            ...operation,
            path: join(operation.path),
            handlers: [
              ...handler.middleware.flatMap((entry: ContractMiddlewareEntry) => entry.handlers),
              ...operation.handlers
            ]
          });
      } else middleware.push({ path, handlers: [handler] });
    }
    return contracts;
  };
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
    contracts[method] = (path: string, ...handlers: HandlerInput[]) => {
      operations.push({ method, path, handlers: handlers.flat() });
      return contracts;
    };
  }
  return contracts;
}

export function executeHandlers(
  handlers: ContractHandler[],
  req: Request,
  res: Response
): Promise<void> {
  return new Promise((resolve, reject) => {
    let index = 0;
    const finish = () => {
      res.removeListener('finish', finish);
      resolve();
    };
    res.once('finish', finish);
    const next = (error?: unknown) => {
      if (error) {
        res.removeListener('finish', finish);
        reject(error);
        return;
      }
      const handler = handlers[index++];
      if (!handler) {
        res.removeListener('finish', finish);
        resolve();
        return;
      }
      try {
        Promise.resolve(handler(req, res, next)).catch(next);
      } catch (failure) {
        next(failure);
      }
    };
    next();
  });
}

module.exports = { createContracts, executeHandlers };
