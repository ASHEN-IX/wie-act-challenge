#!/usr/bin/env bash
# Adapt the QA stack to the names the existing harness expects.
#
# The harness hardcodes `rabbitmq` and image `ednova-api-ai-service`. The
# pre-existing `rabbitmq` container is this project's own (compose project
# study-partner-api, working_dir = this repo) and carries credentials that match
# .env exactly, so it is reused rather than replaced.
#
# Creates NO new containers except the AI runtime the harness starts itself.
set -eu
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== reclaiming our own redundant QA rabbit (superseded by 'rabbitmq') ==="
if $D ps -a --format '{{.Names}}' | grep -qx ednova-qa-rabbitmq; then
  label=$($D inspect --format '{{index .Config.Labels "ednova-qa"}}' ednova-qa-rabbitmq 2>/dev/null || echo "")
  if [ "$label" = "batch3.6" ]; then
    $D rm -f ednova-qa-rabbitmq >/dev/null && echo "removed ednova-qa-rabbitmq"
  else
    echo "FATAL: ednova-qa-rabbitmq exists without our label"; exit 1
  fi
fi

echo
echo "=== starting the project's own rabbitmq (exited) ==="
$D start rabbitmq >/dev/null && echo "started"

echo
echo "=== alias the AI image to the tag the harness expects ==="
# Local retag only: same image bytes, no build, no pull.
if $D images --format '{{.Repository}}:{{.Tag}}' | grep -qx 'ednova-api-ai-service:latest'; then
  echo "already tagged"
else
  $D tag ednova-m02-ai:verification ednova-api-ai-service:latest
  echo "tagged ednova-m02-ai:verification -> ednova-api-ai-service:latest"
fi

echo
echo "=== waiting for rabbitmq ==="
for i in $(seq 1 60); do
  if $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    echo "rabbitmq ready after ${i}s"; break
  fi
  sleep 1
  if [ "$i" = "60" ]; then echo "FATAL: rabbitmq did not become ready"; $D logs --tail 20 rabbitmq; exit 1; fi
done

echo
echo "=== stack now ==="
$D ps --format '{{.Names}}|{{.Status}}' 2>&1 | grep -E 'rabbitmq|mongo|redis' || true
