import redis
from typing import cast


class RedisService:
    """Redis service for managing JWT tokens and caching"""

    def __init__(self, host: str, port: int, db: int, password: str, max_connections: int):
        try:
            self._client = redis.Redis(
                host=host,
                port=port,
                db=db,
                password=password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
                max_connections=max_connections
            )

            self._client.ping()

        except redis.RedisError as e:
            raise RuntimeError(f"Failed to connect to Redis: {e}")
        except Exception as e:
            raise RuntimeError(f"Redis initialization failed: {e}")

    def get_client(self) -> redis.Redis:
        return self._client

    # ==================== Token Management ====================

    def store_refresh_token(self, user_id: int, jti: str, ttl_seconds: int = 2592000) -> bool:
        try:
            key = f"refresh_token:{user_id}:{jti}"
            result = self._client.setex(key, ttl_seconds, "1")
            return cast(bool, result)
        except redis.RedisError:
            return False

    def is_token_valid(self, user_id: int, jti: str) -> bool:
        try:
            key = f"refresh_token:{user_id}:{jti}"
            result = self._client.exists(key)
            return cast(int, result) > 0
        except redis.RedisError:
            return False

    def revoke_token(self, user_id: int, jti: str) -> bool:
        try:
            key = f"refresh_token:{user_id}:{jti}"
            result = self._client.delete(key)
            return cast(int, result) > 0
        except redis.RedisError:
            return False

    def revoke_all_user_tokens(self, user_id: int) -> int:
        try:
            pattern = f"refresh_token:{user_id}:*"
            keys = cast(list, self._client.keys(pattern))

            if not keys:
                return 0

            result = self._client.delete(*keys)
            return cast(int, result)
        except redis.RedisError:
            return 0

    # ==================== Caching Utilities ====================

    def get(self, key: str) -> str | None:
        try:
            result = self._client.get(key)
            return result if result is None else str(result)
        except redis.RedisError:
            return None

    def set(self, key: str, value: str, ttl_seconds: int | None = None) -> bool:
        try:
            if ttl_seconds:
                result = self._client.setex(key, ttl_seconds, value)
            else:
                result = self._client.set(key, value)
            return cast(bool, result)
        except redis.RedisError:
            return False

    def delete(self, key: str) -> bool:
        """Delete key from Redis"""
        try:
            result = self._client.delete(key)
            return cast(int, result) > 0
        except redis.RedisError:
            return False

    def exists(self, key: str) -> bool:
        """Check if key exists in Redis"""
        try:
            result = self._client.exists(key)
            return cast(int, result) > 0
        except redis.RedisError:
            return False
