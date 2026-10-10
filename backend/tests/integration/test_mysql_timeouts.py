"""A hung query is cut off, which only a real MySQL can show."""
import time

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from app.config import IntegrationConfig


def test_a_query_that_hangs_is_cut_off(integration_db, monkeypatch):
    """SLEEP stands in for a database stalled on a full disk or a lock"""
    monkeypatch.setenv('DB_QUERY_TIMEOUT', '1')
    config = IntegrationConfig()
    engine = create_engine(config.SQLALCHEMY_DATABASE_URI, **config.SQLALCHEMY_ENGINE_OPTIONS)
    started = time.monotonic()

    try:
        with pytest.raises(OperationalError) as error, engine.connect() as conn:
            conn.execute(text('SELECT SLEEP(10)'))
    finally:
        engine.dispose()

    assert error.value.orig.args[0] == 2013  # CR_SERVER_LOST: the read timed out
    assert time.monotonic() - started < 5
