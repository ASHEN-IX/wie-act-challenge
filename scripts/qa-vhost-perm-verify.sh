#!/usr/bin/env bash
# Create a vhost exactly as the harness does, then VERIFY the permission row
# exists before connecting. Prints the permission listing so a silent failure
# is visible.
set -u
D="docker --context default"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
. <(grep -E '^RABBITMQ_PASS=' .env)
V="test_formula_perm_$(date +%s)"

echo "=== add_vhost (full output, incl. stderr) ==="
$D exec rabbitmq rabbitmqctl add_vhost "$V" 2>&1 | tail -3

echo "=== set_permissions (full output, incl. stderr) ==="
$D exec rabbitmq rabbitmqctl set_permissions -p "$V" mindflow '.*' '.*' '.*' 2>&1 | tail -3

echo "=== verify row ==="
$D exec rabbitmq rabbitmqctl list_permissions -p "$V" 2>&1 | tail -4

echo "=== vhost limits / state ==="
$D exec rabbitmq rabbitmqctl list_vhosts name tracing 2>&1 | grep "$V" || echo "vhost row not listed"

echo "=== cleanup ==="
$D exec rabbitmq rabbitmqctl delete_vhost "$V" 2>&1 | tail -1
