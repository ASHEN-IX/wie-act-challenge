"""Connection failure privacy and real same-endpoint startup-outage recovery."""

import logging
import os
import select
import socket
import socketserver
import threading
import uuid
from urllib.parse import urlsplit

import pytest

from services import database
from utils.logger import JSONFormatter


@pytest.fixture(autouse=True)
def isolated_client(monkeypatch):
    database._get_client.cache_clear()
    yield
    database._get_client.cache_clear()


def test_connection_failure_and_required_error_do_not_disclose_secrets(
    monkeypatch, caplog
):
    secret_uri = "mongodb://synthetic:PRIVATE_DB_PASSWORD@localhost/db?tlsCertificateKeyFilePassword=PRIVATE_FILE_PASSWORD"
    monkeypatch.setattr(database, "_MONGO_URI", secret_uri)
    monkeypatch.setattr(database, "_DB_NAME", "PRIVATE_DATABASE_NAME")
    monkeypatch.setattr(
        database, "logger", logging.getLogger("database-privacy-fixture")
    )
    clients = []

    class BrokenClient:
        closed = False

        def __init__(self, *args, **kwargs):
            clients.append(self)
            self.admin = self

        def command(self, *args):
            raise RuntimeError(secret_uri)

        def close(self):
            self.closed = True

    monkeypatch.setattr(database, "MongoClient", BrokenClient)
    assert database.get_db() is None
    with pytest.raises(RuntimeError) as failure:
        database.require_db()
    rendered = str(failure.value) + "".join(
        JSONFormatter().format(r) for r in caplog.records
    )
    for secret in (
        secret_uri,
        "PRIVATE_DB_PASSWORD",
        "PRIVATE_FILE_PASSWORD",
        "PRIVATE_DATABASE_NAME",
    ):
        assert secret not in rendered
    assert len(clients) == 2 and all(c.closed for c in clients)


@pytest.mark.skipif(
    not os.getenv("P0_DATABASE_TEST_MONGODB_URI"),
    reason="isolated local Mongo URI required for real startup-outage recovery",
)
def test_same_endpoint_recovers_after_initial_network_outage(monkeypatch):
    target = urlsplit(os.environ["P0_DATABASE_TEST_MONGODB_URI"])
    assert target.scheme == "mongodb" and target.hostname in {"127.0.0.1", "localhost"}
    assert target.username is None and target.password is None
    target_address = (target.hostname, target.port or 27017)
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    name = "ednova_database_recovery_" + uuid.uuid4().hex
    monkeypatch.setattr(
        database, "_MONGO_URI", f"mongodb://127.0.0.1:{port}/?directConnection=true"
    )
    monkeypatch.setattr(database, "_DB_NAME", name)
    assert database.get_db() is None  # Real closed TCP endpoint, not a mocked ping.

    class Proxy(socketserver.BaseRequestHandler):
        def handle(self):
            with socket.create_connection(target_address, timeout=5) as upstream:
                while True:
                    readable, _, _ = select.select([self.request, upstream], [], [], 1)
                    for source in readable:
                        data = source.recv(65536)
                        if not data:
                            return
                        (upstream if source is self.request else self.request).sendall(
                            data
                        )

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    proxy = Server(("127.0.0.1", port), Proxy)
    thread = threading.Thread(target=proxy.serve_forever, daemon=True)
    thread.start()
    db = None
    try:
        db = database.require_db()  # Same endpoint/config; failed None must not stick.
        db.recovery_probe.insert_one({"fixture": "synthetic"})
        assert db.recovery_probe.find_one({"fixture": "synthetic"})
        assert database.require_db().client is db.client
    finally:
        if db is not None:
            db.client.drop_database(name)
            db.client.close()
        proxy.shutdown()
        proxy.server_close()
        thread.join(timeout=2)
