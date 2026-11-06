#!/usr/bin/env bash
# Ensure the exact services the final-acceptance harness needs are running.
#
# Harness requirements (read from apps/api/tests/final-acceptance-server.ts):
#   MongoDB  127.0.0.1:27017     (it connects directly, drops the DB afterwards)
#   RabbitMQ container named `rabbitmq`, reachable on localhost:5672
#   AI image `ednova-api-ai-service` (the harness runs it itself)
#
# Containers are created with --restart unless-stopped because the Docker daemon
# in this environment restarted once already and took ad-hoc containers with it.
#
# Idempotent and non-destructive: only creates/repairs containers labelled for
# this QA run, or the project's own `rabbitmq` belonging to this repo.
set -u
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exists() { $D ps -a --format '{{.Names}}' | grep -qx "$1"; }
running() { $D ps --format '{{.Names}}' | grep -qx "$1"; }
label_of() { $D inspect --format '{{index .Config.Labels "ednova-qa"}}' "$1" 2>/dev/null || echo ""; }

echo "=== MongoDB on 27017 ==="
if running ednova-qa-mongo; then
  echo "already running"
elif exists ednova-qa-mongo; then
  [ "$(label_of ednova-qa-mongo)" = "batch3.6" ] || { echo "FATAL foreign container"; exit 1; }
  $D start ednova-qa-mongo >/dev/null && echo "restarted"
else
  $D run -d --name ednova-qa-mongo --label ednova-qa=batch3.6 \
    --restart unless-stopped \
    -p 127.0.0.1:27017:27017 \
    mongo:7 --quiet >/dev/null && echo "created"
fi

echo "=== Redis on 6379 ==="
if running ednova-qa-redis; then
  echo "already running"
elif exists ednova-qa-redis; then
  [ "$(label_of ednova-qa-redis)" = "batch3.6" ] || { echo "FATAL foreign container"; exit 1; }
  $D start ednova-qa-redis >/dev/null && echo "restarted"
else
  $D run -d --name ednova-qa-redis --label ednova-qa=batch3.6 \
    --restart unless-stopped \
    -p 127.0.0.1:6379:6379 redis:7-alpine >/dev/null && echo "created"
fi

echo "=== rabbitmq (project's own container) ==="
if running rabbitmq; then
  echo "already running"
else
  $D start rabbitmq >/dev/null && echo "started"
fi

echo "=== readiness ==="
for i in $(seq 1 60); do
  m=no; r=no; s=no
  $D exec ednova-qa-mongo mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1 && m=yes
  $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1 && r=yes
  $D exec ednova-qa-redis redis-cli ping 2>/dev/null | grep -q PONG && s=yes
  if [ "$m$r$s" = "yesyesyes" ]; then echo "ready after ${i}s"; break; fi
  sleep 1
  if [ "$i" = "60" ]; then echo "FATAL timeout mongo=$m rabbit=$r redis=$s"; exit 1; fi
done

echo
echo "=== host ports ==="
for p in 27017 5672 6379; do
  if (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null; then echo "$p OPEN"; else echo "$p CLOSED"; fi
done
echo
$D ps --format '{{.Names}}|{{.Status}}' | grep -E 'ednova-qa|^rabbitmq' || true
