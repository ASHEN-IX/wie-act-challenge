"""Connection failure privacy and same-endpoint startup-outage recovery for `services.pg`."""

import logging
import os

import pytest

from services import pg
from tests.conftest import needs_postgres
from utils.logger import JSONFormatter

SECRET_URL = "postgresql://synthetic:PRIVATE_DB_PASSWORD@127.0.0.1:1/PRIVATE_DATABASE_NAME"


@pytest.fixture(autouse=True)
def isolated_pool(monkeypatch):
    monkeypatch.delenv("AI_DATABASE_URL", raising=False)
    pg.reset_for_tests()
    yield
    pg.reset_for_tests()


def test_unconfigured_database_is_unavailable_not_an_error_with_a_url():
    assert pg.configured() is False
    with pytest.raises(pg.PgUnavailable):
        with pg.connection():
            pass


def test_connection_failure_does_not_disclose_secrets(monkeypatch, caplog):
    monkeypatch.setenv("AI_DATABASE_URL", SECRET_URL)
    monkeypatch.setenv("AI_DATABASE_POOL_MAX", "1")
    monkeypatch.setattr(pg, "logger", logging.getLogger("pg-privacy-fixture"))
    with caplog.at_level(logging.DEBUG, logger="pg-privacy-fixture"):
        with pytest.raises(pg.PgUnavailable) as failure:
            with pg.connection():
                pass
    rendered = str(failure.value) + "".join(JSONFormatter().format(r) for r in caplog.records)
    for secret in (SECRET_URL, "PRIVATE_DB_PASSWORD", "PRIVATE_DATABASE_NAME"):
        assert secret not in rendered
    # `from None`: the driver error that carried the URL is not chained.
    assert failure.value.__cause__ is None


@needs_postgres
def test_startup_outage_is_recoverable_on_the_same_process(monkeypatch):
    """A failed first connect must not poison later attempts once the endpoint is up."""
    monkeypatch.setenv("AI_DATABASE_URL", SECRET_URL)
    with pytest.raises(pg.PgUnavailable):
        with pg.connection():
            pass
    pg.reset_for_tests()
    monkeypatch.setenv("AI_DATABASE_URL", os.environ["AI_TEST_DATABASE_URL"])
    with pg.connection() as conn:
        assert conn.execute("SELECT 1 AS one").fetchone()["one"] == 1
