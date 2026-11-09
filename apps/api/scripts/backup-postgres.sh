#!/usr/bin/env bash
# PostgreSQL backup script for EdNova
# Usage: ./backup-postgres.sh [DATABASE_URL] [BACKUP_DIR]
#
# Defaults:
#   DATABASE_URL = $DATABASE_URL env var, or postgresql://postgres:postgres@localhost:5432/ednova
#   BACKUP_DIR   = ./backups (relative to script location)
#
# Produces a compressed custom-format dump (pg_dump -Fc) in BACKUP_DIR/<timestamp>/,
# restorable with restore-postgres.sh or `pg_restore`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DATABASE_URL="${1:-${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ednova}}"
BACKUP_DIR="${2:-${SCRIPT_DIR}/../backups}/${TIMESTAMP}"

echo "==> PostgreSQL backup"
echo "    Database:   configured PostgreSQL target (credentials redacted)"
echo "    Target dir: ${BACKUP_DIR}"

mkdir -p "${BACKUP_DIR}"
DUMP_FILE="${BACKUP_DIR}/ednova.dump"

pg_dump \
  --dbname="${DATABASE_URL}" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --file="${DUMP_FILE}"

# Verify the dump is present and readable as a custom-format archive
if [ -s "${DUMP_FILE}" ] && pg_restore --list "${DUMP_FILE}" >/dev/null 2>&1; then
  TABLES=$(pg_restore --list "${DUMP_FILE}" | grep -c 'TABLE DATA' || true)
  echo "==> Backup complete: ${TABLES} table data sections dumped to ${DUMP_FILE}"
else
  echo "==> ERROR: Dump missing or not a valid pg_dump archive. Check DATABASE_URL." >&2
  exit 1
fi

# Retain at least seven successful backups, regardless of age.
PARENT_DIR="$(dirname "${BACKUP_DIR}")"
BACKUP_ROOT="${PARENT_DIR}" python3 - <<'RETENTION'
import os, shutil, time
from pathlib import Path
root = Path(os.environ['BACKUP_ROOT'])
backups = sorted((p for p in root.iterdir() if p.is_dir() and not p.is_symlink()), key=lambda p: p.stat().st_mtime, reverse=True)
for backup in backups[7:]:
    if time.time() - backup.stat().st_mtime > 30 * 86400:
        shutil.rmtree(backup)
RETENTION
echo "==> Retention applied (minimum seven backups)"
