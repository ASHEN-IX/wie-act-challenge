#!/usr/bin/env bash
# Remove QA run directories left behind by earlier teardown failures.
# Only touches paths matching the isolated run-name pattern.
set -u
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/var/final-qa"

[ -d "$TARGET" ] || { echo "nothing to clean"; exit 0; }

echo "=== before ==="
du -sh "$TARGET" 2>/dev/null

# Root-owned FAISS files need a container to unlink them.
$D run --rm -v "$TARGET:/qa" busybox:latest sh -c '
  cd /qa 2>/dev/null || exit 0
  for d in test_formula_final_*; do
    [ -d "$d" ] && rm -rf "$d" && echo "removed $d"
  done' 2>&1 | tail -10

echo "=== after ==="
du -sh "$TARGET" 2>/dev/null
ls -1 "$TARGET" 2>/dev/null | head -3
