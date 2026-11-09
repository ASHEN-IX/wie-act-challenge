#!/usr/bin/env bash
# PostgreSQL restore script for EdNova
# Usage: ./restore-postgres.sh <BACKUP_DIR> [DATABASE_URL]
#
# Args:
#   BACKUP_DIR    - Path to a backup directory (e.g., ./backups/20260818_120000)
#   DATABASE_URL  - Target URI (default: $DATABASE_URL or postgresql://postgres:postgres@localhost:5432/ednova)
#
# WARNING: This drops and replaces objects in the target database.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <BACKUP_DIR> [DATABASE_URL]"
  echo "  BACKUP_DIR: path to backup (e.g., ./backups/20260818_120000)"
  echo "  DATABASE_URL: target database URI (default: \$DATABASE_URL or postgresql://postgres:postgres@localhost:5432/ednova)"
  exit 1
fi

BACKUP_DIR="$1"
DATABASE_URL="${2:-${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ednova}}"

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "ERROR: Backup directory not found: ${BACKUP_DIR}" >&2
  exit 1
fi

# Find the dump file: either <BACKUP_DIR>/*.dump or <BACKUP_DIR>/*/*.dump
DUMP_FILE=""
for candidate in "${BACKUP_DIR}"/*.dump "${BACKUP_DIR}"/*/*.dump; do
  if [ -f "${candidate}" ]; then
    DUMP_FILE="${candidate}"
    break
  fi
done

if [ -z "${DUMP_FILE}" ]; then
  echo "ERROR: No pg_dump archive (*.dump) found in ${BACKUP_DIR}" >&2
  exit 1
fi

if ! pg_restore --list "${DUMP_FILE}" >/dev/null 2>&1; then
  echo "ERROR: ${DUMP_FILE} is not a valid pg_dump custom archive" >&2
  exit 1
fi

echo "==> PostgreSQL restore"
echo "    Source:     ${DUMP_FILE}"
echo "    Target: configured PostgreSQL database (credentials redacted)"
echo ""
echo "    WARNING: This will DROP and REPLACE objects in the target database."
read -p "    Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

pg_restore \
  --dbname="${DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --single-transaction \
  "${DUMP_FILE}"

echo "==> Restore complete"
