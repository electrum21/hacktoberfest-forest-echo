"""Offline mode: prove nothing leaves your own network.

With OFFLINE_MODE=true the API refuses every outbound TCP connection to a non-local address
(anything other than loopback or private LAN ranges). If BirdNET, a library or a typo ever tried to
reach the internet, it fails loudly here instead of "working" because your Wi-Fi happened to be on.
It does not stop incoming connections, so your phone can still reach the server over the local network.
(DNS lookups are not intercepted; only connections are.)
"""
from __future__ import annotations

import ipaddress
import logging
import socket

log = logging.getLogger(__name__)


class OfflineViolation(OSError):
    """An outbound connection to a non-local address was blocked."""


def is_local_address(host: str) -> bool:
    if host in ("", "localhost"):
        return True
    try:
        ip = ipaddress.ip_address(host.split("%")[0])  # strip IPv6 zone id
    except ValueError:
        return False
    return ip.is_private or ip.is_loopback or ip.is_link_local


_originals: dict[str, object] = {}


def install_guard() -> None:
    if _originals:
        return
    _originals["connect"] = socket.socket.connect
    _originals["connect_ex"] = socket.socket.connect_ex

    def check(address) -> None:
        if isinstance(address, tuple) and address and not is_local_address(str(address[0])):
            log.warning("OFFLINE_MODE blocked an outbound connection to %s", address[0])
            raise OfflineViolation(f"OFFLINE_MODE: outbound connection to {address[0]} blocked")

    def connect(self, address):
        check(address)
        return _originals["connect"](self, address)

    def connect_ex(self, address):
        check(address)
        return _originals["connect_ex"](self, address)

    socket.socket.connect = connect
    socket.socket.connect_ex = connect_ex


def uninstall_guard() -> None:
    """For tests."""
    if _originals:
        socket.socket.connect = _originals.pop("connect")
        socket.socket.connect_ex = _originals.pop("connect_ex")
