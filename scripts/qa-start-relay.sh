#!/usr/bin/env bash
# Start the container->host relay for the QA services (idempotent).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="docker --context default"
PIDFILE="$ROOT/var/qa-relay.pid"
LOGFILE="$ROOT/var/qa-relay.log"
mkdir -p "$ROOT/var"

GW=$($D network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' | head -1)
[ -n "$GW" ] || { echo "FATAL: no bridge gateway"; exit 1; }
echo "bridge gateway: $GW"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "relay already running (pid $(cat "$PIDFILE"))"
else
  nohup python3 "$ROOT/scripts/qa-relay.py" "$GW" 5672 27017 >"$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
  sleep 1
  echo "started relay pid $(cat "$PIDFILE")"
fi

echo "=== relay log ==="
cat "$LOGFILE"

echo
echo "=== verify from a throwaway container ==="
$D run --rm --add-host host.docker.internal:host-gateway busybox:latest sh -c '
  for p in 5672 27017; do
    if nc -z -w 2 host.docker.internal $p; then echo "$p REACHABLE"; else echo "$p unreachable"; fi
  done' 2>&1 | tail -3
