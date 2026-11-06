#!/usr/bin/env bash
# Batch 3.6 isolated QA stack.
#
# Starts ONLY the containers the final-acceptance harness needs, on the exact
# ports it expects, under QA-specific names so nothing else is disturbed.
# Disposable: every volume is anonymous and removed by qa-stack-down.sh.
#
# Touches nothing that already exists on this host.
set -eu
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load the rabbit credentials the application expects, without printing them.
set -a
# shellcheck disable=SC1091
. <(grep -E '^(RABBITMQ_USER|RABBITMQ_PASS|RABBITMQ_VHOST)=' .env)
set +a

echo "=== preflight: only reclaim containers this script created ==="
# A same-named container that does NOT carry our QA label belongs to someone
# else; abort rather than delete it. One carrying the label is ours from a
# previous run and is safe to reclaim.
for name in ednova-qa-mongo ednova-qa-rabbitmq ednova-qa-redis; do
  if $D ps -a --format '{{.Names}}' | grep -qx "$name"; then
    label=$($D inspect --format '{{index .Config.Labels "ednova-qa"}}' "$name" 2>/dev/null || echo "")
    if [ "$label" = "batch3.6" ]; then
      echo "reclaiming previous QA container: $name"
      $D rm -f "$name" >/dev/null 2>&1 || true
    else
      echo "FATAL: '$name' exists and is not owned by this QA run (label='$label')"
      exit 1
    fi
  fi
done
echo "ok: no foreign name conflicts"

echo
echo "=== starting MongoDB (127.0.0.1:27017) ==="
$D run -d --name ednova-qa-mongo \
  --label ednova-qa=batch3.6 \
  -p 127.0.0.1:27017:27017 \
  --tmpfs /data/db:rw,size=2g \
  mongo:7 --quiet >/dev/null
echo "started"

echo
echo "=== starting RabbitMQ (127.0.0.1:5672) ==="
# No tmpfs here: a root-owned mount on /var/lib/rabbitmq makes the container's
# own user (uid 999) unable to read its erlang cookie and it crash-loops.
# The container filesystem is already disposable, so nothing is persisted.
$D run -d --name ednova-qa-rabbitmq \
  --label ednova-qa=batch3.6 \
  -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 \
  -e "RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}" \
  -e "RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASS}" \
  -e "RABBITMQ_DEFAULT_VHOST=${RABBITMQ_VHOST}" \
  rabbitmq:3-management >/dev/null
echo "started"

echo
echo "=== starting Redis (127.0.0.1:6379) ==="
$D run -d --name ednova-qa-redis \
  --label ednova-qa=batch3.6 \
  -p 127.0.0.1:6379:6379 \
  redis:7-alpine >/dev/null
echo "started"

echo
echo "=== waiting for readiness ==="
for i in $(seq 1 60); do
  mongo_ok=no; rabbit_ok=no; redis_ok=no
  $D exec ednova-qa-mongo mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1 && mongo_ok=yes
  $D exec ednova-qa-rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1 && rabbit_ok=yes
  $D exec ednova-qa-redis redis-cli ping 2>/dev/null | grep -q PONG && redis_ok=yes
  if [ "$mongo_ok$rabbit_ok$redis_ok" = "yesyesyes" ]; then
    echo "all ready after ${i}s"
    break
  fi
  sleep 1
  if [ "$i" = "60" ]; then
    echo "FATAL: readiness timeout (mongo=$mongo_ok rabbit=$rabbit_ok redis=$redis_ok)"
    exit 1
  fi
done

echo
echo "=== QA stack ==="
$D ps --filter label=ednova-qa=batch3.6 --format '{{.Names}}|{{.Status}}|{{.Ports}}'
