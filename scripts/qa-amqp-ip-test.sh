#!/usr/bin/env bash
# Isolate the relay: connect to a fresh vhost using the bridge gateway IP
# DIRECTLY (no relay in the path), then via the relay.
set -u
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^RABBITMQ_PASS=' .env)
GW=$($D network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' | head -1)
V="test_formula_probe2_$(date +%s)"

$D exec rabbitmq rabbitmqctl add_vhost "$V" >/dev/null 2>&1
$D exec rabbitmq rabbitmqctl set_permissions -p "$V" mindflow '.*' '.*' '.*' >/dev/null 2>&1
echo "vhost=$V gateway=$GW"

echo
echo "=== A: direct to gateway IP (no relay) ==="
$D run --rm --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -c "
import asyncio, aio_pika
async def main():
    try:
        c = await asyncio.wait_for(aio_pika.connect_robust('amqp://mindflow:${RABBITMQ_PASS}@${GW}:5672/${V}'), timeout=15)
        print('GATEWAY-IP OK'); await c.close()
    except Exception as e:
        print('GATEWAY-IP FAILED:', type(e).__name__, str(e)[:150])
asyncio.run(main())
" 2>&1 | tail -3

echo
echo "=== B: relay hostname ==="
$D run --rm --add-host host.docker.internal:host-gateway \
  --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -c "
import asyncio, aio_pika
async def main():
    try:
        c = await asyncio.wait_for(aio_pika.connect_robust('amqp://mindflow:${RABBITMQ_PASS}@host.docker.internal:5672/${V}'), timeout=15)
        print('RELAY OK'); await c.close()
    except Exception as e:
        print('RELAY FAILED:', type(e).__name__, str(e)[:150])
asyncio.run(main())
" 2>&1 | tail -3

$D exec rabbitmq rabbitmqctl delete_vhost "$V" >/dev/null 2>&1
