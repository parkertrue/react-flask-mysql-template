import time

import pytest
from unittest.mock import patch, MagicMock
import redis

from app.utils.redis_service import RedisService


class TestRedisServiceInitialization:
    """Test RedisService initialization"""

    def test_init_success(self):
        """Redis should initialize successfully with valid config"""
        with patch('app.utils.redis_service.redis.Redis') as mock_redis_class:
            mock_client = MagicMock()
            mock_redis_class.return_value = mock_client
            mock_client.ping.return_value = True

            service = RedisService(
                host='localhost',
                port=6379,
                db=0,
                password='testpass',
                max_connections=50
            )

            assert service._client is not None
            mock_client.ping.assert_called_once()

    def test_init_with_all_parameters(self):
        """Redis should accept all initialization parameters"""
        with patch('app.utils.redis_service.redis.Redis') as mock_redis_class:
            mock_client = MagicMock()
            mock_redis_class.return_value = mock_client
            mock_client.ping.return_value = True

            RedisService(
                host='redishost',
                port=6380,
                db=2,
                password='mypassword',
                max_connections=100
            )

            # Verify Redis was called with correct parameters
            mock_redis_class.assert_called_once()
            call_kwargs = mock_redis_class.call_args[1]
            assert call_kwargs['host'] == 'redishost'
            assert call_kwargs['port'] == 6380
            assert call_kwargs['db'] == 2
            assert call_kwargs['password'] == 'mypassword'
            assert call_kwargs['max_connections'] == 100

    def test_init_connection_failure(self):
        """Redis should raise RuntimeError on connection failure"""
        with patch('app.utils.redis_service.redis.Redis') as mock_redis_class:
            mock_client = MagicMock()
            mock_redis_class.return_value = mock_client
            mock_client.ping.side_effect = redis.RedisError(
                'Connection failed')

            with pytest.raises(RuntimeError) as exc_info:
                RedisService(
                    host='localhost',
                    port=6379,
                    db=0,
                    password='testpass',
                    max_connections=50
                )

            assert 'Failed to connect to Redis' in str(exc_info.value)

    def test_init_exception(self):
        """Redis should raise RuntimeError on unexpected exceptions"""
        with patch('app.utils.redis_service.redis.Redis') as mock_redis_class:
            mock_redis_class.side_effect = Exception('Unexpected error')

            with pytest.raises(RuntimeError) as exc_info:
                RedisService(
                    host='localhost',
                    port=6379,
                    db=0,
                    password='testpass',
                    max_connections=50
                )

            assert 'Redis initialization failed' in str(exc_info.value)

    def test_get_client(self):
        """get_client should return the Redis client"""
        with patch('app.utils.redis_service.redis.Redis') as mock_redis_class:
            mock_client = MagicMock()
            mock_redis_class.return_value = mock_client
            mock_client.ping.return_value = True

            service = RedisService(
                host='localhost',
                port=6379,
                db=0,
                password='testpass',
                max_connections=50
            )
            client = service.get_client()

            assert client is mock_client


class TestTokenManagement:
    """Test token management operations"""

    @pytest.fixture
    def service(self):
        """Create a RedisService instance with mocked client"""
        with patch('app.utils.redis_service.redis.Redis') as mock_redis_class:
            mock_client = MagicMock()
            mock_redis_class.return_value = mock_client
            mock_client.ping.return_value = True

            service = RedisService(
                host='localhost',
                port=6379,
                db=0,
                password='testpass',
                max_connections=50
            )
            return service

    def test_store_refresh_token_success(self, service):
        """Should return True once the transaction executes"""
        pipe = service._client.pipeline.return_value

        assert service.store_refresh_token(1, 'test-jti', ttl_seconds=3600) is True
        pipe.zadd.assert_called_once()
        assert pipe.zadd.call_args[0][0] == 'refresh_tokens:1'
        pipe.zrem.assert_not_called()
        pipe.expire.assert_called_once_with('refresh_tokens:1', 3600)
        pipe.execute.assert_called_once()

    def test_store_refresh_token_replaces_in_same_transaction(self, service):
        """Rotation removes the old JTI inside the same MULTI/EXEC"""
        pipe = service._client.pipeline.return_value

        service.store_refresh_token(1, 'new-jti', replaces='old-jti')

        pipe.zrem.assert_called_once_with('refresh_tokens:1', 'old-jti')
        pipe.execute.assert_called_once()

    def test_store_refresh_token_error(self, service):
        """Should return False on Redis errors"""
        service._client.pipeline.return_value.execute.side_effect = (
            redis.RedisError('Write failed'))

        assert service.store_refresh_token(1, 'jti') is False

    def test_is_token_valid_when_unexpired(self, service):
        service._client.zscore.return_value = time.time() + 60

        assert service.is_token_valid(1, 'test-jti') is True
        service._client.zscore.assert_called_once_with('refresh_tokens:1', 'test-jti')

    def test_is_token_valid_when_expired(self, service):
        """An entry not yet pruned must still be rejected once past its expiry"""
        service._client.zscore.return_value = time.time() - 1

        assert service.is_token_valid(1, 'test-jti') is False

    def test_is_token_valid_not_exists(self, service):
        service._client.zscore.return_value = None

        assert service.is_token_valid(1, 'test-jti') is False

    def test_is_token_valid_error(self, service):
        service._client.zscore.side_effect = redis.RedisError('Read failed')

        assert service.is_token_valid(1, 'jti') is False

    def test_revoke_token_success(self, service):
        service._client.zrem.return_value = 1

        assert service.revoke_token(1, 'test-jti') is True
        service._client.zrem.assert_called_once_with('refresh_tokens:1', 'test-jti')

    def test_revoke_token_not_found(self, service):
        service._client.zrem.return_value = 0

        assert service.revoke_token(1, 'test-jti') is False

    def test_revoke_token_error(self, service):
        service._client.zrem.side_effect = redis.RedisError('Delete failed')

        assert service.revoke_token(1, 'jti') is False

    def test_revoke_all_user_tokens_returns_live_count(self, service):
        pipe = service._client.pipeline.return_value
        pipe.execute.return_value = [3, 1]

        assert service.revoke_all_user_tokens(1) == 3
        pipe.delete.assert_called_once_with('refresh_tokens:1')

    def test_revoke_all_user_tokens_error(self, service):
        service._client.pipeline.return_value.execute.side_effect = (
            redis.RedisError('Failed'))

        assert service.revoke_all_user_tokens(1) == 0


class TestFailFastWhenRedisIsDown:
    """redis-py's default retries a failed command 10 times with backoff,
    which would hang every request for ~30s while Redis is down."""

    @staticmethod
    def count_connection_attempts(make_client):
        attempts = []

        def refuse(self):
            attempts.append(1)
            raise ConnectionRefusedError

        with patch('redis.connection.Connection._connect', refuse):
            with pytest.raises(Exception):
                make_client().ping()
        return len(attempts)

    def test_app_client_retries_once(self):
        def make():
            return RedisService(host='localhost', port=6379, db=0,
                                password='x', max_connections=5)._client

        assert self.count_connection_attempts(make) == 2

    def test_rate_limiter_client_retries_once(self, monkeypatch):
        """Flask-Limiter hands RATELIMIT_STORAGE_OPTIONS to redis.from_url"""
        from app.config import DevelopmentConfig
        monkeypatch.setenv('SECRET_KEY', 'x' * 32)
        for name, value in {'MYSQL_USER': 'u', 'MYSQL_PASSWORD': 'p',
                            'MYSQL_HOST': 'h', 'MYSQL_DATABASE': 'd',
                            'REDIS_HOST': 'localhost', 'REDIS_PASSWORD': 'p'}.items():
            monkeypatch.setenv(name, value)
        config = DevelopmentConfig()

        def make():
            return redis.from_url(
                config.RATELIMIT_STORAGE_URI, **config.RATELIMIT_STORAGE_OPTIONS)

        assert self.count_connection_attempts(make) == 2
