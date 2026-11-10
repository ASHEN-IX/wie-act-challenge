#!/usr/bin/env bash
# Starts the isolated demo stack: AI :8100, API :3101, web :3100. Logs in demo/output/logs.
set -euo pipefail
cd "$(dirname "$0")/.."
source demo/env.sh
mkdir -p demo/output/logs
LOG=demo/output/logs
SECRET=$(grep -E '^INTERNAL_API_SECRET=' apps/api/.env | cut -d= -f2-)
( set -a; source apps/ai/.env; set +a
  export INTERNAL_API_SECRET="$SECRET" LLM_MOCK=0 API_SERVICE_URL=http://127.0.0.1:3101
  export LLM_APPROVALS_JSON="$(cd apps/ai && $DEMO_PY ../../demo/approvals.py)"
  cd apps/ai && setsid nohup $DEMO_PY -m uvicorn services.api.main:app --host 127.0.0.1 --port 8100 > ../../$LOG/ai.log 2>&1 < /dev/null & )
( cd apps/api && setsid nohup node dist/main.js > ../../$LOG/api.log 2>&1 < /dev/null & )
# Supervised: the web server is restarted if it ever exits mid-recording.
setsid nohup bash demo/web-server.sh > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 40); do
  curl -sf localhost:8100/health >/dev/null && curl -s -o /dev/null localhost:3101/ && curl -sf -o /dev/null localhost:3100/login && { echo "demo stack up: web http://localhost:3100"; exit 0; }
  sleep 2
done
echo "stack did not come up; see $LOG" >&2; exit 1
