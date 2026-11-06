#!/usr/bin/env bash
# Who is holding 5672? Read-only.
set -u
D="docker --context default"
echo "=== host listeners on 5672 ==="
ss -ltnp 2>/dev/null | grep ':5672' || echo "ss unavailable"
echo
echo "=== relay process? ==="
pgrep -fa 'qa-relay.py' | head -3 || echo "no relay running"
echo
echo "=== relay pidfile ==="
cat /home/ashenix/Projects/mindflow/var/qa-relay.pid 2>/dev/null || echo "no pidfile"
echo
echo "=== rabbitmq container state ==="
$D ps -a --filter name=^rabbitmq$ --format '{{.Names}}|{{.Status}}' 2>&1
