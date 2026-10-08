import time
import redis
from redis.backoff import NoBackoff
from redis.retry import Retry
from typing import cast
from flask import Flask, current_app

# How long to wait after a failed connection before trying again. Each attempt
# can block a request for up to socket_connect_timeout while Redis is down.
RECONNECT_INTERVAL_SECONDS = 5

# Shared by the app's client and the rate limiter's (config.py). redis-py's
# default retries a failed command 10 times with backoff, so every request
# would hang for ~30s while Redis is down. One immediate retry is enough to
# replace a connection Redis closed; after that, fail fast.
REDIS_CLIENT_OPTIONS = {
    'socket_connect_timeout': 2,
    'socket_timeout': 2,
    'retry': Retry(NoBackoff(), 1),
}


def get_redis_service() -> 'RedisService | None':
    """The current app's RedisService, or None if Redis is disabled or down.

    Looked up per call rather than imported, so every app instance (one per
    gunicorn worker, several per test session) sees its own service.
    """
    service = current_app.extensions.get('redis_service')
    if service is None and current_app.config['USES_SERVICES']:
        service = connect_redis(current_app)
    return service


def connect_redis(app: Flask) -> 'RedisService | None':
    """Build the app's RedisService, or return None and retry on a later call.

    A worker that boots while Redis is unreachable would otherwise stay
    without it for life; once connected, redis-py reconnects by itself.
    """
    now = time.monotonic()
    if now < app.extensions.get('redis_retry_at', 0):
        return None

    try:
        service = RedisService(
            host=app.config['REDIS_HOST'],
            port=app.config['REDIS_PORT'],
            db=app.config['REDIS_DB'],
            username=app.config['REDIS_USERNAME'],
            password=app.config['REDIS_PASSWORD'],
            max_connections=app.config['REDIS_MAX_CONNECTIONS']
        )
    except Exception:
        app.logger.exception(
            'Redis connection failed; retrying in %ss', RECONNECT_INTERVAL_SECONDS)
        app.extensions['redis_retry_at'] = now + RECONNECT_INTERVAL_SECONDS
        return None

    app.extensions['redis_service'] = service
    return service


# Logging in on an 11th device ends the session that would expire soonest,
# so one account can never grow its Redis footprint without bound.
MAX_SESSIONS_PER_USER = 10


def _tokens_key(user_id: int) -> str:
    """One sorted set per user: member = refresh-token JTI, score = expiry time"""
    return f'refresh_tokens:{user_id}'


class RedisService:
    """Refresh-token allowlist in Redis.

    Redis runs with noeviction because losing these keys logs users out, so
    anything else stored here must carry a TTL, or use a separate instance.

    Every failure is logged: callers turn them into a 503 or a 401, and
    without the log a full Redis (OOM), a wrong password and a key outside
    the ACL user's patterns (NOPERM) would all look the same.
    """

    def __init__(self, host: str, port: int, db: int, username: str, password: str,
                 max_connections: int):
        try:
            self._client = redis.Redis(
                host=host,
                port=port,
                db=db,
                username=username,
                password=password,
                decode_responses=True,
                health_check_interval=30,
                max_connections=max_connections,
                **REDIS_CLIENT_OPTIONS,
            )

            self._client.ping()

        except redis.RedisError as e:
            raise RuntimeError(f'Failed to connect to Redis: {e}')
        except Exception as e:
            raise RuntimeError(f'Redis initialization failed: {e}')

    def get_client(self) -> redis.Redis:
        return self._client

    def store_refresh_token(self, user_id: int, jti: str, ttl_seconds: int = 2592000,
                            replaces: str | None = None) -> bool:
        """Record a new refresh token, swapping out `replaces` in the same step.

        Rotating in one transaction matters at the session cap: storing first
        would evict another device's session to make room for this one.
        """
        key = _tokens_key(user_id)
        now = time.time()
        try:
            pipe = self._client.pipeline()  # MULTI/EXEC: all or nothing
            if replaces:
                pipe.zrem(key, replaces)
            pipe.zadd(key, {jti: now + ttl_seconds})
            pipe.zremrangebyscore(key, '-inf', now)
            # Keep the newest MAX_SESSIONS_PER_USER; the lowest scores expire first
            pipe.zremrangebyrank(key, 0, -(MAX_SESSIONS_PER_USER + 1))
            # The newest token expires last, so the key can go with it
            pipe.expire(key, ttl_seconds)
            pipe.execute()
            return True
        except redis.RedisError:
            current_app.logger.exception('Could not record a refresh token for user %s', user_id)
            return False

    def is_token_valid(self, user_id: int, jti: str) -> bool:
        try:
            expires_at = self._client.zscore(_tokens_key(user_id), jti)
            return expires_at is not None and expires_at > time.time()
        except redis.RedisError:
            current_app.logger.exception('Could not check a refresh token for user %s', user_id)
            return False

    def revoke_token(self, user_id: int, jti: str) -> bool:
        try:
            result = self._client.zrem(_tokens_key(user_id), jti)
            return cast(int, result) > 0
        except redis.RedisError:
            current_app.logger.exception('Could not revoke a refresh token for user %s', user_id)
            return False

    def revoke_all_user_tokens(self, user_id: int) -> int:
        """Revoke every session the user has; returns how many were live"""
        key = _tokens_key(user_id)
        try:
            pipe = self._client.pipeline()
            pipe.zcount(key, time.time(), '+inf')
            pipe.delete(key)
            live, _ = pipe.execute()
            return cast(int, live)
        except redis.RedisError:
            current_app.logger.exception('Could not revoke the sessions of user %s', user_id)
            return 0
