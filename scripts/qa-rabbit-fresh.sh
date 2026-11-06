#!/usr/bin/env bash
# Recreate the project's rabbitmq container with a clean daemon.
# Ownership was verified earlier (compose project study-partner-api, this repo).
set -eu
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^(RABBITMQ_USER|RABBITMQ_PASS|RABBITMQ_VHOST)=' .env)

echo "=== remove any stale container of ours ==="
if $D ps -a --format '{{.Names}}' | grep -qx rabbitmq; then
  proj=$($D inspect rabbitmq --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")
  if [ "$proj" = "study-partner-api" ]; then
    $D rm -f rabbitmq >/dev/null && echo "removed"
  else
    echo "FATAL: foreign rabbitmq (project='$proj')"; exit 1
  fi
fi

echo "=== create fresh ==="
$D run -d --name rabbitmq \
  --label com.docker.compose.project=study-partner-api \
  --label "com.docker.compose.project.working_dir=$ROOT" \
  --label com.docker.compose.service=rabbitmq \
  -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 \
  -e "RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}" \
  -e "RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASS}" \
  -e "RABBITMQ_DEFAULT_VHOST=${RABBITMQ_VHOST}" \
  rabbitmq:3-management >/dev/null
echo "created"

echo "=== readiness ==="
for i in $(seq 1 90); do
  if $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    echo "ready after ${i}s"; break; fi
  sleep 1
  if [ "$i" = "90" ]; then echo "FATAL timeout"; exit 1; fi
done

echo "=== vhosts ==="
$D exec rabbitmq rabbitmqctl list_vhosts 2>/dev/null | tail -3
