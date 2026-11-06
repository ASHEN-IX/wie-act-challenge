#!/usr/bin/env bash
# Remove the root-owned .erlang.cookie left in the QA volume.
#
# Evidence (qa-rabbit-fs-debug.sh): the volume holds
#   -r-------- 1 root root 20 .erlang.cookie
# owned by root with mode 0400, so the rabbitmq user (uid 999) cannot read it
# and the daemon aborts before its entrypoint's chown fixup runs. Deleting the
# file lets the image create a correctly-owned one on next boot.
set -eu
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== remove stale cookie via a root container ==="
$D run --rm -v ednova-qa-rabbitmq-data:/var/lib/rabbitmq busybox:latest \
  sh -c 'rm -f /var/lib/rabbitmq/.erlang.cookie && echo removed; ls -la /var/lib/rabbitmq | head -4' 2>&1 | tail -6

echo "=== recreate rabbitmq ==="
if $D ps -a --format '{{.Names}}' | grep -qx rabbitmq; then
  proj=$($D inspect rabbitmq --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")
  [ "$proj" = "study-partner-api" ] || { echo "FATAL foreign"; exit 1; }
  $D rm -f rabbitmq >/dev/null
fi
. <(grep -E '^(RABBITMQ_USER|RABBITMQ_PASS|RABBITMQ_VHOST)=' .env)
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
echo created

for i in $(seq 1 90); do
  if $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    echo "ready after ${i}s"; break; fi
  sleep 1
  if [ "$i" = "90" ]; then echo "FATAL timeout"; $D logs --tail 6 rabbitmq 2>&1 | tail -4; exit 1; fi
done
$D exec rabbitmq rabbitmqctl list_vhosts 2>/dev/null | tail -3
