#!/usr/bin/env bash
# Recreate the project's rabbitmq container from scratch.
#
# Rationale: after many forced restarts this daemon rejects new-vhost AMQP
# handshakes (AMQPInternalError at Connection.OpenOk) while its management API,
# permissions and pre-existing vhosts all look correct. A fresh container with
# the same name, image and credentials restores a clean daemon.
#
# Destructive to this container's *ephemeral message store* only; it is our own
# compose container, was exited before this run, and carries no persistent volume.
set -eu
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^(RABBITMQ_USER|RABBITMQ_PASS|RABBITMQ_VHOST)=' .env)

echo "=== confirm ownership before removing ==="
project=$($D inspect rabbitmq --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")
workdir=$($D inspect rabbitmq --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' 2>/dev/null || echo "")
echo "project=$project workdir=$workdir"
if [ "$workdir" != "$ROOT" ]; then
  echo "FATAL: rabbitmq is not this project's container; refusing"; exit 1
fi

echo "=== recreate ==="
$D rm -f rabbitmq >/dev/null
$D run -d --name rabbitmq \
  --label com.docker.compose.project=study-partner-api \
  --label "com.docker.compose.project.working_dir=$ROOT" \
  --label com.docker.compose.service=rabbitmq \
  -p 127.0.0.1:5672:5672 -p 127.0.0.1:15672:15672 \
  -e "RABBITMQ_DEFAULT_USER=${RABBITMQ_USER}" \
  -e "RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASS}" \
  -e "RABBITMQ_DEFAULT_VHOST=${RABBITMQ_VHOST}" \
  rabbitmq:3-management >/dev/null
echo "created"

echo "=== wait for readiness ==="
for i in $(seq 1 90); do
  if $D exec rabbitmq rabbitmq-diagnostics -q ping >/dev/null 2>&1; then
    echo "ready after ${i}s"; break; fi
  sleep 1
  if [ "$i" = "90" ]; then echo "FATAL timeout"; $D logs --tail 20 rabbitmq; exit 1; fi
done
$D exec rabbitmq rabbitmqctl list_vhosts 2>/dev/null | tail -3
