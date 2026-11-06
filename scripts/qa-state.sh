#!/usr/bin/env bash
# Current QA-relevant container state. Read-only.
set -u
D="docker --context default"
echo "=== all running ==="
$D ps --format '{{.Names}}|{{.Status}}|{{.Ports}}' 2>&1
echo
echo "=== port reachability ==="
for p in 27017 27018 5672 6379 5362 5361; do
  if (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null; then echo "$p OPEN"; else echo "$p closed"; fi
done
