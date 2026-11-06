#!/usr/bin/env bash
# Consolidate to one RabbitMQ: remove this run's leftover QA rabbit (holding
# 5672) and any created-but-not-started container, then create the single
# `rabbitmq` the harness expects.
set -eu
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^(RABBITMQ_USER|RABBITMQ_PASS|RABBITMQ_VHOST)=' .env)

echo "=== remove this run's leftover QA rabbit ==="
if $D ps -a --format '{{.Names}}' | grep -qx ednova-qa-rabbitmq; then
  label=$($D inspect --format '{{index .Config.Labels "ednova-qa"}}' ednova-qa-rabbitmq 2>/dev/null || echo "")
  if [ "$label" = "batch3.6" ]; then
    $D rm -f ednova-qa-rabbitmq >/dev/null && echo "removed ednova-qa-rabbitmq"
  else
    echo "FATAL: ednova-qa-rabbitmq has label '$label'"; exit 1
  fi
fi

echo "=== remove the created-but-stopped rabbitmq ==="
if $D ps -a --format '{{.Names}}' | grep -qx rabbitmq; then
  proj=$($D inspect rabbitmq --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")
  if [ "$proj" = "study-partner-api" ]; then
    $D rm -f rabbitmq >/dev/null && echo "removed rabbitmq"
  else
    echo "FATAL: foreign rabbitmq (project='$proj')"; exit 1
  fi
fi

echo "=== create the harness's rabbitmq ==="
$D run -d --name rabbitmq \
  --label com.docker.compose.project=study-partner-api \
  --label "com.docker.compose.project.working_dir=$ROOT" \
  --label com.docker.compose.service=rabbitmq \
  --label ednova-qa=batch3.6 \
  -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 \
  -e "RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}" \
  -e "RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASS}" \
  -e "RABBITMQ_DEFAULT_VHOST=${RABBITMQ_VHOST}" \
  rabbitmq:3-management >/dev/null
echo "created"

for i in $(seq 1 90); do
  if $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    echo "ready after ${i}s"; break; fi
  sleep 1
  if [ "$i" = "90" ]; then echo "FATAL timeout"; exit 1; fi
done
$D exec rabbitmq rabbitmqctl list_vhosts 2>/dev/null | tail -3
