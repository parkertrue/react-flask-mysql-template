import pytest
from unittest.mock import patch, MagicMock
import redis

from app.redis_service import RedisService


class TestRedisServiceInitialization:
    """Test RedisService initialization"""

    def test_init_success(self):
        """Redis should initialize successfully with valid config"""
        with patch('app.redis_service.redis.Redis') as mock_redis_class:
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
        with patch('app.redis_service.redis.Redis') as mock_redis_class:
            mock_client = MagicMock()
            mock_redis_class.return_value = mock_client
            mock_client.ping.return_value = True

            service = RedisService(
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
        with patch('app.redis_service.redis.Redis') as mock_redis_class:
            mock_client = MagicMock()
            mock_redis_class.return_value = mock_client
            mock_client.ping.side_effect = redis.RedisError(
                "Connection failed")

            with pytest.raises(RuntimeError) as exc_info:
                RedisService(
                    host='localhost',
                    port=6379,
                    db=0,
                    password='testpass',
                    max_connections=50
                )

            assert "Failed to connect to Redis" in str(exc_info.value)

    def test_init_exception(self):
        """Redis should raise RuntimeError on unexpected exceptions"""
        with patch('app.redis_service.redis.Redis') as mock_redis_class:
            mock_redis_class.side_effect = Exception("Unexpected error")

            with pytest.raises(RuntimeError) as exc_info:
                RedisService(
                    host='localhost',
                    port=6379,
                    db=0,
                    password='testpass',
                    max_connections=50
                )

            assert "Redis initialization failed" in str(exc_info.value)

    def test_get_client(self):
        """get_client should return the Redis client"""
        with patch('app.redis_service.redis.Redis') as mock_redis_class:
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
        with patch('app.redis_service.redis.Redis') as mock_redis_class:
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
        """Should store refresh token successfully"""
        service._client.setex.return_value = True

        result = service.store_refresh_token(
            user_id=1,
            jti="test-jti-123",
            ttl_seconds=3600
        )

        assert result is True
        service._client.setex.assert_called_once_with(
            "refresh_token:1:test-jti-123",
            3600,
            "1"
        )

    def test_store_refresh_token_default_ttl(self, service):
        """Should use default TTL when not specified"""
        service._client.setex.return_value = True

        result = service.store_refresh_token(user_id=1, jti="test-jti-123")

        assert result is True
        # Default is 30 days = 2592000 seconds
        service._client.setex.assert_called_once_with(
            "refresh_token:1:test-jti-123",
            2592000,
            "1"
        )

    def test_store_refresh_token_error(self, service):
        """Should return False on Redis errors"""
        service._client.setex.side_effect = redis.RedisError("Write failed")

        result = service.store_refresh_token(1, "jti")

        assert result is False

    def test_is_token_valid_exists(self, service):
        """Should return True when token exists"""
        service._client.exists.return_value = 1

        result = service.is_token_valid(1, "test-jti")

        assert result is True
        service._client.exists.assert_called_once_with(
            "refresh_token:1:test-jti")

    def test_is_token_valid_not_exists(self, service):
        """Should return False when token doesn't exist"""
        service._client.exists.return_value = 0

        result = service.is_token_valid(1, "test-jti")

        assert result is False

    def test_is_token_valid_error(self, service):
        """Should return False on Redis errors"""
        service._client.exists.side_effect = redis.RedisError("Read failed")

        result = service.is_token_valid(1, "jti")

        assert result is False

    def test_revoke_token_success(self, service):
        """Should revoke token successfully"""
        service._client.delete.return_value = 1

        result = service.revoke_token(1, "test-jti")

        assert result is True
        service._client.delete.assert_called_once_with(
            "refresh_token:1:test-jti")

    def test_revoke_token_not_found(self, service):
        """Should return False when token not found"""
        service._client.delete.return_value = 0

        result = service.revoke_token(1, "test-jti")

        assert result is False

    def test_revoke_token_error(self, service):
        """Should return False on Redis errors"""
        service._client.delete.side_effect = redis.RedisError("Delete failed")

        result = service.revoke_token(1, "jti")

        assert result is False

    def test_revoke_all_user_tokens_success(self, service):
        """Should revoke all user tokens successfully"""
        service._client.keys.return_value = [
            "refresh_token:1:jti1",
            "refresh_token:1:jti2",
            "refresh_token:1:jti3"
        ]
        service._client.delete.return_value = 3

        count = service.revoke_all_user_tokens(1)

        assert count == 3
        service._client.keys.assert_called_once_with("refresh_token:1:*")
        service._client.delete.assert_called_once()

    def test_revoke_all_user_tokens_no_tokens(self, service):
        """Should return 0 when user has no tokens"""
        service._client.keys.return_value = []

        count = service.revoke_all_user_tokens(1)

        assert count == 0
        service._client.delete.assert_not_called()

    def test_revoke_all_user_tokens_error(self, service):
        """Should return 0 on Redis errors"""
        service._client.keys.side_effect = redis.RedisError("Keys failed")

        count = service.revoke_all_user_tokens(1)

        assert count == 0


class TestCachingUtilities:
    """Test caching utility methods"""

    @pytest.fixture
    def service(self):
        """Create a RedisService instance with mocked client"""
        with patch('app.redis_service.redis.Redis') as mock_redis_class:
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

    def test_get_success(self, service):
        """Should get value from cache"""
        service._client.get.return_value = "cached_value"

        result = service.get("test_key")

        assert result == "cached_value"
        service._client.get.assert_called_once_with("test_key")

    def test_get_none(self, service):
        """Should return None when key doesn't exist"""
        service._client.get.return_value = None

        result = service.get("test_key")
        assert result is None

    def test_get_error(self, service):
        """Should return None on Redis errors"""
        service._client.get.side_effect = redis.RedisError("Get failed")

        result = service.get("test_key")
        assert result is None

    def test_set_success_with_ttl(self, service):
        """Should set value with TTL"""
        service._client.setex.return_value = True

        result = service.set("test_key", "value", ttl_seconds=3600)

        assert result is True
        service._client.setex.assert_called_once_with(
            "test_key", 3600, "value")

    def test_set_success_without_ttl(self, service):
        """Should set value without TTL"""
        service._client.set.return_value = True

        result = service.set("test_key", "value")

        assert result is True
        service._client.set.assert_called_once_with("test_key", "value")

    def test_set_error(self, service):
        """Should return False on Redis errors"""
        service._client.set.side_effect = redis.RedisError("Set failed")

        result = service.set("key", "value")
        assert result is False

    def test_delete_success(self, service):
        """Should delete key successfully"""
        service._client.delete.return_value = 1

        result = service.delete("test_key")

        assert result is True
        service._client.delete.assert_called_once_with("test_key")

    def test_delete_not_found(self, service):
        """Should return False when key doesn't exist"""
        service._client.delete.return_value = 0

        result = service.delete("test_key")
        assert result is False

    def test_delete_error(self, service):
        """Should return False on Redis errors"""
        service._client.delete.side_effect = redis.RedisError("Delete failed")

        result = service.delete("key")
        assert result is False

    def test_exists_true(self, service):
        """Should return True when key exists"""
        service._client.exists.return_value = 1

        result = service.exists("test_key")

        assert result is True
        service._client.exists.assert_called_once_with("test_key")

    def test_exists_false(self, service):
        """Should return False when key doesn't exist"""
        service._client.exists.return_value = 0

        result = service.exists("test_key")
        assert result is False

    def test_exists_error(self, service):
        """Should return False on Redis errors"""
        service._client.exists.side_effect = redis.RedisError("Exists failed")

        result = service.exists("key")
        assert result is False
