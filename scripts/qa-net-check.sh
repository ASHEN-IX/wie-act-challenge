#!/usr/bin/env bash
# Why can the QA container not reach RabbitMQ/Mongo on the host?
set -u
D="docker --context default"

echo "=== how rabbitmq publishes its ports ==="
$D port rabbitmq 2>&1
echo
echo "=== how mongo publishes ==="
$D port ednova-qa-mongo 2>&1

echo
echo "=== can a throwaway container reach host-gateway:5672? ==="
$D run --rm --add-host host.docker.internal:host-gateway \
  busybox:latest sh -c '
    echo "gateway host: $(getent hosts host.docker.internal || echo none)"
    for p in 5672 27017; do
      if nc -z -w 2 host.docker.internal $p 2>/dev/null; then echo "$p REACHABLE"; else echo "$p unreachable"; fi
    done' 2>&1 | tail -5
