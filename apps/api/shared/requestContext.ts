import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestStore {
  cookie?: string;
  [key: string]: unknown;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();
module.exports = { requestContext };
