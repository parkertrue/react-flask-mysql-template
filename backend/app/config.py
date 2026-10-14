import os
from datetime import timedelta
from urllib.parse import quote

from sqlalchemy import URL

from app.utils.redis_service import RATELIMIT_REDIS_OPTIONS

MIN_SECRET_KEY_LENGTH = 32
PLACEHOLDER_SECRET_KEYS = {'your_secret_key_here'}
# .env.prod.example's values, which must never reach a deployment. The
# root password is among them: the migrate service connects as root.
PLACEHOLDER_PASSWORDS = {
    'your_db_password_here', 'your_redis_password_here', 'your_root_password_here'}


class Config:
    """Base configuration"""

    # Whether the app talks to a real database and Redis, so their settings
    # are required. Only UnitTestConfig opts out: it runs on in-memory SQLite
    # with Redis and rate limiting off.
    USES_SERVICES = True

    def __init__(self):
        # Parse as a string: os.getenv always returns str, and the bare string
        # "0" is truthy, which would silently enable debug mode wherever
        # FLASK_DEBUG=0 was set.
        self.FLASK_DEBUG = os.getenv('FLASK_DEBUG', '0').lower() in ('1', 'true')

        # Every request body is a small JSON object; refuse anything larger
        # than this before parsing it. nginx enforces the same cap.
        self.MAX_CONTENT_LENGTH = 16 * 1024

        # Password hashes each gunicorn worker may compute at once, out of its
        # threads (see backend/Dockerfile). The rest stay free for other
        # requests during a burst of logins. A login that waits longer than
        # the timeout for a slot gets a 503.
        self.PASSWORD_HASH_CONCURRENCY = 2
        self.PASSWORD_HASH_WAIT_SECONDS = 5

        # Database configuration
        self.DB_USER = os.getenv('DB_USER')
        self.DB_PASSWORD = os.getenv('DB_PASSWORD')
        self.DB_HOST = os.getenv('DB_HOST')
        self.DB_PORT = int(os.getenv('DB_PORT', '3306'))
        self.DB_NAME = os.getenv('DB_NAME')

        self.SQLALCHEMY_DATABASE_URI = None
        if all([self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_NAME]):
            # A URL object, not a string: it escapes a password containing
            # @ / : or #, and prints it as *** wherever the URL is logged
            self.SQLALCHEMY_DATABASE_URI = URL.create(
                'mysql+pymysql',
                username=self.DB_USER,
                password=self.DB_PASSWORD,
                host=self.DB_HOST,
                port=self.DB_PORT,
                database=self.DB_NAME,
            )
        elif self.USES_SERVICES:
            raise ValueError(
                'Missing required database environment variables: '
                'DB_HOST, DB_NAME, DB_USER, DB_PASSWORD')

        connect_args = {
            # Every timestamp is UTC, and the API says so. NOW() and
            # CURRENT_TIMESTAMP follow the connection's time zone, which would
            # otherwise be whatever the server is set to.
            'init_command': "SET time_zone = '+00:00'",
            'connect_timeout': 5,
        }
        # PyMySQL waits on a query forever by default, so a hung database (a
        # full disk, a lock) would hold a request thread long after nginx gave
        # up at 60s, until every thread is stuck. The migrate service sets 0
        # (no limit): a migration on a big table may legitimately run longer.
        query_timeout = int(os.getenv('DB_QUERY_TIMEOUT', '15'))
        if query_timeout:
            connect_args.update(read_timeout=query_timeout, write_timeout=query_timeout)
        self.SQLALCHEMY_ENGINE_OPTIONS = {
            # MySQL closes connections idle past wait_timeout (8h by default),
            # and any restart or network blip drops them all; without a ping,
            # the next request on each dead pooled connection fails with a
            # 500. Recycling well before wait_timeout keeps the ping from
            # finding many dead ones.
            'pool_pre_ping': True,
            'pool_recycle': 1800,
            'connect_args': connect_args,
            # A failed statement's exception text, which the error handlers
            # log, would otherwise carry its values: password hashes, emails
            # and note text.
            'hide_parameters': True,
        }

        # Redis configuration
        self.REDIS_HOST = os.getenv('REDIS_HOST')
        self.REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
        self.REDIS_DB = int(os.getenv('REDIS_DB', '0'))
        # No default: the compose files' Redis disables the all-powerful
        # "default" user and gives the app its own ACL user, "app"
        self.REDIS_USERNAME = os.getenv('REDIS_USERNAME')
        self.REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')
        # Per worker: well above its 4 threads, so no request waits on the pool
        self.REDIS_MAX_CONNECTIONS = 50

        self.REDIS_URI = None
        if all([self.REDIS_HOST, self.REDIS_USERNAME, self.REDIS_PASSWORD]):
            self.REDIS_URI = (
                f"redis://{quote(self.REDIS_USERNAME, safe='')}:"
                f"{quote(self.REDIS_PASSWORD, safe='')}@"
                f"{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
            )
        elif self.USES_SERVICES:
            raise ValueError(
                'Missing required Redis environment variables: '
                'REDIS_HOST, REDIS_USERNAME, REDIS_PASSWORD')

        # Rate Limiter configuration
        self.RATELIMIT_ENABLED = True
        self.RATELIMIT_STORAGE_URI = self.REDIS_URI
        self.RATELIMIT_STORAGE_OPTIONS = RATELIMIT_REDIS_OPTIONS
        # If Redis is unreachable, count in each worker's memory until it is
        # back, rather than failing every rate-limited request with a 500.
        self.RATELIMIT_IN_MEMORY_FALLBACK_ENABLED = True
        # A failed login is counted after the response is built, where the
        # fallback doesn't reach: a Redis that refuses the write (full) would
        # turn the 401 into a 500. Log it and answer anyway. Limit checks
        # still try the fallback first, so it changes nothing there.
        self.RATELIMIT_SWALLOW_ERRORS = True

        # Number of reverse proxies in front of Flask whose X-Forwarded-*
        # headers are trusted. 0 means REMOTE_ADDR is the client.
        self.TRUSTED_PROXY_COUNT = 0

        # JWT configuration
        self.JWT_SECRET_KEY = os.getenv('SECRET_KEY', '')
        self.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
        # A session lasts at most JWT_REFRESH_TOKEN_EXPIRES from login, and
        # ends sooner once it goes SESSION_IDLE_TIMEOUT without a refresh:
        # each refresh token expires at the earlier of the two
        self.JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
        self.SESSION_IDLE_TIMEOUT = timedelta(days=7)
        # Access tokens travel in the Authorization header, refresh tokens in
        # an HttpOnly cookie (always, in Flask-JWT-Extended) that is only sent
        # to the /api/auth routes.
        self.JWT_TOKEN_LOCATION = ['headers', 'cookies']
        # __Secure- makes browsers refuse the cookie unless it is Secure and
        # set over HTTPS, so a sibling subdomain or plain-HTTP page can't
        # plant one under this name. (__Host- would also forbid the path.)
        # Browsers count http://localhost as secure, so dev works too.
        self.JWT_REFRESH_COOKIE_NAME = '__Secure-refresh_token'
        self.JWT_COOKIE_SECURE = True
        self.JWT_REFRESH_COOKIE_PATH = '/api/auth'
        self.JWT_COOKIE_SAMESITE = 'Lax'
        # Double-submit CSRF for the refresh cookie. The client gets the value
        # in the login/refresh response body, so no readable CSRF cookie is set.
        self.JWT_COOKIE_CSRF_PROTECT = True
        self.JWT_CSRF_IN_COOKIES = False
        self.JWT_REFRESH_CSRF_HEADER_NAME = 'X-CSRF-REFRESH-TOKEN'

        if not self.JWT_SECRET_KEY:
            raise ValueError('SECRET_KEY environment variable not set')


class DevelopmentConfig(Config):
    """Development configuration"""


class UnitTestConfig(Config):
    """Unit tests: in-memory SQLite, no Redis, no rate limiting"""
    __test__ = False
    USES_SERVICES = False

    def __init__(self):
        super().__init__()
        self.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
        # MySQL's pool and connection settings mean nothing to SQLite, whose
        # CURRENT_TIMESTAMP is always UTC
        self.SQLALCHEMY_ENGINE_OPTIONS = {'hide_parameters': True}
        self.RATELIMIT_ENABLED = False


class IntegrationConfig(Config):
    """Integration and E2E tests: real database and Redis"""

    def __init__(self):
        super().__init__()
        self.RATELIMIT_ENABLED = False
        e2e_mode = os.getenv('E2E_MODE', 'false').lower() == 'true'
        # CSRF protection is browser-only; disable it for API integration
        # tests, which have no browser to carry the cookie.
        self.JWT_COOKIE_CSRF_PROTECT = e2e_mode


class ProductionConfig(Config):
    """Production configuration"""

    def __init__(self):
        super().__init__()
        self.FLASK_DEBUG = False
        self.TRUSTED_PROXY_COUNT = 1  # nginx

        # Anyone who knows the template's placeholder can forge JWTs, so a
        # weak key must stop the deploy rather than boot quietly.
        if (len(self.JWT_SECRET_KEY) < MIN_SECRET_KEY_LENGTH
                or self.JWT_SECRET_KEY in PLACEHOLDER_SECRET_KEYS):
            raise ValueError(
                f'SECRET_KEY must be a random value of at least '
                f'{MIN_SECRET_KEY_LENGTH} characters in production')

        for name in ('DB_PASSWORD', 'REDIS_PASSWORD'):
            if os.getenv(name) in PLACEHOLDER_PASSWORDS:
                raise ValueError(
                    f'{name} is still the .env.prod.example placeholder')


def get_config():
    """Get configuration based on environment

    APP_ENV is the only switch: no other variable (E2E_MODE included) may
    swap a config class, or one env var could weaken production. Unset means
    production, the strictest class.
    """
    app_env = os.getenv('APP_ENV', 'production')

    config_map = {
        'development': DevelopmentConfig,
        'unit': UnitTestConfig,
        'integration': IntegrationConfig,
        'production': ProductionConfig,
    }

    if app_env not in config_map:
        raise ValueError(
            f'APP_ENV must be one of: {", ".join(config_map)}. Got: {app_env}')

    return config_map[app_env]()
