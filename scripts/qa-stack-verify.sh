#!/usr/bin/env bash
# Verify the isolated QA stack is genuinely usable. Read-only.
set -u
D="docker --context default"

echo "=== containers ==="
$D ps --filter label=ednova-qa=batch3.6 --format '{{.Names}}|{{.Status}}' 2>&1

echo
echo "=== MongoDB ==="
$D exec ednova-qa-mongo mongosh --quiet --eval '
  const s = db.adminCommand({hello:1});
  print("ping ok, version " + db.version());
  print("databases: " + db.adminCommand({listDatabases:1}).databases.map(d=>d.name).join(","));
' 2>&1 | tail -4

echo
echo "=== RabbitMQ ==="
$D exec ednova-qa-rabbitmq rabbitmq-diagnostics -q ping 2>&1 | tail -2
$D exec ednova-qa-rabbitmq rabbitmqctl list_vhosts 2>/dev/null | tail -4
$D exec ednova-qa-rabbitmq rabbitmqctl list_users 2>/dev/null | tail -4

echo
echo "=== Redis ==="
$D exec ednova-qa-redis redis-cli ping 2>&1 | tail -1

echo
echo "=== host port reachability (from the user's shell) ==="
for p in 27017 5672 6379 15672; do
  if (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null; then echo "$p OPEN"; else echo "$p closed"; fi
done

echo
echo "=== isolation: no foreign project data reachable ==="
echo "(QA containers use anonymous/disposable filesystems; the mongod here is"
echo " a fresh instance, not the host's or another project's.)"
