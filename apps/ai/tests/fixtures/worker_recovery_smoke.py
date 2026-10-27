"""Real BaseAIWorker/RabbitMQ/Redis recovery; fixture handler, no inference.

Invoked only by scripts/verify-worker-recovery.mjs on isolated containers.
"""

import asyncio
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone

import aio_pika
import redis.asyncio as redis

from messaging.failures import RetryableError, TerminalError
from messaging.topology import (
    EXCHANGE_JOBS,
    EXCHANGE_RESULTS,
    declare_topology,
    dlq_queue_name,
)
from workers.base import BaseAIWorker
from workers.idempotency import RedisIdempotencyStore

JOB = "study.ingest.course"
PREFIX = "fixture:recovery:"


class ProbeWorker(BaseAIWorker):
    job_type = JOB

    def __init__(self):
        self.redis = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
        super().__init__(
            idempotency_store=RedisIdempotencyStore(
                self.redis, prefix=PREFIX + "lease:", lease_seconds=3
            )
        )

    async def start(self):
        await super().start()
        await self.redis.set(PREFIX + "ready:" + sys.argv[2], "yes")

    async def handle(self, payload, envelope):
        await self.redis.incr(PREFIX + "calls:" + envelope.messageId)
        if payload.get("action") == "terminal":
            raise TerminalError("Synthetic terminal failure")
        if payload.get("action") == "retry":
            raise RetryableError("Synthetic transient failure")
        await self.redis.set(PREFIX + "entered", envelope.messageId)
        while not await self.redis.get(PREFIX + "release"):
            await asyncio.sleep(0.05)
        return {"receipt": envelope.messageId, "fixture": True}


async def until(check, timeout=30):
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        result = await check()
        if result:
            return result
        await asyncio.sleep(0.05)
    raise AssertionError("Timed out waiting for recovery condition")


async def main(stage):
    client = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    connection = await aio_pika.connect_robust(os.environ["RABBITMQ_URL"])
    channel = await connection.channel()
    await declare_topology(channel)
    results = await channel.declare_queue("ednova.fixture.results", durable=True)
    await results.bind(EXCHANGE_RESULTS, routing_key="result")
    exchange = await channel.get_exchange(EXCHANGE_JOBS)
    child = subprocess.Popen([sys.executable, __file__, "worker", stage])

    async def publish(action="hold", envelope=None):
        value = envelope or {
            "messageId": str(uuid.uuid4()),
            "correlationId": str(uuid.uuid4()),
            "type": JOB,
            "version": "1",
            "requestId": "isolated-recovery-fixture",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "userId": "synthetic-recovery-actor",
            "payload": {"action": action},
        }
        await exchange.publish(
            aio_pika.Message(
                body=json.dumps(value).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=JOB,
        )
        return value

    async def next_message(queue):
        return await until(lambda: queue.get(fail=False))

    try:
        await until(lambda: client.get(PREFIX + "ready:" + stage))
        if stage == "crash":
            value = await publish()
            await client.set(PREFIX + "envelope", json.dumps(value))
            await until(lambda: client.get(PREFIX + "entered"))
            child.kill()
            assert await asyncio.to_thread(child.wait, 10) == -9
            assert await results.get(fail=False) is None
            print("PASS: actual worker SIGKILL after claim; no result fabricated", flush=True)
            return

        value = json.loads(await client.get(PREFIX + "envelope"))
        await client.set(PREFIX + "release", "yes")
        result = await next_message(results)
        body = json.loads(result.body)
        assert body["messageId"] == value["messageId"] and body["status"] == "completed"
        await result.ack()
        key = PREFIX + "lease:" + value["messageId"] + ":0"
        await until(lambda: client.get(key))
        for _ in range(100):
            if await client.get(key) == "done":
                break
            await asyncio.sleep(0.05)
        assert await client.get(key) == "done"
        assert int(await client.get(PREFIX + "calls:" + value["messageId"])) == 2
        await publish(envelope=value)
        await asyncio.sleep(1)
        assert await results.get(fail=False) is None
        assert int(await client.get(PREFIX + "calls:" + value["messageId"])) == 2
        print("PASS: broker/Redis restart redelivers killed work; duplicate completion suppressed", flush=True)

        dlq = await channel.declare_queue(dlq_queue_name(JOB), durable=True)
        for action, attempts in (("terminal", 1), ("retry", 3)):
            poison = await publish(action=action)
            result = await next_message(results)
            body = json.loads(result.body)
            assert body["messageId"] == poison["messageId"] and body["status"] == "failed"
            await result.ack()
            dead = await next_message(dlq)
            assert json.loads(dead.body)["messageId"] == poison["messageId"]
            assert int(dead.headers.get("x-retry-count", 0)) == attempts - 1
            await dead.ack()
            assert int(await client.get(PREFIX + "calls:" + poison["messageId"])) == attempts
        print("PASS: terminal DLQ and bounded real delay-queue retry exhaustion", flush=True)
    finally:
        if child.poll() is None:
            child.terminate()
            try:
                await asyncio.to_thread(child.wait, 10)
            except subprocess.TimeoutExpired:
                child.kill()
                await asyncio.to_thread(child.wait, 10)
        await connection.close()
        await client.aclose()


if sys.argv[1] == "worker":
    ProbeWorker().run()
else:
    asyncio.run(main(sys.argv[1]))
