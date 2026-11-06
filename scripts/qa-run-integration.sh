#!/usr/bin/env bash
# Regression gates that need the live QA stack (MongoDB/RabbitMQ).
# Must run outside the sandbox, which cannot open loopback connections.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"
LOG="$ROOT/reports/evidence/batch3/integration-suites.log"

echo "=== study integration suites (real MongoDB + RabbitMQ) ==="
pnpm exec jest modules/study/src/tests/formula-jobs.integration.test.ts \
  modules/study/src/tests/formula-proposal.integration.test.ts \
  modules/study/src/tests/formula-publication.integration.test.ts \
  --runInBand --forceExit --testTimeout=60000 > "$LOG" 2>&1
code=$?
echo "JEST_EXIT=$code"
grep -E '^(PASS|FAIL)' "$LOG" | sort -u
grep -E 'Tests:|Test Suites:' "$LOG"
exit 0
