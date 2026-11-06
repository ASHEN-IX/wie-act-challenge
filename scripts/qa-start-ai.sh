#!/usr/bin/env bash
# Start only the project's `ednova-ai` container, which the harness uses as a
# source for the cached HuggingFace embedding model (docker cp from its cache).
#
# Uses the project's own compose service so configuration matches the repo.
# Offline: no model download; it reuses the image's baked cache.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
D="docker --context default"

if $D ps -a --format '{{.Names}}' | grep -qx ednova-ai; then
  echo "ednova-ai exists; starting"
  $D start ednova-ai >/dev/null 2>&1 || true
else
  echo "creating ednova-ai from the project's AI image"
  # No LLM keys, offline cache only. The harness replaces this service with its
  # own QA entrypoint; this container only has to expose its HF cache.
  $D run -d --name ednova-ai \
    --label ednova-qa=batch3.6 \
    --restart unless-stopped \
    -e HF_HUB_OFFLINE=1 \
    -e TRANSFORMERS_OFFLINE=1 \
    -e LLM_MOCK=1 \
    ednova-api-ai-service:latest >/dev/null
fi

echo "=== waiting for the container to be running ==="
for i in $(seq 1 30); do
  st=$($D inspect --format '{{.State.Status}}' ednova-ai 2>/dev/null || echo missing)
  if [ "$st" = "running" ]; then echo "running"; break; fi
  sleep 1
  if [ "$i" = "30" ]; then echo "state=$st"; $D logs --tail 15 ednova-ai 2>&1; exit 1; fi
done

echo
echo "=== HF cache present in the image? ==="
$D exec ednova-ai sh -c 'ls /home/ednova/.cache/huggingface 2>/dev/null | head -5' 2>&1 || echo "no cache dir"
