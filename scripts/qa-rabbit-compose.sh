#!/usr/bin/env bash
# Restore rabbitmq using the PROJECT'S OWN compose file, which is the sanctioned
# definition (correct env, ports, and container name). The hand-built container
# failed because a root-owned .erlang.cookie in the QA volume is unreadable by
# the rabbitmq user; compose manages its own volume state.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
D="docker --context default"

echo "=== remove our hand-built container and QA volume ==="
if $D ps -a --format '{{.Names}}' | grep -qx rabbitmq; then
  $D rm -f rabbitmq >/dev/null 2>&1 && echo "removed container"
fi
$D volume rm ednova-qa-rabbitmq-data >/dev/null 2>&1 && echo "removed QA volume" || echo "volume already gone or in use"

echo "=== compose up rabbitmq (project definition) ==="
docker --context default compose --env-file .env up -d rabbitmq 2>&1 | tail -5

echo "=== readiness ==="
for i in $(seq 1 60); do
  if $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    echo "ready after ${i}s"; break; fi
  sleep 1
  if [ "$i" = "60" ]; then echo "not ready"; $D logs --tail 6 rabbitmq 2>&1 | tail -4; fi
done
$D ps --filter name=^rabbitmq$ --format '{{.Names}}|{{.Status}}'
