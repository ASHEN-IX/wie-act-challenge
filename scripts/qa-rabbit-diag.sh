#!/usr/bin/env bash
# Diagnose the QA RabbitMQ container. Read-only.
set -u
D="docker --context default"
echo "=== state ==="
$D ps -a --filter name=ednova-qa-rabbitmq --format '{{.Names}}|{{.Status}}' 2>&1
echo
echo "=== last 40 log lines ==="
$D logs --tail 40 ednova-qa-rabbitmq 2>&1
echo
echo "=== direct diagnostic ==="
$D exec ednova-qa-rabbitmq rabbitmq-diagnostics -q ping 2>&1 | tail -5
echo
echo "=== port check on host ==="
for p in 5672 15672; do
  if (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null; then echo "$p OPEN"; else echo "$p closed"; fi
done
