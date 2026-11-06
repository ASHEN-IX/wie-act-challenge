#!/usr/bin/env bash
# Create rabbitmq with a clean container filesystem.
#
# The erlang cookie under /var/lib/rabbitmq must be owned by the container user
# (uid 999). A reused or root-owned directory makes the daemon crash with
# "Error when reading /var/lib/rabbitmq/.erlang.cookie: eacces". Using an
# anonymous volume guarantees a correctly-initialised data dir.
set -eu
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^(RABBITMQ_USER|RABBITMQ_PASS|RABBITMQ_VHOST)=' .env)

echo "=== ensure name is free (only our own container) ==="
if $D ps -a --format '{{.Names}}' | grep -qx rabbitmq; then
  proj=$($D inspect rabbitmq --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")
  [ "$proj" = "study-partner-api" ] || { echo "FATAL foreign rabbitmq"; exit 1; }
  $D rm -f rabbitmq >/dev/null
fi

echo "=== create with explicit data volume (owned by container user) ==="
$D volume create ednova-qa-rabbitmq-data >/dev/null
$D run -d --name rabbitmq \
  --label com.docker.compose.project=study-partner-api \
  --label "com.docker.compose.project.working_dir=$ROOT" \
  --label com.docker.compose.service=rabbitmq \
  --label ednova-qa=batch3.6 \
  -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 \
  -v ednova-qa-rabbitmq-data:/var/lib/rabbitmq \
  -e "RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}" \
  -e "RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASS}" \
  -e "RABBITMQ_DEFAULT_VHOST=${RABBITMQ_VHOST}" \
  rabbitmq:3-management >/dev/null
echo "created"

for i in $(seq 1 90); do
  if $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    echo "ready after ${i}s"; break; fi
  sleep 1
  if [ "$i" = "90" ]; then echo "FATAL timeout"; $D logs --tail 8 rabbitmq 2>&1 | tail -6; exit 1; fi
done
$D exec rabbitmq rabbitmqctl list_vhosts 2>/dev/null | tail -3
