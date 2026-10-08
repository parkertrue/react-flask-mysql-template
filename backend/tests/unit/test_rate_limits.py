import pytest
from flask_jwt_extended import create_refresh_token, decode_token, get_csrf_token

from app import db, limiter
from app.models import User
from tests.conftest import FakeRedisService
from tests.unit.test_app_factory import build_app

LOGIN = {'email': 'nobody@example.com', 'password': 'WrongPassword123'}


@pytest.fixture
def make_limited_app(monkeypatch):
    """Build apps with the limiter on, behind one trusted proxy like production.

    limiter is module-level and init_app flips its global enabled/initialized
    flags, which would make every other test's app start enforcing limits.
    Snapshot its state and put it back afterwards.
    """
    saved = dict(vars(limiter))

    def make(storage_uri='memory://'):
        app = build_app(
            monkeypatch,
            RATELIMIT_ENABLED=True,
            RATELIMIT_STORAGE_URI=storage_uri,
            TRUSTED_PROXY_COUNT=1,
        )
        with app.app_context():
            db.create_all()
        return app

    yield make
    vars(limiter).clear()
    vars(limiter).update(saved)


@pytest.fixture
def limited_app(make_limited_app):
    return make_limited_app()


def login(client, ip, email=LOGIN['email']):
    return client.post(
        '/api/auth/login', json={**LOGIN, 'email': email},
        headers={'X-Forwarded-For': ip})


def test_sixth_login_to_one_account_in_a_minute_is_rate_limited(limited_app):
    client = limited_app.test_client()

    for _ in range(5):
        assert login(client, '203.0.113.7').status_code == 401

    response = login(client, '203.0.113.7')

    assert response.status_code == 429
    assert response.get_json()['error']['code'] == 'RATE_LIMITED'


def test_account_limit_holds_across_addresses(limited_app):
    """Spreading guesses at one account over many IPs does not help"""
    client = limited_app.test_client()

    statuses = [login(client, f'203.0.113.{i}').status_code for i in range(6)]

    assert statuses == [401] * 5 + [429]


def test_account_limit_ignores_email_case(limited_app):
    client = limited_app.test_client()
    for _ in range(5):
        login(client, '203.0.113.7', 'Nobody@Example.com')

    assert login(client, '198.51.100.9', 'nobody@example.com').status_code == 429


def test_one_address_can_log_in_to_many_accounts(limited_app):
    """An office behind one NAT gets 20 logins a minute, not 5"""
    client = limited_app.test_client()

    statuses = [login(client, '203.0.113.7', f'user{i}@example.com').status_code
                for i in range(21)]

    assert statuses == [401] * 20 + [429]


def test_each_client_has_its_own_bucket(limited_app):
    client = limited_app.test_client()
    for i in range(21):
        login(client, '203.0.113.7', f'user{i}@example.com')

    assert login(client, '198.51.100.9', 'other@example.com').status_code == 401


class TestRefreshLimit:
    """Refresh is limited per user, so a shared address never trips it"""

    @pytest.fixture
    def refresh_app(self, limited_app):
        limited_app.extensions['redis_service'] = FakeRedisService()
        return limited_app

    def refresh_headers(self, app, email):
        """Cookie and CSRF headers for a fresh, recorded refresh token"""
        with app.app_context():
            user = User(email=email)
            user.set_password('TestPassword123')
            db.session.add(user)
            db.session.commit()
            token = create_refresh_token(identity=str(user.id))
            app.extensions['redis_service'].store_refresh_token(
                user.id, decode_token(token)['jti'], ttl_seconds=60)
            return {
                'Cookie': f'refresh_token_cookie={token}',
                'X-CSRF-REFRESH-TOKEN': get_csrf_token(token),
            }

    def refresh(self, client, headers, ip):
        return client.post(
            '/api/auth/refresh', headers={**headers, 'X-Forwarded-For': ip})

    def test_eleventh_refresh_by_one_user_is_rate_limited(self, refresh_app):
        # No cookie jar: every request replays the first token. After it
        # rotates, the replays are revoked (401) but still count.
        client = refresh_app.test_client(use_cookies=False)
        headers = self.refresh_headers(refresh_app, 'a@example.com')

        statuses = [self.refresh(client, headers, f'203.0.113.{i}').status_code
                    for i in range(11)]

        assert statuses == [200] + [401] * 9 + [429]

    def test_users_sharing_an_address_have_their_own_buckets(self, refresh_app):
        client = refresh_app.test_client(use_cookies=False)
        first = self.refresh_headers(refresh_app, 'a@example.com')
        for _ in range(11):
            self.refresh(client, first, '203.0.113.7')

        second = self.refresh_headers(refresh_app, 'b@example.com')

        assert self.refresh(client, second, '203.0.113.7').status_code == 200

    def test_requests_without_a_valid_cookie_are_not_limited(self, refresh_app):
        """They get a 401, which tells the client to sign in again"""
        client = refresh_app.test_client(use_cookies=False)
        forged = {'Cookie': 'refresh_token_cookie=not-a-jwt'}

        statuses = {self.refresh(client, forged, '203.0.113.7').status_code
                    for _ in range(15)}

        assert statuses == {401}


def test_unlimited_routes_have_no_per_ip_quota(limited_app):
    """Only routes that declare a limit have one.

    A default quota would fail the container healthcheck, which polls every
    10s from one address, and lock out every user behind a shared NAT.
    """
    client = limited_app.test_client()

    statuses = {client.get('/api/health').status_code for _ in range(250)}

    assert statuses == {200}


def test_limits_fall_back_to_memory_when_redis_is_down(make_limited_app):
    """An unreachable limiter store must not turn every request into a 500"""
    client = make_limited_app('redis://127.0.0.1:1').test_client()

    statuses = [login(client, '203.0.113.7').status_code for _ in range(6)]

    assert statuses == [401] * 5 + [429]  # the account limit, now in memory


def test_limiter_state_is_restored(app, client):
    """The shared unit app must not inherit limits from the tests above"""
    for _ in range(6):
        response = client.post('/api/auth/login', json=LOGIN)

    assert response.status_code == 401
