#!/usr/bin/env bash
# Reproduce the harness's exact sequence against a FRESH vhost, which is where
# the Python client fails with AMQPInternalError one-of-Connection.OpenOk.
set -u
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^RABBITMQ_PASS=' .env)
V="test_formula_probe_$(date +%s)"

echo "=== create vhost + permissions (as the harness does) ==="
$D exec rabbitmq rabbitmqctl add_vhost "$V" 2>&1 | tail -1
$D exec rabbitmq rabbitmqctl set_permissions -p "$V" mindflow '.*' '.*' '.*' 2>&1 | tail -1

echo
echo "=== connect to the fresh vhost through the relay ==="
$D run --rm --add-host host.docker.internal:host-gateway \
  --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -c "
import asyncio, aio_pika
async def main():
    try:
        c = await asyncio.wait_for(
            aio_pika.connect_robust('amqp://mindflow:${RABBITMQ_PASS}@host.docker.internal:5672/${V}'),
            timeout=15)
        print('FRESH VHOST OK'); await c.close()
    except Exception as e:
        print('FRESH VHOST FAILED:', type(e).__name__, str(e)[:200])
asyncio.run(main())
" 2>&1 | tail -4

echo
echo "=== container hostname (rabbit@?) ==="
$D exec rabbitmq hostname 2>&1 | tail -1

echo
echo "=== cleanup ==="
$D exec rabbitmq rabbitmqctl delete_vhost "$V" 2>&1 | tail -1
