#!/usr/bin/env bash
# Serves the built web app on :3100 and restarts it if it exits.
# Uses Next's programmatic server: a plain `next start` process can be caught by other tools' `pkill -f "next start"`.
set -uo pipefail
cd "$(dirname "$0")/.."
source demo/env.sh
while true; do
  (cd apps/web && node ../../demo/lib/serve-web.cjs) >> demo/output/logs/web.log 2>&1 < /dev/null
  echo "web exited $(date +%T)" >> demo/output/logs/web.log
  sleep 1
done
