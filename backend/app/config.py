import os
from datetime import timedelta


class Config:
    """Base configuration"""

    def __init__(self):
        self.FLASK_DEBUG = os.getenv('FLASK_DEBUG', False)

        # Database configuration
        self.DB_USER = os.getenv('MYSQL_USER')
        self.DB_PASSWORD = os.getenv('MYSQL_PASSWORD')
        self.DB_HOST = os.getenv('MYSQL_HOST')
        self.DB_PORT = 3306
        self.DB_DATABASE = os.getenv('MYSQL_DATABASE')

        if not all([self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_DATABASE]):
            raise ValueError("Missing required MySQL environment variables")

        self.SQLALCHEMY_DATABASE_URI = (
            f'mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@'
            f'{self.DB_HOST}:{self.DB_PORT}/{self.DB_DATABASE}'
        )

        # Redis configuration
        self.REDIS_HOST = os.getenv('REDIS_HOST')
        self.REDIS_PORT = 6379
        self.REDIS_DB = os.getenv('REDIS_DB')
        self.REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')
        self.REDIS_MAX_CONNECTIONS = 50

        if not all([self.REDIS_HOST, self.REDIS_DB, self.REDIS_PASSWORD]):
            raise ValueError("Missing required Redis environment variables")

        self.REDIS_URI = (
            f"redis://:{self.REDIS_PASSWORD}@"
            f"{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        )
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
        self.TESTING = False
        self.CORS_ORIGINS = ["http://localhost:5173"]


class TestingConfig(Config):
    """Testing configuration"""
    __test__ = False

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = "testing"
        self.TESTING = True
        self.SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


class ProductionConfig(Config):
    """Production configuration"""

    def __init__(self):
        super().__init__()
        self.FLASK_ENV = "production"
        self.FLASK_DEBUG = False
        self.TESTING = False
        self.JWT_COOKIE_SECURE = True


def get_config():
    """Get configuration based on environment"""
    flask_env = os.getenv('FLASK_ENV')
    if flask_env not in ["development", "testing", "production"]:
        raise ValueError('FLASK_ENV environment variable not set or invalid')

    config_map = {
        'development': DevelopmentConfig,
        'testing': TestingConfig,
        'production': ProductionConfig,
    }

    return config_map[flask_env]()
