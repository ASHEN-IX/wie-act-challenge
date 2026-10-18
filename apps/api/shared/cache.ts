export interface CacheClient {
  isEnabled: boolean;
  get: (key: string) => Promise<string | null>;
  setex: (key: string, ttlSeconds: number, value: string) => Promise<boolean>;
  del: (...keys: string[]) => Promise<number>;
  disconnect?: () => void;
}

let redisClient: CacheClient | null = null;
let redisUnavailable = false;
let retryAfter = 0;

const REDIS_URL = process.env.REDIS_URL || '';

export const createNoopClient = (): CacheClient => ({
  isEnabled: false,
  async get() {
    return null;
  },
  async setex() {
    return false;
  },
  async del() {
    return 0;
  }
});

export const getCacheClient = (): CacheClient => {
  if (!REDIS_URL || (redisUnavailable && Date.now() < retryAfter)) {
    return createNoopClient();
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    // Lazy require allows services to run without redis package when cache is disabled.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis');
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true
    });

    client.on('error', () => {
      redisUnavailable = true;
      retryAfter = Date.now() + 5000;
    });
    client.on('ready', () => {
      redisUnavailable = false;
      retryAfter = 0;
    });

    const safely = async <T>(fn: () => Promise<T>): Promise<T | null> => {
      if (redisUnavailable && Date.now() < retryAfter) return null;
      try {
        if (client.status !== 'ready' && client.status !== 'connecting') {
          try {
            await client.connect();
          } catch {
            /* will throw below */
          }
        }
        return await fn();
      } catch {
        redisUnavailable = true;
        retryAfter = Date.now() + 5000;
        redisClient = null;
        client.disconnect();
        return null;
      }
    };

    redisClient = {
      isEnabled: true,
      disconnect: () => client.disconnect(),
      async get(key: string): Promise<string | null> {
        const result = (await safely(() => client.get(key))) as string | null;
        return result;
      },
      async setex(key: string, ttlSeconds: number, value: string) {
        const result = await safely(() => client.set(key, value, 'EX', ttlSeconds));
        return result !== null;
      },
      async del(...keys: string[]) {
        if (!keys.length) return 0;
        const result = await safely(() => client.del(...keys));
        return typeof result === 'number' ? result : 0;
      }
    };

    return redisClient!;
  } catch {
    redisUnavailable = true;
    retryAfter = Date.now() + 5000;
    return createNoopClient();
  }
};

export async function closeCache(): Promise<void> {
  if (redisClient && redisClient.disconnect) redisClient.disconnect();
  redisClient = null;
  redisUnavailable = false;
  retryAfter = 0;
}

module.exports = { getCacheClient, closeCache };
