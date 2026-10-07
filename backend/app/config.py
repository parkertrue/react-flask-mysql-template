import os
from datetime import timedelta
from urllib.parse import quote

from app.utils.redis_service import CLIENT_OPTIONS as REDIS_CLIENT_OPTIONS

MIN_SECRET_KEY_LENGTH = 32
PLACEHOLDER_SECRET_KEYS = {'your_secret_key_here'}
# .env.prod.example's values, which must never reach a deployment. The
# root password is among them: the migrate service connects as root.
PLACEHOLDER_PASSWORDS = {
    'your_db_password_here', 'your_redis_password_here', 'your_root_password_here'}


class Config:
    """Base configuration"""

    # Whether MySQL and Redis settings are required. Only TestingConfig opts
    # out: it runs on in-memory SQLite with Redis and rate limiting off.
    USES_SERVICES = True

    def __init__(self):
        # Parse as a string: os.getenv always returns str, and the bare string
        # "0" is truthy, which would silently enable debug mode wherever
        # FLASK_DEBUG=0 was set.
        self.FLASK_DEBUG = os.getenv('FLASK_DEBUG', '0').lower() in ('1', 'true')

        # Every request body is a small JSON object; refuse anything larger
        # than this before parsing it. nginx enforces the same cap.
        self.MAX_CONTENT_LENGTH = 16 * 1024

        # Database configuration
        self.DB_USER = os.getenv('MYSQL_USER')
        self.DB_PASSWORD = os.getenv('MYSQL_PASSWORD')
        self.DB_HOST = os.getenv('MYSQL_HOST')
        self.DB_PORT = int(os.getenv('MYSQL_PORT', '3306'))
        self.DB_DATABASE = os.getenv('MYSQL_DATABASE')

        self.SQLALCHEMY_DATABASE_URI = None
        if all([self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_DATABASE]):
            # Credentials are percent-encoded: a password containing @ / : or #
            # would otherwise be parsed as part of the host.
            self.SQLALCHEMY_DATABASE_URI = (
                f'mysql+pymysql://{quote(self.DB_USER, safe="")}:'
                f'{quote(self.DB_PASSWORD, safe="")}@'
                f'{self.DB_HOST}:{self.DB_PORT}/{self.DB_DATABASE}'
            )
        elif self.USES_SERVICES:
            raise ValueError('Missing required MySQL environment variables')

        # Redis configuration
        self.REDIS_ENABLED = True
        self.REDIS_HOST = os.getenv('REDIS_HOST')
        self.REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
        self.REDIS_DB = os.getenv('REDIS_DB', '0')
        # The compose files' Redis disables the all-powerful "default" user
        # and gives the app its own ACL user, "app"
        self.REDIS_USERNAME = os.getenv('REDIS_USERNAME', 'default')
        self.REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')
        self.REDIS_MAX_CONNECTIONS = 50

        self.REDIS_URI = None
        if all([self.REDIS_HOST, self.REDIS_PASSWORD]):
            self.REDIS_URI = (
                f"redis://{quote(self.REDIS_USERNAME, safe='')}:"
                f"{quote(self.REDIS_PASSWORD, safe='')}@"
                f"{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
            )
        elif self.USES_SERVICES:
            raise ValueError('Missing required Redis environment variables')

        # Rate Limiter configuration
        self.RATELIMIT_ENABLED = True
        self.RATELIMIT_STORAGE_URI = self.REDIS_URI
        self.RATELIMIT_STORAGE_OPTIONS = REDIS_CLIENT_OPTIONS
        # If Redis is unreachable, count in each worker's memory until it is
        # back, rather than failing every rate-limited request with a 500.
        self.RATELIMIT_IN_MEMORY_FALLBACK_ENABLED = True

        # Number of reverse proxies in front of Flask whose X-Forwarded-*
        # headers are trusted. 0 means REMOTE_ADDR is the client.
        self.TRUSTED_PROXY_COUNT = 0

        # JWT configuration
        self.JWT_SECRET_KEY = os.getenv('SECRET_KEY', '')
        self.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
        self.JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
        # Access tokens travel in the Authorization header, refresh tokens in
        # an HttpOnly cookie (always, in Flask-JWT-Extended) that is only sent
        # to the /api/auth routes.
        self.JWT_TOKEN_LOCATION = ['headers', 'cookies']
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

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = 'development'


class TestingConfig(Config):
    """Testing configuration"""
    __test__ = False
    USES_SERVICES = False

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = 'testing'
        self.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
        self.REDIS_ENABLED = False
        self.RATELIMIT_ENABLED = False


class IntegrationConfig(Config):
    """Integration/E2E testing configuration"""

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = 'integration'
        self.RATELIMIT_ENABLED = False
        e2e_mode = os.getenv('E2E_MODE', 'false').lower() == 'true'
        self.JWT_COOKIE_SECURE = e2e_mode
        # CSRF protection is browser-only; disable it for API integration
        # tests, which have no browser to carry the cookie.
        self.JWT_COOKIE_CSRF_PROTECT = e2e_mode


class ProductionConfig(Config):
    """Production configuration"""

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = 'production'
        self.FLASK_DEBUG = False
        self.JWT_COOKIE_SECURE = True
        self.TRUSTED_PROXY_COUNT = 1  # nginx

        # Anyone who knows the template's placeholder can forge JWTs, so a
        # weak key must stop the deploy rather than boot quietly.
        if (len(self.JWT_SECRET_KEY) < MIN_SECRET_KEY_LENGTH
                or self.JWT_SECRET_KEY in PLACEHOLDER_SECRET_KEYS):
            raise ValueError(
                f'SECRET_KEY must be a random value of at least '
                f'{MIN_SECRET_KEY_LENGTH} characters in production')

        for name in ('MYSQL_PASSWORD', 'REDIS_PASSWORD'):
            if os.getenv(name) in PLACEHOLDER_PASSWORDS:
                raise ValueError(
                    f'{name} is still the .env.prod.example placeholder')


def get_config():
    """Get configuration based on environment

    FLASK_ENV is the only switch. E2E_MODE deliberately cannot promote or
    demote a config class: previously E2E_MODE=true silently replaced
    ProductionConfig with a weaker one, so a single env var could disable
    rate limiting on a production deployment.
    """
    flask_env = os.getenv('FLASK_ENV', 'production')

    if flask_env not in ['development', 'testing', 'integration', 'production']:
        raise ValueError(
            f'FLASK_ENV must be one of: development, testing, integration, '
            f'production. Got: {flask_env}')

    config_map = {
        'development': DevelopmentConfig,
        'testing': TestingConfig,
        'integration': IntegrationConfig,
        'production': ProductionConfig,
    }

    return config_map[flask_env]()
