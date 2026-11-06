#!/usr/bin/env bash
# Run the existing isolated real-service acceptance harness.
#
# Requirements already satisfied:
#   mongodb on 27017, rabbitmq container on 5672, image ednova-api-ai-service.
# The harness starts the Python QA service, NestJS runtime, ingestion worker and
# formula worker itself, then Playwright drives a real browser.
#
# Logs to reports/evidence/batch3/final-harness.log. Exits with Playwright's code.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web"

export FINAL_QA_DB="${FINAL_QA_DB:-test_formula_final_$(date +%s)}"
export DOCKER_CONTEXT=default
LOG="$ROOT/reports/evidence/batch3/final-harness.log"

echo "FINAL_QA_DB=$FINAL_QA_DB"
echo "log=$LOG"

pnpm exec playwright test --config playwright.final.config.ts > "$LOG" 2>&1
code=$?
echo "PLAYWRIGHT_EXIT=$code"
tail -60 "$LOG"
exit $code
