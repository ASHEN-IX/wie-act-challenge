"""Verification-only guard: permit loopback sockets, deny external providers."""

import socket, ipaddress

_original_connect = socket.socket.connect
_original_connect_ex = socket.socket.connect_ex


def _check(address):
    if not isinstance(address, tuple):
        return
    host = address[0]
    if host == "localhost":
        return
    try:
        if ipaddress.ip_address(host).is_loopback:
            return
    except ValueError:
        pass
    raise PermissionError("External network disabled by P0-R2 verification harness")


def _connect(self, address):
    _check(address)
    return _original_connect(self, address)


def _connect_ex(self, address):
    _check(address)
    return _original_connect_ex(self, address)


socket.socket.connect = _connect
socket.socket.connect_ex = _connect_ex
