import pytest

from app import db, limiter
from tests.unit.test_app_factory import build_app

LOGIN = {'email': 'nobody@example.com', 'password': 'WrongPassword123'}


@pytest.fixture
def limited_app(monkeypatch):
    """An app with the limiter on, behind one trusted proxy like production.

    limiter is module-level and init_app flips its global enabled/initialized
    flags, which would make every other test's app start enforcing limits.
    Snapshot its state and put it back afterwards.
    """
    saved = dict(vars(limiter))
    app = build_app(
        monkeypatch,
        RATELIMIT_ENABLED=True,
        RATELIMIT_STORAGE_URI='memory://',
        TRUSTED_PROXY_COUNT=1,
    )
    with app.app_context():
        db.create_all()
    yield app
    vars(limiter).clear()
    vars(limiter).update(saved)


def login(client, ip):
    return client.post(
        '/api/auth/login', json=LOGIN, headers={'X-Forwarded-For': ip})


def test_sixth_login_in_a_minute_is_rate_limited(limited_app):
    client = limited_app.test_client()

    for _ in range(5):
        assert login(client, '203.0.113.7').status_code == 401

    response = login(client, '203.0.113.7')

    assert response.status_code == 429
    assert response.get_json()['error']['code'] == 'RATE_LIMITED'


def test_each_client_has_its_own_bucket(limited_app):
    client = limited_app.test_client()
    for _ in range(6):
        login(client, '203.0.113.7')

    assert login(client, '198.51.100.9').status_code == 401


def test_limiter_state_is_restored(app, client):
    """The shared unit app must not inherit limits from the tests above"""
    for _ in range(6):
        response = client.post('/api/auth/login', json=LOGIN)

    assert response.status_code == 401
