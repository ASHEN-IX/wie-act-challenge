#!/usr/bin/env bash
# Verify an existing AI image's venv can import the current repo application.
# Read-only: runs a throwaway container, starts no services.
set -u
D="docker --context default"
IMG="${1:-ednova-m02-ai:verification}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== image: $IMG ==="
echo "--- google.genai present? ---"
$D run --rm --entrypoint /opt/venv/bin/python "$IMG" -c "import google.genai; print('genai ok')" 2>&1 | tail -2

echo "--- import the harness entrypoint against the repo mount ---"
$D run --rm \
  -e PYTHONPATH=/app:/app/agents/evaluator \
  -v "$ROOT/apps/ai:/app:ro" \
  -w /app \
  --entrypoint /opt/venv/bin/python \
  "$IMG" -c "
import importlib, sys
for m in ['fastapi','uvicorn','pymongo','faiss','litellm','numpy','pydantic']:
    try:
        importlib.import_module(m); print('ok', m)
    except Exception as e:
        print('FAIL', m, type(e).__name__, e)
" 2>&1 | tail -12

echo "--- services.api.main import (real app surface) ---"
$D run --rm \
  -e PYTHONPATH=/app:/app/agents/evaluator \
  -v "$ROOT/apps/ai:/app:ro" \
  -w /app \
  --entrypoint /opt/venv/bin/python \
  "$IMG" -c "import services.api.main; print('app import ok')" 2>&1 | tail -6

echo "--- repo pyproject vs image (dependency drift check) ---"
$D run --rm --entrypoint /opt/venv/bin/python "$IMG" -m pip list --format=freeze 2>/dev/null | wc -l
echo "venv package count above"
