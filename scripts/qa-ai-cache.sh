#!/usr/bin/env bash
# Verify the embedding-model cache the harness copies out of ednova-ai. Read-only.
set -u
D="docker --context default"
echo "=== home dirs ==="
$D exec ednova-ai sh -c 'echo HOME=$HOME; id' 2>&1 | head -3
echo
echo "=== search for huggingface cache ==="
$D exec ednova-ai sh -c 'ls -la /home/ednova/.cache 2>&1 | head -6' 2>&1
echo "---"
$D exec ednova-ai sh -c 'ls -la /home/ednova/.cache/huggingface 2>&1 | head -8' 2>&1
echo
echo "=== discover any sentence-transformers / all-MiniLM cache in image ==="
$D exec ednova-ai sh -c 'find / -maxdepth 6 -type d -name "hub" -path "*huggingface*" 2>/dev/null | head -5' 2>&1
