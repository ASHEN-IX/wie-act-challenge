#!/usr/bin/env bash
# Does the pre-existing `rabbitmq` container belong to this project, and are
# the harness-expected names free? Read-only.
set -u
D="docker --context default"

echo "=== existing 'rabbitmq' container identity ==="
$D inspect rabbitmq --format '
name={{.Name}}
image={{.Config.Image}}
status={{.State.Status}}
project={{index .Config.Labels "com.docker.compose.project"}}
service={{index .Config.Labels "com.docker.compose.service"}}
working_dir={{index .Config.Labels "com.docker.compose.project.working_dir"}}
' 2>&1 | head -12

echo
echo "=== is an 'ednova-ai' container present? ==="
$D ps -a --format '{{.Names}}' | grep -x 'ednova-ai' || echo "absent"

echo
echo "=== are harness names free? ==="
for n in rabbitmq ednova-ai; do
  if $D ps -a --format '{{.Names}}' | grep -qx "$n"; then echo "$n TAKEN"; else echo "$n free"; fi
done
