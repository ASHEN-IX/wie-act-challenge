#!/usr/bin/env bash
# Tear down only what this QA run created. Leaves every foreign container,
# and the project's own pre-existing containers, in their original state.
set -u
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== stopping relay ==="
PIDFILE="$ROOT/var/qa-relay.pid"
if [ -f "$PIDFILE" ]; then
  pid=$(cat "$PIDFILE")
  kill "$pid" 2>/dev/null && echo "relay $pid stopped"
  rm -f "$PIDFILE"
else
  echo "no relay pidfile"
fi

echo "=== removing containers created BY THIS RUN (label ednova-qa=batch3.6) ==="
for name in ednova-qa-mongo ednova-qa-redis ednova-ai; do
  if $D ps -a --format '{{.Names}}' | grep -qx "$name"; then
    label=$($D inspect --format '{{index .Config.Labels "ednova-qa"}}' "$name" 2>/dev/null || echo "")
    if [ "$label" = "batch3.6" ]; then
      $D rm -f "$name" >/dev/null 2>&1 && echo "removed $name"
    else
      echo "left $name (label='$label', not ours)"
    fi
  fi
done

# The relay must go before RabbitMQ: the relay binds 172.17.0.1:5672 while the
# container binds 127.0.0.1:5672, and stopping them in the other order makes the
# next start fail with "port is already allocated".
echo "=== stopping the project's own rabbitmq (was exited before this run) ==="
if $D ps --format '{{.Names}}' | grep -qx rabbitmq; then
  $D stop -t 10 rabbitmq >/dev/null 2>&1 && echo "stopped rabbitmq (its original state was exited)"
fi

echo
echo "=== remaining containers (foreign ones must be untouched) ==="
$D ps -a --format '{{.Names}}|{{.Status}}' 2>&1 | head -25
