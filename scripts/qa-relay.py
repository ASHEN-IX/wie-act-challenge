#!/usr/bin/env python3
"""Expose host loopback services to the Docker bridge.

The QA services bind 127.0.0.1 only, so containers cannot reach them through
host.docker.internal. This relay listens on the bridge gateway address and
forwards to host loopback. It changes no existing service and needs no
privileges beyond an ordinary port bind above 1024.

Usage: qa-relay.py <bind-ip> <port> [<port> ...]
Stops on SIGTERM/SIGINT.
"""
import asyncio
import signal
import sys

TARGET_HOST = "127.0.0.1"
BUFFER = 65536


async def pump(reader, writer):
    try:
        while True:
            chunk = await reader.read(BUFFER)
            if not chunk:
                break
            writer.write(chunk)
            await writer.drain()
    except (ConnectionResetError, BrokenPipeError, asyncio.CancelledError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def handle(client_reader, client_writer, target_port):
    try:
        upstream_reader, upstream_writer = await asyncio.open_connection(
            TARGET_HOST, target_port
        )
    except OSError:
        client_writer.close()
        return
    await asyncio.gather(
        pump(client_reader, upstream_writer),
        pump(upstream_reader, client_writer),
    )


async def main():
    bind_ip = sys.argv[1]
    ports = [int(p) for p in sys.argv[2:]]
    if not ports:
        print("no ports given", file=sys.stderr)
        return 1
    servers = []
    for port in ports:
        server = await asyncio.start_server(
            lambda r, w, p=port: handle(r, w, p), bind_ip, port
        )
        servers.append(server)
        print(f"relay {bind_ip}:{port} -> {TARGET_HOST}:{port}", flush=True)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    await stop.wait()
    for server in servers:
        server.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
