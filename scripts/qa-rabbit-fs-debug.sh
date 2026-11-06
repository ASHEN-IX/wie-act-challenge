#!/usr/bin/env bash
# Why is /var/lib/rabbitmq/.erlang.cookie unreadable? Inspect the volume and the
# image's own entrypoint expectations without starting the daemon.
set -u
D="docker --context default"

echo "=== volume ownership as seen from a root shell ==="
$D run --rm -v ednova-qa-rabbitmq-data:/var/lib/rabbitmq busybox:latest \
  sh -c 'ls -la /var/lib/rabbitmq 2>&1 | head -8; echo "---"; stat -c "%U:%G %a %n" /var/lib/rabbitmq 2>&1' 2>&1 | tail -10

echo
echo "=== image user and data dir in the pristine image ==="
$D run --rm --entrypoint sh rabbitmq:3-management \
  -c 'id; echo "---"; ls -la /var/lib/rabbitmq 2>&1 | head -6' 2>&1 | tail -10

echo
echo "=== does the image create the cookie itself on first boot? ==="
$D run --rm --entrypoint sh rabbitmq:3-management \
  -c 'grep -nE "erlang.cookie|chown|chmod" /usr/local/bin/docker-entrypoint.sh 2>/dev/null | head -10' 2>&1 | tail -12
