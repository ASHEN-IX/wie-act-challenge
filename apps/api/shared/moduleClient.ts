/** In-process calls to validated public module contracts. No network listener or service hops. */
import { Socket } from 'node:net';
import express, { Response } from 'express';
import type { DomainRequest, DomainDefinition, DomainOperation } from '../src/framework/contracts';
import type { AxiosRequestConfig } from 'axios';
import { requestContext } from './requestContext';
import { ServerResponse, IncomingMessage } from 'http';

/**
 * Re-exported so domain modules can describe this transport's request/response
 * types without declaring a direct `axios` dependency of their own.
 */
export type { AxiosRequestConfig, AxiosResponse } from 'axios';

interface CompiledOperation extends DomainOperation, CompiledPath {}
interface ContractModule {
  operations: CompiledOperation[];
}
interface LegacyModule {
  source: unknown;
  handle(req: DomainRequest, res: Response, next: (error?: unknown) => void): unknown;
}
const modules = new Map<string, ContractModule | LegacyModule>();
export interface ModuleResponse<T = unknown> {
  status: number;
  data: T;
  headers: ReturnType<Response['getHeaders']>;
}

export function registerModule(name: string, app: unknown): void {
  const current = modules.get(name);
  if (current && (!('source' in current) || current.source !== app))
    throw new Error(`Module already registered: ${name}`);
  if (!app || (typeof app !== 'object' && typeof app !== 'function'))
    throw new TypeError('Expected an Express application');
  const handle: unknown = Reflect.get(app, 'handle');
  if (typeof handle !== 'function') throw new TypeError('Expected Express application.handle');
  modules.set(name, {
    source: app,
    handle: (req, res, next) => Reflect.apply(handle, app, [req, res, next])
  });
}

export interface CompiledPath {
  matcher: RegExp;
  names: string[];
}

function compilePath(path: string): CompiledPath {
  const names: string[] = [];
  const expression = path.replace(/:(\w+)(?:\(([^)]+)\))?/g, (_match, name, pattern) => {
    names.push(name);
    return '(' + (pattern || '[^/]+') + ')';
  });
  return { matcher: new RegExp('^' + expression + '/?$'), names };
}

export function registerDomainContracts(definitions: DomainDefinition[]): void {
  for (const definition of definitions) {
    const operations = definition.operations.map((operation) => ({
      ...operation,
      ...compilePath(operation.path)
    }));
    modules.set(definition.name, { operations });
  }
}

export function request<T = unknown>(
  method: 'GET' | 'DELETE' | 'POST' | 'PUT' | 'PATCH',
  address: string,
  body?: unknown,
  config: AxiosRequestConfig = {}
): Promise<ModuleResponse<T>> {
  const url = new URL(address);
  if (url.protocol !== 'module:') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./aiClient').request(method, address, body, config);
  }
  const app = modules.get(url.hostname);
  if (!app) return Promise.reject(new Error(`Module not registered: ${url.hostname}`));
  for (const [key, value] of Object.entries(config.params || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return new Promise((resolve, reject) => {
    // Express request methods are attached by the legacy app or explicitly below.
    // The underlying transport is an actual, unconnected Node HTTP message.
    const socket = new Socket();
    Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
    const req = new IncomingMessage(socket) as DomainRequest & { _body: boolean };
    req._read = () => req.push(null);
    Reflect.set(req, Symbol.for('ednova.moduleCall'), true);
    req.method = method.toUpperCase();
    req.url = url.pathname + url.search;
    req.headers = Object.fromEntries(
      Object.entries(config.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const context = requestContext.getStore();
    if (!req.headers.cookie && context?.cookie) req.headers.cookie = context.cookie;
    req.body = body || {};
    req._body = true;
    const res: Response = Object.setPrototypeOf(new ServerResponse(req), express.response);
    const chunks: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(
      () => finish(new Error('Module call timed out')),
      config.timeout || 30000
    );
    timer.unref();
    function finish(error?: unknown, result?: ModuleResponse<T>) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else if (result) resolve(result);
    }
    res.write = (chunk: unknown) => {
      if (chunk) {
        if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array))
          throw new TypeError('Unsupported module response chunk');
        chunks.push(Buffer.from(chunk));
      }
      return true;
    };
    res.end = (chunk: unknown) => {
      if (chunk) {
        if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array))
          throw new TypeError('Unsupported module response chunk');
        chunks.push(Buffer.from(chunk));
      }
      let data: unknown = Buffer.concat(chunks).toString();
      try {
        data = JSON.parse(String(data));
      } catch {
        /* A public contract may return text. */
      }
      const result = { status: res.statusCode, data: data as T, headers: res.getHeaders() };
      res.emit('finish');
      if (res.statusCode >= 400) {
        const message =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Module call failed (${res.statusCode})`;
        const error = Object.assign(new Error(message), { response: result });
        finish(error);
      } else finish(null, result);
      return res;
    };
    if ('operations' in app) {
      const operation = app.operations.find(
        (entry) => entry.method.toUpperCase() === req.method && entry.matcher.test(url.pathname)
      );
      if (!operation) return finish(new Error('Module contract not found'));
      const match = operation.matcher.exec(url.pathname);
      req.params = Object.fromEntries(
        operation.names.map((name: string, index: number) => [
          name,
          decodeURIComponent(match![index + 1])
        ])
      );
      req.query = Object.fromEntries(url.searchParams);
      Object.assign(req, { path: url.pathname });
      req.originalUrl = req.url;
      req.get = express.request.get;
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data: unknown) => {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      };
      res.send = (data: unknown) =>
        typeof data === 'object' ? res.json(data) : res.end(String(data));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { authenticate } = require('./auth');
      const handlers = [
        authenticate,
        require('./operationPolicy').operationPolicy,
        ...operation.handlers
      ];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./domainContracts').executeHandlers(handlers, req, res).catch(finish);
      return;
    }
    app.handle(req, res, (error: unknown) => {
      if (error) return finish(error);
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Module contract not found' }));
    });
  });
}

const moduleClient = {
  registerModule,
  registerDomainContracts,
  request,
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    request<T>('GET', url, null, config),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    request<T>('DELETE', url, null, config),
  post: <T = unknown>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>('POST', url, body, config),
  put: <T = unknown>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>('PUT', url, body, config),
  patch: <T = unknown>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>('PATCH', url, body, config)
};

export default moduleClient;
module.exports = moduleClient;
