import type { Request, Response, NextFunction } from 'express';

export interface ContractOperation {
  method: string;
  path: string;
  handlers: Array<(req: Request, res: Response, next: NextFunction) => any>;
  [key: string]: unknown;
}

export interface ContractMiddlewareEntry {
  path: string;
  handlers: Array<(req: Request, res: Response, next: NextFunction) => any>;
}

export interface DomainContractRouter {
  (req: Request, res: Response, next: NextFunction): any;
  operations: ContractOperation[];
  middleware: ContractMiddlewareEntry[];
  use: (path: string | any, ...handlers: any[]) => DomainContractRouter;
  get: (path: string, ...handlers: any[]) => DomainContractRouter;
  post: (path: string, ...handlers: any[]) => DomainContractRouter;
  put: (path: string, ...handlers: any[]) => DomainContractRouter;
  patch: (path: string, ...handlers: any[]) => DomainContractRouter;
  delete: (path: string, ...handlers: any[]) => DomainContractRouter;
  head: (path: string, ...handlers: any[]) => DomainContractRouter;
  options: (path: string, ...handlers: any[]) => DomainContractRouter;
}

/** Declarative domain operations. Nest owns production HTTP routing.
 * The lazy Express adapter exists for retained contract tests during incremental migration.
 */
export function createContracts(): DomainContractRouter {
  const operations: ContractOperation[] = [];
  const middleware: ContractMiddlewareEntry[] = [];
  let testRouter: any;

  const contracts = function (req: Request, res: Response, next: NextFunction) {
    if (!testRouter) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      testRouter = require('express').Router();
      for (const entry of middleware) testRouter.use(entry.path, ...entry.handlers);
      for (const entry of operations) testRouter[entry.method](entry.path, ...entry.handlers);
    }
    return testRouter(req, res, next);
  } as DomainContractRouter;

  contracts.operations = operations;
  contracts.middleware = middleware;
  contracts.use = (path: string | any, ...handlers: any[]) => {
    if (typeof path !== 'string') {
      handlers.unshift(path);
      path = '/';
    }
    for (const handler of handlers.flat()) {
      if (handler && handler.operations) {
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
    contracts[method] = (path: string, ...handlers: any[]) => {
      operations.push({ method, path, handlers: handlers.flat() });
      return contracts;
    };
  }
  return contracts;
}

export function executeHandlers(
  handlers: Array<(req: Request, res: Response, next: NextFunction) => any>,
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
