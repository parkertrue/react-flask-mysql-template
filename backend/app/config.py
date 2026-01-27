import os
from datetime import timedelta


class Config:
    """Base configuration"""
    # Database configuration
    DB_USER = os.getenv('MYSQL_USER')
    DB_PASSWORD = os.getenv('MYSQL_PASSWORD')
    DB_HOST = os.getenv('MYSQL_HOST')
    DB_DATABASE = os.getenv('MYSQL_DATABASE')

    if not all([DB_USER, DB_PASSWORD, DB_HOST, DB_DATABASE]):
        raise ValueError(
            'Missing required environment variables for database connection')

    SQLALCHEMY_DATABASE_URI = (
        f'mysql+pymysql://{DB_USER}:{DB_PASSWORD}@'
        f'{DB_HOST}:3306/{DB_DATABASE}'
    )

    # JWT configuration
    JWT_SECRET_KEY = os.getenv('SECRET_KEY')
    if not JWT_SECRET_KEY:
        raise ValueError('SECRET_KEY environment variable not set')

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers', 'cookies']
    JWT_REFRESH_TOKEN_LOCATION = ['cookies']
    JWT_ACCESS_TOKEN_LOCATION = ['headers']
    # JWT_COOKIE_SECURE = True  # Uncomment this in production for HTTPS
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_SAMESITE = 'Lax'
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_CSRF_IN_COOKIES = True
    JWT_CSRF_CHECK_FORM = False
    JWT_REFRESH_CSRF_HEADER_NAME = "X-CSRF-REFRESH-TOKEN"


class DevelopmentConfig(Config):
    """Development configuration"""
    FLASK_ENV = "development"
    DEBUG = True
    TESTING = False
    CORS_ORIGINS = ["http://localhost:5173"]


class TestingConfig(Config):
    """Testing configuration"""
    FLASK_ENV = "testing"
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


class ProductionConfig(Config):
    """Production configuration"""
    FLASK_ENV = "production"
    DEBUG = False
    TESTING = False


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

    return config_map[flask_env]
