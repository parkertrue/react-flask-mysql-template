"""Timestamps are UTC whatever MySQL's own time zone, which SQLite lacks."""
from datetime import datetime, timedelta, timezone

from flask_jwt_extended import create_access_token
from sqlalchemy import text


def test_connections_use_utc(integration_db):
    """Without the pin the session follows the server, reported as SYSTEM"""
    with integration_db.engine.connect() as conn:
        assert conn.execute(text('SELECT @@session.time_zone')).scalar() == '+00:00'


def test_note_timestamp_is_sent_as_utc(integration_client, integration_user):
    token = create_access_token(identity=str(integration_user.id))

    response = integration_client.post(
        '/api/notes', json={'content': 'hello'},
        headers={'Authorization': f'Bearer {token}'})

    sent = datetime.fromisoformat(response.get_json()['created_at'])
    assert sent.utcoffset() == timedelta(0)
    assert abs(datetime.now(timezone.utc) - sent) < timedelta(minutes=1)
