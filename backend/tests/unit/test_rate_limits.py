import time

import pytest
import redis
from flask_jwt_extended import (
    create_access_token, create_refresh_token, decode_token, get_csrf_token)

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


def login(client, ip, email=LOGIN['email'], password=LOGIN['password']):
    return client.post(
        '/api/auth/login', json={'email': email, 'password': password},
        headers={'X-Forwarded-For': ip})


@pytest.fixture
def owner_app(limited_app):
    """The limited app with a token store and one real account, owner@example.com"""
    limited_app.extensions['redis_service'] = FakeRedisService()
    with limited_app.app_context():
        user = User(email='owner@example.com')
        user.set_password('TestPassword123')
        db.session.add(user)
        db.session.commit()
    return limited_app


def test_sixth_failed_login_to_one_account_from_one_address_is_rate_limited(limited_app):
    client = limited_app.test_client()

    for _ in range(5):
        assert login(client, '203.0.113.7').status_code == 401

    response = login(client, '203.0.113.7')

    assert response.status_code == 429
    assert response.get_json()['error']['code'] == 'RATE_LIMITED'


def test_failed_logins_lock_out_only_the_address_sending_them(owner_app):
    """A stranger's wrong guesses must not keep the owner out"""
    client = owner_app.test_client()
    for _ in range(5):
        login(client, '203.0.113.7', 'owner@example.com')
    assert login(client, '203.0.113.7', 'owner@example.com').status_code == 429

    response = login(client, '198.51.100.9', 'owner@example.com', 'TestPassword123')

    assert response.status_code == 200


def test_successful_logins_do_not_count_toward_the_account_limits(owner_app):
    client = owner_app.test_client()

    statuses = [login(client, '203.0.113.7', 'owner@example.com', 'TestPassword123').status_code
                for _ in range(6)]

    assert statuses == [200] * 6


def test_failures_spread_over_many_addresses_hit_the_hourly_account_limit(limited_app, monkeypatch):
    """Guessing one account's password from a botnet stays bounded"""
    # The dummy hash would make 101 logins take seconds; the limit doesn't care
    monkeypatch.setattr('app.routes.auth.verify_password', lambda stored, given: False)
    client = limited_app.test_client()

    statuses = [login(client, f'10.0.{i // 250}.{i % 250}').status_code for i in range(101)]

    assert statuses == [401] * 100 + [429]


def test_account_limit_ignores_email_case(limited_app):
    client = limited_app.test_client()
    for _ in range(5):
        login(client, '203.0.113.7', 'Nobody@Example.com')

    assert login(client, '203.0.113.7', 'nobody@example.com').status_code == 429


def test_account_limit_covers_every_spelling_of_a_domain(limited_app):
    """An international domain and its ASCII form are one account, one bucket"""
    client = limited_app.test_client()
    for _ in range(5):
        login(client, '203.0.113.7', 'nobody@bücher.de')

    assert login(client, '203.0.113.7', 'nobody@xn--bcher-kva.de').status_code == 429


@pytest.mark.parametrize('body', [{'email': 123, 'password': 'x'}, ['not', 'an', 'object']])
def test_a_malformed_login_is_a_validation_error_not_a_crash(limited_app, body):
    """The per-account limit reads the email before the schema has checked it"""
    response = limited_app.test_client().post('/api/auth/login', json=body)

    assert response.status_code == 422


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


def register(client, ip):
    # One email throughout: after the first, each is a fast 409 that still counts
    return client.post(
        '/api/auth/register',
        json={'email': 'new@example.com', 'password': 'TestPassword123'},
        headers={'X-Forwarded-For': ip})


def test_eleventh_registration_from_one_address_in_an_hour_is_rate_limited(limited_app):
    client = limited_app.test_client()

    statuses = [register(client, '203.0.113.7').status_code for _ in range(11)]

    assert statuses == [201] + [409] * 9 + [429]


def test_registration_limit_is_per_address(limited_app):
    client = limited_app.test_client()
    for _ in range(11):
        register(client, '203.0.113.7')

    assert register(client, '198.51.100.9').status_code == 409


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
            token = create_refresh_token(
                identity=str(user.id), additional_claims={'auth_time': int(time.time())})
            app.extensions['redis_service'].store_refresh_token(
                user.id, decode_token(token)['jti'], ttl_seconds=60)
            return {
                'Cookie': f'__Secure-refresh_token={token}',
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

    @pytest.mark.parametrize('headers', [
        {'Cookie': '__Secure-refresh_token=not-a-jwt'},
        {},
    ], ids=['forged', 'missing'])
    def test_requests_without_a_valid_cookie_are_not_limited(self, refresh_app, headers):
        """They get a 401, which tells the client to sign in again"""
        client = refresh_app.test_client(use_cookies=False)

        statuses = {self.refresh(client, headers, '203.0.113.7').status_code
                    for _ in range(15)}

        assert statuses == {401}

    def test_an_access_token_in_the_cookie_is_not_limited(self, refresh_app):
        """Validly signed but the wrong type: as good as no cookie"""
        client = refresh_app.test_client(use_cookies=False)
        with refresh_app.app_context():
            access = {'Cookie': f'__Secure-refresh_token={create_access_token(identity="1")}'}

        statuses = {self.refresh(client, access, '203.0.113.7').status_code
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


def test_limits_fall_back_to_memory_when_redis_is_down(make_limited_app, monkeypatch):
    """An unreachable limiter store must not turn every request into a 500"""
    # Refuse every connection at once. A real closed port behaves the same,
    # but Windows takes ~2s to report each refusal.
    def refuse(self):
        raise redis.ConnectionError('Connection refused')
    monkeypatch.setattr(redis.connection.Connection, '_connect', refuse)

    client = make_limited_app('redis://127.0.0.1:1').test_client()

    statuses = [login(client, '203.0.113.7').status_code for _ in range(6)]

    assert statuses == [401] * 5 + [429]  # the account-and-address limit, now in memory


def test_limiter_state_is_restored(app, client):
    """The shared unit app must not inherit limits from the tests above"""
    for _ in range(6):
        response = client.post('/api/auth/login', json=LOGIN)

    assert response.status_code == 401
