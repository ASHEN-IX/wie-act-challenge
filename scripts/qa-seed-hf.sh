#!/usr/bin/env bash
# Provide the embedding-model cache at the path the harness copies from.
#
# The harness runs:  docker cp ednova-ai:/home/ednova/.cache/huggingface/. <qa>/hf
# The AI image does not bake that cache, but the host already has the exact model
# (all-MiniLM-L6-v2, 88 MB). Copy the host cache into the container so no model
# is ever downloaded.
set -eu
D="docker --context default"
SRC="$HOME/.cache/huggingface"
DEST_HOME="/home/ednova/.cache"

if [ ! -d "$SRC/hub/models--sentence-transformers--all-MiniLM-L6-v2" ]; then
  echo "FATAL: host cache for all-MiniLM-L6-v2 not found at $SRC"; exit 1
fi

echo "=== ensure target dirs exist in ednova-ai ==="
$D exec -u 0 ednova-ai sh -c "mkdir -p $DEST_HOME/huggingface" >/dev/null
echo "ok"

echo "=== copy host cache into the container ==="
$D cp "$SRC/hub" "ednova-ai:$DEST_HOME/huggingface/hub"
echo "copied"

echo "=== verify from inside ==="
$D exec ednova-ai sh -c "du -sh $DEST_HOME/huggingface 2>/dev/null; ls $DEST_HOME/huggingface/hub"
