"""Pooled connections MySQL has dropped, which SQLite never does."""
from sqlalchemy import text


def test_request_survives_a_connection_mysql_dropped(integration_app, integration_db):
    """A dead pooled connection is replaced, not handed to the next request.

    MySQL drops connections on wait_timeout, restarts and network blips. Here
    it kills the one connection the pool holds, as if it had been idle too
    long; pool_pre_ping must notice before the query runs.
    """
    engine = integration_db.engine
    engine.dispose()
    with engine.connect() as conn:
        pooled_id = conn.execute(text('SELECT CONNECTION_ID()')).scalar()

    killer = engine.pool._creator()  # a raw connection outside the pool
    try:
        with killer.cursor() as cursor:
            cursor.execute(f'KILL {int(pooled_id)}')
    finally:
        killer.close()

    with engine.connect() as conn:
        current_id = conn.execute(text('SELECT CONNECTION_ID()')).scalar()

    assert current_id != pooled_id
