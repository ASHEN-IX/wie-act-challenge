"""Recoverable processing leases, separate from durable completion markers."""
from __future__ import annotations
import os
import time
import secrets
from typing import Protocol

class IdempotencyStore(Protocol):
    async def claim(self, message_id: str) -> bool: ...
    async def completed(self, message_id: str) -> bool: ...
    async def complete(self, message_id: str) -> None: ...
    async def release(self, message_id: str) -> None: ...
    async def renew(self, message_id: str) -> None: ...

class InMemoryIdempotencyStore:
    def __init__(self, ttl_seconds: int = 86400, lease_seconds: int = 120) -> None:
        self._ttl, self._lease = ttl_seconds, lease_seconds
        self._seen: dict[str, tuple[float, bool]] = {}

    async def claim(self, message_id: str) -> bool:
        now = time.monotonic()
        self._seen = {k: v for k, v in self._seen.items() if v[0] > now}
        if message_id in self._seen:
            return False
        self._seen[message_id] = (now + self._lease, False)
        return True

    async def completed(self, message_id: str) -> bool:
        item = self._seen.get(message_id)
        return bool(item and item[0] > time.monotonic() and item[1])

    async def complete(self, message_id: str) -> None:
        self._seen[message_id] = (time.monotonic() + self._ttl, True)

    async def release(self, message_id: str) -> None:
        if not await self.completed(message_id):
            self._seen.pop(message_id, None)

    async def renew(self, message_id: str) -> None:
        if message_id in self._seen and not await self.completed(message_id):
            self._seen[message_id] = (time.monotonic() + self._lease, False)

class RedisIdempotencyStore:
    def __init__(self, redis_client, ttl_seconds: int = 86400, prefix: str = "ai:idem:", lease_seconds: int = 120) -> None:
        self._redis, self._ttl, self._prefix, self._lease = redis_client, ttl_seconds, prefix, lease_seconds
        self._owners: dict[str, str] = {}

    async def claim(self, message_id: str) -> bool:
        token = secrets.token_hex(16)
        claimed = bool(await self._redis.set(self._prefix + message_id, token, nx=True, ex=self._lease))
        if claimed:
            self._owners[message_id] = token
        return claimed

    async def completed(self, message_id: str) -> bool:
        return await self._redis.get(self._prefix + message_id) in ("done", b"done")

    async def _owned(self, message_id: str, action: str, ttl: int = 0) -> None:
        token = self._owners.get(message_id, "")
        script = "if redis.call('get', KEYS[1]) == ARGV[1] then " + action + " end return 0"
        await self._redis.eval(script, 1, self._prefix + message_id, token, ttl)

    async def complete(self, message_id: str) -> None:
        await self._owned(message_id, "redis.call('set', KEYS[1], 'done', 'EX', ARGV[2])", self._ttl)
        self._owners.pop(message_id, None)

    async def release(self, message_id: str) -> None:
        await self._owned(message_id, "redis.call('del', KEYS[1])")
        self._owners.pop(message_id, None)

    async def renew(self, message_id: str) -> None:
        await self._owned(message_id, "redis.call('expire', KEYS[1], ARGV[2])", self._lease)

def build_default_store(ttl_seconds: int = 86400):
    url = os.getenv("REDIS_URL")
    if not url:
        if os.getenv("NODE_ENV") == "production" or os.getenv("APP_ENV") == "production":
            raise RuntimeError("REDIS_URL is required for durable worker idempotency")
        return InMemoryIdempotencyStore(ttl_seconds)
    import redis.asyncio as aioredis
    return RedisIdempotencyStore(aioredis.from_url(url, decode_responses=True), ttl_seconds)
