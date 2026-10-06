import time
import redis
from typing import cast
from flask import Flask, current_app

# How long to wait after a failed connection before trying again. Each attempt
# can block a request for up to socket_connect_timeout while Redis is down.
RECONNECT_INTERVAL_SECONDS = 5


def get_redis_service() -> "RedisService | None":
    """The current app's RedisService, or None if Redis is disabled or down.

    Looked up per call rather than imported, so every app instance (one per
    gunicorn worker, several per test session) sees its own service.
    """
    service = current_app.extensions.get("redis_service")
    if service is None and current_app.config["REDIS_ENABLED"]:
        service = connect_redis(current_app)
    return service


def connect_redis(app: Flask) -> "RedisService | None":
    """Build the app's RedisService, or return None and retry on a later call.

    A worker that boots while Redis is unreachable would otherwise stay
    without it for life; once connected, redis-py reconnects by itself.
    """
    now = time.monotonic()
    if now < app.extensions.get("redis_retry_at", 0):
        return None

    try:
        service = RedisService(
            host=app.config["REDIS_HOST"],
            port=app.config["REDIS_PORT"],
            db=int(app.config["REDIS_DB"]),
            password=app.config["REDIS_PASSWORD"],
            max_connections=app.config["REDIS_MAX_CONNECTIONS"]
        )
    except Exception:
        app.logger.exception(
            "Redis connection failed; retrying in %ss", RECONNECT_INTERVAL_SECONDS)
        app.extensions["redis_retry_at"] = now + RECONNECT_INTERVAL_SECONDS
        return None

    app.extensions["redis_service"] = service
    return service


class RedisService:
    """Refresh-token allowlist in Redis.

    Redis runs with noeviction because losing these keys logs users out, so
    anything else stored here must carry a TTL, or use a separate instance.
    """

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
            # scan_iter, not keys: KEYS blocks the Redis event loop for the
            # whole scan, which stalls every other client on a large keyspace.
            keys = [key for key in self._client.scan_iter(pattern)]

            if not keys:
                return 0

            result = self._client.delete(*keys)
            return cast(int, result)
        except redis.RedisError:
            return 0
