#!/usr/bin/env bash
# Creates a fresh demo database, migrates it and seeds synthetic data. Safe to re-run (drops only $DEMO_DB).
set -euo pipefail
cd "$(dirname "$0")/.."
source demo/env.sh
PSQL="psql -h 127.0.0.1 -p 5433 -U ednova -d postgres -q"
export PGPASSWORD=ednova
$PSQL -c "drop database if exists $DEMO_DB with (force)"
$PSQL -c "create database $DEMO_DB"
[ "${1:-}" = "--no-build" ] || { pnpm --filter api build >/dev/null; pnpm --filter web build >/dev/null; }
(cd apps/api && pnpm db:setup >/dev/null)
echo "database ready: $DEMO_DB"
