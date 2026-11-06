#!/usr/bin/env bash
# Batch 3.6 QA stack probe. Read-only: inspects state, starts nothing.
set -u
export DOCKER_CONTEXT=default
D="docker --context default"

echo "=== docker server ==="
$D version --format 'server={{.Server.Version}} api={{.Server.APIVersion}}' 2>&1

echo
echo "=== port occupancy (host) ==="
for p in 27017 5672 5362 5361 5360 15672; do
  if (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null; then echo "$p IN-USE"; else echo "$p free"; fi
done

echo
echo "=== existing containers (ours + others) ==="
$D ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>&1

echo
echo "=== relevant images ==="
$D images --format '{{.Repository}}:{{.Tag}}' 2>&1 | grep -E 'mongo|rabbitmq|redis|mailpit|ednova' || true

echo
echo "=== ai image: does it have the harness app? ==="
ls -1 apps/ai/tests/final_acceptance_app.py 2>&1
$D run --rm --entrypoint /opt/venv/bin/python ednova-m02-ai:verification \
  -c "import sys; print('py', sys.version.split()[0]); import faiss; print('faiss ok')" 2>&1 | tail -3

echo
echo "=== env keys present (values masked) ==="
for k in RABBITMQ_USER RABBITMQ_PASS RABBITMQ_VHOST MONGODB_URI DOCKER_MONGODB_URI; do
  v=$(grep -E "^$k=" .env 2>/dev/null | head -1 | cut -d= -f2-)
  if [ -n "$v" ]; then echo "$k=SET(len=${#v})"; else echo "$k=MISSING"; fi
done

echo
echo "=== compose test config ==="
grep -E 'image:|ports:|container_name:' deploy/compose.test.yml 2>&1
