#!/usr/bin/env bash
# Inspect our own exited `rabbitmq` container config. Read-only. No secrets printed.
set -u
D="docker --context default"

echo "=== rabbitmq container config ==="
$D inspect rabbitmq --format '
ports={{json .HostConfig.PortBindings}}
env_count={{len .Config.Env}}
' 2>&1 | head -6

echo
echo "=== env keys only (values masked) ==="
$D inspect rabbitmq --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | cut -d= -f1 | sort

echo
echo "=== vhost/user env values length (not contents) ==="
$D inspect rabbitmq --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -E '^RABBITMQ_DEFAULT_(USER|PASS|VHOST)=' \
  | while IFS='=' read -r k v; do echo "$k len=${#v}"; done

echo
echo "=== compare with current .env (length + equality check, no print) ==="
. <(grep -E '^(RABBITMQ_USER|RABBITMQ_PASS|RABBITMQ_VHOST)=' .env)
for pair in "RABBITMQ_USER:RABBITMQ_DEFAULT_USER" "RABBITMQ_PASS:RABBITMQ_DEFAULT_PASS" "RABBITMQ_VHOST:RABBITMQ_DEFAULT_VHOST"; do
  src="${pair%%:*}"; dst="${pair##*:}"
  want="$(eval echo \$$src)"
  have="$($D inspect rabbitmq --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep "^$dst=" | head -1 | cut -d= -f2-)"
  if [ "$want" = "$have" ]; then echo "$src: MATCHES container"; else echo "$src: differs"; fi
done
