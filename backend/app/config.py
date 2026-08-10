import os
from datetime import timedelta


class Config:
    """Base configuration"""

    def __init__(self):
        # Parse as a string: os.getenv always returns str, and the bare string
        # "0" is truthy, which would silently enable debug mode wherever
        # FLASK_DEBUG=0 was set.
        self.FLASK_DEBUG = os.getenv('FLASK_DEBUG', '0').lower() in ('1', 'true')
        self.CORS_ORIGINS = None

        # Database configuration
        self.DB_USER = os.getenv('MYSQL_USER')
        self.DB_PASSWORD = os.getenv('MYSQL_PASSWORD')
        self.DB_HOST = os.getenv('MYSQL_HOST')
        self.DB_PORT = int(os.getenv('MYSQL_PORT', '3306'))
        self.DB_DATABASE = os.getenv('MYSQL_DATABASE')

        if not all([self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_DATABASE]):
            raise ValueError("Missing required MySQL environment variables")

        self.SQLALCHEMY_DATABASE_URI = (
            f'mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@'
            f'{self.DB_HOST}:{self.DB_PORT}/{self.DB_DATABASE}'
        )

        # Redis configuration
        self.REDIS_ENABLED = True
        self.REDIS_HOST = os.getenv('REDIS_HOST')
        self.REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
        self.REDIS_DB = os.getenv('REDIS_DB')
        self.REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')
        self.REDIS_MAX_CONNECTIONS = 50

        if not all([self.REDIS_HOST, self.REDIS_DB, self.REDIS_PASSWORD]):
            raise ValueError("Missing required Redis environment variables")

        self.REDIS_URI = (
            f"redis://:{self.REDIS_PASSWORD}@"
            f"{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        )

        # Rate Limiter configuration
        self.RATELIMIT_ENABLED = True
        self.RATELIMIT_STORAGE_URI = self.REDIS_URI

        # JWT configuration
        self.JWT_SECRET_KEY = os.getenv('SECRET_KEY')
        self.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
        self.JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
        self.JWT_TOKEN_LOCATION = ['headers', 'cookies']
        self.JWT_REFRESH_TOKEN_LOCATION = ['cookies']
        self.JWT_ACCESS_TOKEN_LOCATION = ['headers']
        self.JWT_COOKIE_HTTPONLY = True
        self.JWT_COOKIE_SAMESITE = 'Lax'
        self.JWT_COOKIE_CSRF_PROTECT = True
        self.JWT_CSRF_IN_COOKIES = True
        self.JWT_CSRF_CHECK_FORM = False
        self.JWT_REFRESH_CSRF_HEADER_NAME = "X-CSRF-REFRESH-TOKEN"

        if not self.JWT_SECRET_KEY:
            raise ValueError("SECRET_KEY environment variable not set")


class DevelopmentConfig(Config):
    """Development configuration"""

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = "development"
        self.CORS_ORIGINS = ["http://localhost:5173"]


class TestingConfig(Config):
    """Testing configuration"""
    __test__ = False

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = "testing"
        self.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
        self.REDIS_ENABLED = False
        self.RATELIMIT_ENABLED = False


class IntegrationConfig(Config):
    """Integration/E2E testing configuration"""

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = "integration"
        self.RATELIMIT_ENABLED = False
        self.CORS_ORIGINS = [
            "http://localhost:5173",
            "https://localhost",
            "https://localhost:8443",
        ]
        e2e_mode = os.getenv('E2E_MODE', 'false').lower() == 'true'
        self.JWT_COOKIE_SECURE = e2e_mode
        # CSRF protection is browser-only; disable it for API integration
        # tests, which have no browser to carry the cookie.
        self.JWT_COOKIE_CSRF_PROTECT = e2e_mode


class ProductionConfig(Config):
    """Production configuration"""

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = "production"
        self.FLASK_DEBUG = False
        self.JWT_COOKIE_SECURE = True


def get_config():
    """Get configuration based on environment

    FLASK_ENV is the only switch. E2E_MODE deliberately cannot promote or
    demote a config class: previously E2E_MODE=true silently replaced
    ProductionConfig with a weaker one, so a single env var could disable
    rate limiting and widen CORS on a production deployment.
    """
    flask_env = os.getenv('FLASK_ENV', 'production')

    if flask_env not in ["development", "testing", "integration", "production"]:
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
