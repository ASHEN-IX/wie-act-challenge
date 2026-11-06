#!/usr/bin/env bash
# Determine the address a container must use to reach host services, and
# whether the host can bind a relay there without touching existing services.
set -u
D="docker --context default"

echo "=== docker bridge gateway ==="
$D network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>&1

echo
echo "=== current listeners (who owns 5672 / 27017) ==="
ss -ltnp 2>/dev/null | grep -E ':5672|:27017' || netstat -ltn 2>/dev/null | grep -E ':5672|:27017' || echo "ss/netstat unavailable"

echo
echo "=== can the host bind the bridge IP itself? (test with python, no service started) ==="
GW=$($D network inspect bridge --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null)
echo "gateway=$GW"
python3 - "$GW" <<'PY'
import socket, sys
gw = sys.argv[1].strip()
if not gw:
    print("no gateway"); raise SystemExit
s = socket.socket()
try:
    s.bind((gw, 0))
    print(f"can bind {gw}:<ephemeral> -> relay is viable")
except Exception as e:
    print("cannot bind:", type(e).__name__, e)
finally:
    s.close()
PY
