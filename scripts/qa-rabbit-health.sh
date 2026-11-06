#!/usr/bin/env bash
# RabbitMQ health and QA vhost state. Read-only.
set -u
D="docker --context default"
echo "=== container ==="
$D ps -a --filter name=^rabbitmq$ --format '{{.Names}}|{{.Status}}' 2>&1
echo "=== ping ==="
$D exec rabbitmq rabbitmq-diagnostics -q ping 2>&1 | tail -2
echo "=== vhosts ==="
$D exec rabbitmq rabbitmqctl list_vhosts 2>/dev/null | tail -6
echo "=== queues ==="
$D exec rabbitmq rabbitmqctl list_queues 2>/dev/null | tail -6
echo "=== relay ==="
pgrep -fa qa-relay.py | head -2 || echo "no relay"
