#!/usr/bin/env bash
# Hypothesis: the client connects before vhost permission propagation.
# Test the same fresh vhost after a short settle delay.
set -u
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^RABBITMQ_PASS=' .env)
V="test_formula_race_$(date +%s)"
GW=$($D network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' | head -1)

$D exec rabbitmq rabbitmqctl add_vhost "$V" >/dev/null 2>&1
$D exec rabbitmq rabbitmqctl set_permissions -p "$V" mindflow '.*' '.*' '.*' >/dev/null 2>&1

attempt() {
  local delay="$1"
  sleep "$delay"
  $D run --rm --entrypoint /opt/venv/bin/python ednova-api-ai-service:latest -c "
import asyncio, aio_pika
async def main():
    try:
        c = await asyncio.wait_for(aio_pika.connect_robust('amqp://mindflow:${RABBITMQ_PASS}@${GW}:5672/${V}'), timeout=15)
        print('OK after ${delay}s'); await c.close()
    except Exception as e:
        print('FAIL after ${delay}s:', type(e).__name__)
asyncio.run(main())
" 2>&1 | grep -E 'OK after|FAIL after' | tail -1
}

echo "vhost=$V"
attempt 0
attempt 3
attempt 5

$D exec rabbitmq rabbitmqctl delete_vhost "$V" >/dev/null 2>&1
