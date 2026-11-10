#!/usr/bin/env bash
# Clean slate between takes: fresh database + seed + class practice + new AI approvals (budgets reset).
set -euo pipefail
cd "$(dirname "$0")/.."
bash demo/stop.sh
sleep 2
bash demo/setup.sh --no-build
bash demo/start.sh
source demo/env.sh
(cd apps/api && pnpm prisma:seed demo > ../../demo/output/logs/seed.log 2>&1)
grep -q "Finished Successfully" demo/output/logs/seed.log
node demo/cohort.mjs 6 > demo/output/logs/cohort.log 2>&1 || { echo "cohort practice failed; see demo/output/logs/cohort.log" >&2; exit 1; }
echo "demo reset: ready"
