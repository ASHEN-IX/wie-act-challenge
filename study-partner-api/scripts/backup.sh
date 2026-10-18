#!/usr/bin/env bash
# MongoDB backup script for Study Partner
# Usage: ./backup.sh [MONGODB_URI] [BACKUP_DIR]
#
# Defaults:
#   MONGODB_URI  = $MONGODB_URI env var, or mongodb://localhost:27017/study_partner
#   BACKUP_DIR   = ./backups (relative to script location)
#
# Produces a gzipped BSON dump in BACKUP_DIR/<timestamp>/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
MONGODB_URI="${1:-${MONGODB_URI:-mongodb://localhost:27017/study_partner}}"
BACKUP_DIR="${2:-${SCRIPT_DIR}/../backups}/${TIMESTAMP}"

echo "==> MongoDB backup"
echo "    Database:   configured MongoDB target (credentials redacted)"
echo "    Target dir: ${BACKUP_DIR}"

mkdir -p "${BACKUP_DIR}"

mongodump \
  --uri="${MONGODB_URI}" \
  --out="${BACKUP_DIR}" \
  --gzip \
  --numParallelCollections=4

# Verify at least one collection was dumped
if [ -d "${BACKUP_DIR}/study_partner" ]; then
  COLLECTIONS=$(ls -1 "${BACKUP_DIR}/study_partner" | wc -l)
  echo "==> Backup complete: ${COLLECTIONS} collections dumped"
else
  # Try the database name extracted from URI
  DB_NAME=$(echo "${MONGODB_URI}" | grep -oP '(?<=/)[^/?]+' | tail -1)
  if [ -d "${BACKUP_DIR}/${DB_NAME}" ]; then
    COLLECTIONS=$(ls -1 "${BACKUP_DIR}/${DB_NAME}" | wc -l)
    echo "==> Backup complete: ${COLLECTIONS} collections dumped to ${DB_NAME}/"
  else
    echo "==> WARNING: No collections found in backup. Check URI." >&2
    exit 1
  fi
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
