import json


LOGIN_PAYLOAD = {
    'email': 'integration@test.com',
    'password': 'TestPassword123'
}


def _login(client):
    return client.post(
        '/api/auth/login',
        data=json.dumps(LOGIN_PAYLOAD),
        content_type='application/json'
    )


def _token_keys(redis_service, user_id):
    return list(
        redis_service.get_client().scan_iter(f'refresh_token:{user_id}:*'))


class TestRedisTokenStorage:
    """Test token storage in Redis"""

    def test_login_stores_refresh_token_in_redis(
        self, integration_client, integration_user, integration_redis
    ):
        """Login should store the refresh token JTI in Redis"""
        response = _login(integration_client)

        assert response.status_code == 200

        cookies = response.headers.getlist('Set-Cookie')
        refresh_cookie = next(
            (c for c in cookies if 'refresh_token_cookie' in c), None)
        assert refresh_cookie is not None

        assert len(_token_keys(integration_redis, integration_user.id)) == 1

    def test_logout_revokes_token_in_redis(
        self, integration_client, integration_user, integration_redis
    ):
        """Logout should remove the refresh token from Redis"""
        assert _login(integration_client).status_code == 200
        assert len(_token_keys(integration_redis, integration_user.id)) == 1

        integration_client.post('/api/auth/logout')

        assert len(_token_keys(integration_redis, integration_user.id)) == 0

    def test_logout_all_revokes_all_user_tokens(
        self, integration_client, integration_user, integration_redis
    ):
        """Logout-all should remove every token for the user"""
        # Simulate three separate devices
        for _ in range(3):
            _login(integration_client)

        assert len(_token_keys(integration_redis, integration_user.id)) == 3

        integration_client.post('/api/auth/logout-all')

        assert len(_token_keys(integration_redis, integration_user.id)) == 0


class TestTokenRotation:
    """Test refresh token rotation"""

    def test_refresh_revokes_old_token(
        self, integration_client, integration_user, integration_redis
    ):
        """Refreshing should revoke the old token and issue exactly one new one"""
        assert _login(integration_client).status_code == 200

        keys_before = _token_keys(integration_redis, integration_user.id)
        old_jti = keys_before[0].split(':')[-1]

        refresh_response = integration_client.post('/api/auth/refresh')
        assert refresh_response.status_code == 200

        keys_after = _token_keys(integration_redis, integration_user.id)
        new_jti = keys_after[0].split(':')[-1]

        assert old_jti != new_jti
        assert len(keys_after) == 1


class TestBlocklistFailsClosed:
    """The blocklist must reject tokens it cannot verify"""

    def test_revoked_refresh_token_is_rejected(
        self, integration_client, integration_user, integration_redis
    ):
        """A refresh token deleted from Redis must no longer be accepted"""
        assert _login(integration_client).status_code == 200

        for key in _token_keys(integration_redis, integration_user.id):
            integration_redis.get_client().delete(key)

        response = integration_client.post('/api/auth/refresh')
        assert response.status_code == 401
