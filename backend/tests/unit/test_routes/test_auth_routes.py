import json
from unittest.mock import patch

from sqlalchemy import select, func
from werkzeug.security import check_password_hash

from app.models import User
from app.routes import auth as auth_routes


class TestRegisterEndpoint:
    """Test suite for POST /api/auth/register endpoint."""

    def test_register_success(self, client, db):
        """Valid registration should create user and return 201."""
        payload = {
            'email': 'newuser@example.com',
            'password': 'ValidPass123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['message'] == 'User created'

    def test_register_creates_user_in_database(self, client, db):
        """Registration should persist user to database."""
        initial_count = db.session.scalar(
            select(func.count()).select_from(User)
        )

        payload = {
            'email': 'dbuser@example.com',
            'password': 'ValidPass123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 201

        new_count = db.session.scalar(
            select(func.count()).select_from(User)
        )
        assert new_count == initial_count + 1

        # Verify user exists with correct email
        user = db.session.execute(
            select(User).where(User.email == 'dbuser@example.com')
        ).scalar_one_or_none()
        assert user is not None
        assert user.email == 'dbuser@example.com'

    def test_register_hashes_password(self, client, db):
        """Registration should hash the password."""
        payload = {
            'email': 'hashtest@example.com',
            'password': 'PlainTextPass123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 201

        user = db.session.execute(
            select(User).where(User.email == 'hashtest@example.com')
        ).scalar_one()

        assert user.password_hash != 'PlainTextPass123'
        assert user.check_password('PlainTextPass123')

    def test_register_duplicate_email(self, client, sample_user):
        """Registering with existing email should return 409."""
        payload = {
            'email': 'test@example.com',  # sample_user email
            'password': 'DifferentPass123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 409
        data = json.loads(response.data)
        assert data['error']['code'] == 'EMAIL_ALREADY_REGISTERED'
        assert 'already registered' in data['error']['message'].lower()

    def test_register_invalid_email(self, client):
        """Registration with invalid email should return 422."""
        payload = {
            'email': 'not-an-email',
            'password': 'ValidPass123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_missing_email(self, client):
        """Registration without email should return 422."""
        payload = {
            'password': 'ValidPass123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_missing_password(self, client):
        """Registration without password should return 422."""
        payload = {
            'email': 'test@example.com'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_password_too_short(self, client):
        """Password under 8 characters should be rejected."""
        payload = {
            'email': 'test@example.com',
            'password': 'Short1'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_password_no_uppercase(self, client):
        """Password without uppercase should be rejected."""
        payload = {
            'email': 'test@example.com',
            'password': 'nouppercase123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_password_no_lowercase(self, client):
        """Password without lowercase should be rejected."""
        payload = {
            'email': 'test@example.com',
            'password': 'NOLOWERCASE123'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_password_no_number(self, client):
        """Password without number should be rejected."""
        payload = {
            'email': 'test@example.com',
            'password': 'NoNumbersHere'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_extra_fields(self, client):
        """Extra fields should be rejected."""
        payload = {
            'email': 'test@example.com',
            'password': 'ValidPass123',
            'extra_field': 'should fail'
        }

        response = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_register_invalid_json(self, client):
        """Invalid JSON should return 400."""
        response = client.post(
            '/api/auth/register',
            data='not valid json{',
            content_type='application/json'
        )

        assert response.status_code == 400

class TestLoginEndpoint:
    """Test suite for POST /api/auth/login endpoint."""

    def test_login_success(self, client, sample_user):
        """Valid credentials should return access token and 200."""
        payload = {
            'email': 'test@example.com',
            'password': 'TestPassword123'
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'access_token' in data
        assert 'refresh_csrf' in data
        assert len(data['access_token']) > 0

    def test_login_sets_refresh_cookie(self, client, sample_user):
        """Login should set refresh token as HttpOnly cookie."""
        payload = {
            'email': 'test@example.com',
            'password': 'TestPassword123'
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 200

        cookies = response.headers.getlist('Set-Cookie')
        # Only the refresh cookie, HttpOnly. The CSRF value travels in the
        # body, so no script-readable CSRF cookie is set.
        assert len(cookies) == 1
        assert cookies[0].startswith('refresh_token_cookie=')
        assert 'HttpOnly' in cookies[0]

    def test_login_wrong_password(self, client, sample_user):
        """Wrong password should return 401."""
        payload = {
            'email': 'test@example.com',
            'password': 'WrongPassword123'
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error']['code'] == 'INVALID_CREDENTIALS'

    def test_login_nonexistent_user(self, client):
        """Login with non-existent email should return 401."""
        payload = {
            'email': 'nonexistent@example.com',
            'password': 'SomePassword123'
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error']['code'] == 'INVALID_CREDENTIALS'

    def test_login_nonexistent_user_still_hashes(self, client):
        """Skipping the hash would make unknown emails measurably faster."""
        payload = {
            'email': 'nonexistent@example.com',
            'password': 'SomePassword123'
        }

        with patch('app.routes.auth.check_password_hash',
                   wraps=check_password_hash) as check:
            response = client.post('/api/auth/login', json=payload)

        assert response.status_code == 401
        check.assert_called_once_with(
            auth_routes._DUMMY_PASSWORD_HASH, 'SomePassword123')

    def test_login_invalid_email_format(self, client):
        """Invalid email format should return 422."""
        payload = {
            'email': 'not-an-email',
            'password': 'SomePassword123'
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_login_missing_email(self, client):
        """Missing email should return 422."""
        payload = {
            'password': 'SomePassword123'
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_login_missing_password(self, client):
        """Missing password should return 422."""
        payload = {
            'email': 'test@example.com'
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 422

    def test_login_case_sensitive_password(self, client, sample_user):
        """Password should be case-sensitive."""
        payload = {
            'email': 'test@example.com',
            'password': 'testpassword123'  # Wrong case
        }

        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 401

LOGIN_PAYLOAD = {'email': 'test@example.com', 'password': 'TestPassword123'}


def login(client):
    """Log in as sample_user; return the refresh CSRF header to send back."""
    response = client.post('/api/auth/login', json=LOGIN_PAYLOAD)
    assert response.status_code == 200
    return {'X-CSRF-REFRESH-TOKEN': response.get_json()['refresh_csrf']}


class TestRefreshEndpoint:
    """Test suite for POST /api/auth/refresh endpoint."""

    def test_refresh_returns_working_access_token(self, client, sample_user, fake_redis):
        csrf = login(client)

        response = client.post('/api/auth/refresh', headers=csrf)

        assert response.status_code == 200
        token = response.get_json()['access_token']
        notes = client.get('/api/notes', headers={'Authorization': f'Bearer {token}'})
        assert notes.status_code == 200

    def test_refresh_rotates_csrf_token(self, client, sample_user, fake_redis):
        """Each refresh token carries its own CSRF value; clients must store the new one"""
        csrf = login(client)

        response = client.post('/api/auth/refresh', headers=csrf)

        new_csrf = response.get_json()['refresh_csrf']
        assert new_csrf != csrf['X-CSRF-REFRESH-TOKEN']

    def test_second_refresh_requires_rotated_csrf(self, client, sample_user, fake_redis):
        csrf = login(client)
        first = client.post('/api/auth/refresh', headers=csrf)
        new_csrf = {'X-CSRF-REFRESH-TOKEN': first.get_json()['refresh_csrf']}

        stale = client.post('/api/auth/refresh', headers=csrf)
        fresh = client.post('/api/auth/refresh', headers=new_csrf)

        assert stale.status_code == 401
        assert fresh.status_code == 200

    def test_refresh_revokes_previous_token(self, client, sample_user, fake_redis):
        csrf = login(client)
        (old,) = fake_redis.tokens

        client.post('/api/auth/refresh', headers=csrf)

        assert old not in fake_redis.tokens
        assert len(fake_redis.tokens) == 1

    def test_refresh_without_csrf_header(self, client, sample_user, fake_redis):
        login(client)

        response = client.post('/api/auth/refresh')

        assert response.status_code == 401

    def test_refresh_without_cookie(self, client):
        response = client.post('/api/auth/refresh')

        assert response.status_code == 401
        assert response.get_json()['error']['code'] == 'AUTH_MISSING_TOKEN'

    def test_refresh_fails_closed_without_redis(self, client, sample_user):
        """With no Redis there is no allowlist, so every refresh token is revoked"""
        csrf = login(client)

        response = client.post('/api/auth/refresh', headers=csrf)

        assert response.status_code == 401
        assert response.get_json()['error']['code'] == 'AUTH_TOKEN_REVOKED'


class TestLogoutEndpoint:
    """Test suite for POST /api/auth/logout and /api/auth/logout-all."""

    def test_logout_revokes_token_and_clears_cookies(self, client, sample_user, fake_redis):
        csrf = login(client)

        response = client.post('/api/auth/logout', headers=csrf)

        assert response.status_code == 200
        assert response.get_json()['message'] == 'Logged out'
        assert fake_redis.tokens == set()
        cleared = response.headers.getlist('Set-Cookie')
        assert any(c.startswith('refresh_token_cookie=;') for c in cleared)

    def test_refresh_after_logout_is_rejected(self, client, sample_user, fake_redis):
        csrf = login(client)
        refresh_cookie = client.get_cookie('refresh_token_cookie', path='/api/auth').value
        client.post('/api/auth/logout', headers=csrf)

        # Replay the logged-out token, as a stolen cookie would be
        client.set_cookie('refresh_token_cookie', refresh_cookie, path='/api/auth')
        response = client.post('/api/auth/refresh', headers=csrf)

        assert response.status_code == 401
        assert response.get_json()['error']['code'] == 'AUTH_TOKEN_REVOKED'

    def test_clear_cookies_expires_refresh_cookies(self, client, sample_user, fake_redis):
        login(client)

        response = client.post('/api/auth/clear-cookies', json={})

        assert response.status_code == 200
        cleared = response.headers.getlist('Set-Cookie')
        assert any(c.startswith('refresh_token_cookie=;') for c in cleared)
        assert client.get_cookie('refresh_token_cookie', path='/api/auth') is None

    def test_clear_cookies_needs_no_token(self, client):
        response = client.post('/api/auth/clear-cookies', json={})

        assert response.status_code == 200

    def test_clear_cookies_rejects_form_posts(self, client):
        """A cross-site form can send this without a preflight; JSON can't"""
        response = client.post(
            '/api/auth/clear-cookies', data={'x': '1'})

        assert response.status_code == 415
        assert 'Set-Cookie' not in response.headers

    def test_logout_without_cookie(self, client):
        response = client.post('/api/auth/logout')

        assert response.status_code == 401

    def test_logout_all_revokes_every_session(self, client, app, sample_user, fake_redis):
        other_device = app.test_client()
        login(other_device)
        csrf = login(client)
        assert len(fake_redis.tokens) == 2

        response = client.post('/api/auth/logout-all', headers=csrf)

        assert response.status_code == 200
        assert response.get_json()['message'] == 'Logged out from 2 device(s)'
        assert fake_redis.tokens == set()

    def test_logout_all_leaves_other_users_sessions(self, client, app, sample_user, second_user, fake_redis):
        other_user = app.test_client()
        other_user.post('/api/auth/login', json={
            'email': 'other@example.com', 'password': 'OtherPassword123'})
        csrf = login(client)

        client.post('/api/auth/logout-all', headers=csrf)

        assert [uid for uid, _ in fake_redis.tokens] == [second_user.id]


class TestAuthenticationFlow:
    """Test complete authentication workflows."""

    def test_register_login_flow(self, client, db):
        """Complete flow: register -> login -> access protected resource."""
        # Register
        register_payload = {
            'email': 'flowtest@example.com',
            'password': 'FlowTest123'
        }

        register_response = client.post(
            '/api/auth/register',
            data=json.dumps(register_payload),
            content_type='application/json'
        )
        assert register_response.status_code == 201

        # Login
        login_payload = {
            'email': 'flowtest@example.com',
            'password': 'FlowTest123'
        }

        login_response = client.post(
            '/api/auth/login',
            data=json.dumps(login_payload),
            content_type='application/json'
        )
        assert login_response.status_code == 200

        login_data = json.loads(login_response.data)
        access_token = login_data['access_token']

        # Access protected resource
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        notes_response = client.get('/api/notes', headers=headers)
        assert notes_response.status_code == 200

    def test_cannot_register_same_email_twice(self, client):
        """Attempting to register same email twice should fail."""
        payload = {
            'email': 'duplicate@example.com',
            'password': 'ValidPass123'
        }

        # First registration
        response1 = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )
        assert response1.status_code == 201

        # Second registration with same email
        response2 = client.post(
            '/api/auth/register',
            data=json.dumps(payload),
            content_type='application/json'
        )
        assert response2.status_code == 409

    def test_password_change_workflow(self, client, sample_user, db):
        """User should not be able to login with old password after change."""
        # Change password directly in database
        sample_user.set_password('NewPassword123')
        db.session.commit()

        # Try login with old password
        old_payload = {
            'email': 'test@example.com',
            'password': 'TestPassword123'
        }

        old_response = client.post(
            '/api/auth/login',
            data=json.dumps(old_payload),
            content_type='application/json'
        )
        assert old_response.status_code == 401

        # Login with new password should work
        new_payload = {
            'email': 'test@example.com',
            'password': 'NewPassword123'
        }

        new_response = client.post(
            '/api/auth/login',
            data=json.dumps(new_payload),
            content_type='application/json'
        )
        assert new_response.status_code == 200


class TestSignInWithoutRedis:
    """A refresh token Redis never recorded would end the session silently at
    the access token's expiry, so sign-in refuses with 503 instead."""

    def assert_unavailable(self, response):
        assert response.status_code == 503
        assert response.get_json()['error']['code'] == 'SERVICE_UNAVAILABLE'
        assert 'Set-Cookie' not in response.headers

    def test_login_when_redis_is_down(self, app, client, sample_user, monkeypatch):
        monkeypatch.setitem(app.config, 'REDIS_ENABLED', True)
        # Stops get_redis_service() from trying to connect for real
        monkeypatch.setitem(app.extensions, 'redis_retry_at', float('inf'))

        self.assert_unavailable(client.post('/api/auth/login', json=LOGIN_PAYLOAD))

    def test_login_when_redis_rejects_the_write(
            self, client, sample_user, fake_redis, monkeypatch):
        monkeypatch.setattr(fake_redis, 'store_refresh_token', lambda *a, **k: False)

        self.assert_unavailable(client.post('/api/auth/login', json=LOGIN_PAYLOAD))

    def test_refresh_when_redis_rejects_the_write(
            self, client, sample_user, fake_redis, monkeypatch):
        csrf = login(client)
        monkeypatch.setattr(fake_redis, 'store_refresh_token', lambda *a, **k: False)

        self.assert_unavailable(client.post('/api/auth/refresh', headers=csrf))
