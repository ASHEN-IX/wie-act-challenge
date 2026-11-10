#!/usr/bin/env bash
# Stops only the demo stack (ports 3100, 3101, 8100).
pkill -f 'demo/web-server[.]sh' 2>/dev/null
for port in 3100 3101 8100; do
  pid=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$pid" ] && kill "$pid" && echo "stopped :$port"
done
exit 0
