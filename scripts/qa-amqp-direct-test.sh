#!/usr/bin/env bash
# Is the relay or RabbitMQ at fault? Compare a real AMQP handshake:
#   (a) via the relay  (host.docker.internal:5672)
#   (b) direct to the container name (rabbitmq:5672 on the docker network)
set -u
D="docker --context default"

echo "=== (a) AMQP handshake THROUGH the relay ==="
$D run --rm --add-host host.docker.internal:host-gateway \
  --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -c "
import asyncio, aio_pika, sys
async def main():
    try:
        c = await asyncio.wait_for(
            aio_pika.connect_robust('amqp://mindflow:$(grep -E '^RABBITMQ_PASS=' .env | cut -d= -f2-)@host.docker.internal:5672/mindflow'),
            timeout=15)
        print('RELAY HANDSHAKE OK')
        await c.close()
    except Exception as e:
        print('RELAY HANDSHAKE FAILED:', type(e).__name__, str(e)[:120])
asyncio.run(main())
" 2>&1 | tail -3

echo
echo "=== (b) AMQP handshake DIRECT to container ==="
$D run --rm --network container:rabbitmq \
  --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -c "
import asyncio, aio_pika
async def main():
    try:
        c = await asyncio.wait_for(
            aio_pika.connect_robust('amqp://mindflow:$(grep -E '^RABBITMQ_PASS=' .env | cut -d= -f2-)@127.0.0.1:5672/mindflow'),
            timeout=15)
        print('DIRECT HANDSHAKE OK')
        await c.close()
    except Exception as e:
        print('DIRECT HANDSHAKE FAILED:', type(e).__name__, str(e)[:120])
asyncio.run(main())
" 2>&1 | tail -3
