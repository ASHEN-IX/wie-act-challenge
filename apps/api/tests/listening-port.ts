import assert from 'node:assert/strict';
import type { Server } from 'node:http';

/** Assert that a test runtime actually bound a TCP port before using its address. */
export function listeningPort(server: Server): number {
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'Expected a listening TCP server');
  return address.port;
}
