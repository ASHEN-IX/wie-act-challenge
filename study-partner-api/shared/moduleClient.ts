/** In-process calls to validated public module contracts. No sockets or service URLs. */
import { Readable } from 'stream';
import { ServerResponse, IncomingMessage } from 'http';

const modules = new Map<string, any>();

export function registerModule(name: string, app: any): void {
  if (modules.has(name) && modules.get(name) !== app)
    throw new Error(`Module already registered: ${name}`);
  modules.set(name, app);
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

export function registerDomainContracts(definitions: any[]): void {
  for (const definition of definitions) {
    const operations = definition.operations.map((operation: any) => ({
      ...operation,
      ...compilePath(operation.path)
    }));
    modules.set(definition.name, { operations });
  }
}

export function request(
  method: string,
  address: string,
  body?: any,
  config: any = {}
): Promise<any> {
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
    const req: any = new Readable({
      read() {
        this.push(null);
      }
    });
    req[Symbol.for('mindflow.moduleCall')] = true;
    req.method = method.toUpperCase();
    req.url = url.pathname + url.search;
    req.headers = Object.fromEntries(
      Object.entries(config.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const context = require('./requestContext').requestContext.getStore();
    if (!req.headers.cookie && context?.cookie) req.headers.cookie = context.cookie;
    req.body = body || {};
    req._body = true;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;
    const res: any = new ServerResponse(req as IncomingMessage);
    const chunks: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(
      () => finish(new Error('Module call timed out')),
      config.timeout || 30000
    );
    timer.unref();
    function finish(error?: any, result?: any) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    }
    res.write = (chunk: any) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };
    res.end = (chunk: any) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      let data: any = Buffer.concat(chunks).toString();
      try {
        data = JSON.parse(data);
      } catch {
        /* A public contract may return text. */
      }
      const result = { status: res.statusCode, data, headers: res.getHeaders() };
      res.emit('finish');
      if (res.statusCode >= 400) {
        const error: any = new Error(data?.error || `Module call failed (${res.statusCode})`);
        error.response = result;
        finish(error);
      } else finish(null, result);
      return res;
    };
    if (app.operations) {
      const operation = app.operations.find(
        (entry: any) =>
          entry.method.toUpperCase() === req.method && entry.matcher.test(url.pathname)
      );
      if (!operation) return finish(new Error('Module contract not found'));
      const match = operation.matcher.exec(url.pathname);
      req.params = Object.fromEntries(
        operation.names.map((name: string, index: number) => [
          name,
          decodeURIComponent(match[index + 1])
        ])
      );
      req.query = Object.fromEntries(url.searchParams);
      req.path = url.pathname;
      req.originalUrl = req.url;
      req.get = (name: string) => req.headers[name.toLowerCase()];
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data: any) => {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      };
      res.send = (data: any) => (typeof data === 'object' ? res.json(data) : res.end(String(data)));
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
    app.handle(req, res, (error: any) => {
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
  get: (url: string, config?: any) => request('GET', url, null, config),
  delete: (url: string, config?: any) => request('DELETE', url, null, config),
  post: (url: string, body?: any, config?: any) => request('POST', url, body, config),
  put: (url: string, body?: any, config?: any) => request('PUT', url, body, config),
  patch: (url: string, body?: any, config?: any) => request('PATCH', url, body, config)
};

export default moduleClient;
module.exports = moduleClient;
