import pytest
import os
import sys
from datetime import timedelta

from app.config import (
    Config,
    DevelopmentConfig,
    TestingConfig,
    ProductionConfig,
    get_config
)


@pytest.fixture(autouse=True)
def isolate_config_tests():
    """Isolate config tests from session env vars."""
    if 'app.config' in sys.modules:
        del sys.modules['app.config']
    yield
    if 'app.config' in sys.modules:
        del sys.modules['app.config']


class TestConfigClasses:
    """Test Config class attributes"""

    def test_config_class_reads_env_vars(self, monkeypatch):
        """Config class should read environment variables lazily"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = Config()

        # These are read from environment via properties
        assert config.DB_USER == 'test'
        assert config.DB_PASSWORD == 'test'
        assert config.DB_HOST == 'localhost'
        assert config.DB_DATABASE == 'test'
        assert config.REDIS_HOST == 'localhost'
        assert config.REDIS_DB == '0'
        assert config.REDIS_PASSWORD == 'redispass'
        assert config.JWT_SECRET_KEY == 'testsecret'
        assert config.SQLALCHEMY_DATABASE_URI == "mysql+pymysql://test:test@localhost:3306/test"
        assert config.REDIS_URI == "redis://:redispass@localhost:6379/0"
        assert config.RATELIMIT_STORAGE_URI == "redis://:redispass@localhost:6379/0"

    def test_development_config_attributes(self):
        """DevelopmentConfig should have correct attributes"""
        config = DevelopmentConfig()

        assert config.FLASK_ENV == 'development'
        assert config.DEBUG is True
        assert config.TESTING is False
        assert hasattr(config, 'CORS_ORIGINS')
        assert 'http://localhost:5173' in config.CORS_ORIGINS

    def test_testing_config_attributes(self):
        """TestingConfig should have correct attributes"""
        config = TestingConfig()

        assert config.FLASK_ENV == 'testing'
        assert config.DEBUG is True
        assert config.TESTING is True
        # Testing mode overrides DB URI
        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'

    def test_production_config_attributes(self):
        """ProductionConfig should have correct attributes"""
        config = ProductionConfig()

        assert config.FLASK_ENV == 'production'
        assert config.DEBUG is False
        assert config.TESTING is False


class TestGetConfigFactory:
    """Test get_config() factory function"""

    def test_get_config_development(self, monkeypatch):
        """get_config should return configured DevelopmentConfig for dev env"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'testuser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'testpass')
        monkeypatch.setenv('MYSQL_HOST', 'testhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'testdb')
        monkeypatch.setenv('REDIS_HOST', 'redishost')
        monkeypatch.setenv('REDIS_DB', '1')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        # Should be instance of DevelopmentConfig
        assert isinstance(config, DevelopmentConfig)
        assert config.FLASK_ENV == 'development'

        # URIs should be populated by get_config()
        assert config.SQLALCHEMY_DATABASE_URI == 'mysql+pymysql://testuser:testpass@testhost:3306/testdb'
        assert config.REDIS_URI == 'redis://:redispass@redishost:6379/1'
        assert config.RATELIMIT_STORAGE_URI == 'redis://:redispass@redishost:6379/1'

    def test_get_config_testing(self, monkeypatch):
        """get_config should return TestingConfig for testing env"""
        monkeypatch.setenv('FLASK_ENV', 'testing')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        # Should be instance of TestingConfig
        assert isinstance(config, TestingConfig)
        assert config.FLASK_ENV == 'testing'

        # Testing mode uses memory DB
        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'

    def test_get_config_production(self, monkeypatch):
        """get_config should return configured ProductionConfig for prod env"""
        monkeypatch.setenv('FLASK_ENV', 'production')
        monkeypatch.setenv('MYSQL_USER', 'produser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'prodpass')
        monkeypatch.setenv('MYSQL_HOST', 'prodhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'proddb')
        monkeypatch.setenv('REDIS_HOST', 'prodredis')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'prodredispass')
        monkeypatch.setenv('SECRET_KEY', 'prodsecret')

        config = get_config()

        # Should be instance of ProductionConfig
        assert isinstance(config, ProductionConfig)
        assert config.FLASK_ENV == 'production'

        # URIs should be populated
        assert config.SQLALCHEMY_DATABASE_URI == 'mysql+pymysql://produser:prodpass@prodhost:3306/proddb'
        assert config.REDIS_URI == 'redis://:prodredispass@prodredis:6379/0'
        assert config.RATELIMIT_STORAGE_URI == 'redis://:prodredispass@prodredis:6379/0'

    def test_get_config_invalid_env(self, monkeypatch):
        """get_config should raise error for invalid FLASK_ENV"""
        monkeypatch.setenv('FLASK_ENV', 'invalid')

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'FLASK_ENV' in str(exc_info.value)

    def test_get_config_missing_env(self, monkeypatch):
        """get_config should raise error if FLASK_ENV not set"""
        if 'FLASK_ENV' in os.environ:
            monkeypatch.delenv('FLASK_ENV')

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'FLASK_ENV' in str(exc_info.value)


class TestGetConfigValidation:
    """Test validation in get_config()"""

    def test_get_config_requires_database_vars_in_dev(self, monkeypatch):
        """get_config should raise error if DB vars missing in dev"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        # Missing all DB vars
        for var in ['MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_HOST', 'MYSQL_DATABASE']:
            if var in os.environ:
                monkeypatch.delenv(var)

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'MySQL' in str(exc_info.value)

    def test_get_config_requires_redis_vars_in_dev(self, monkeypatch):
        """get_config should raise error if Redis vars missing in dev"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        # Missing Redis vars
        for var in ['REDIS_HOST', 'REDIS_DB', 'REDIS_PASSWORD']:
            if var in os.environ:
                monkeypatch.delenv(var)

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'Redis' in str(exc_info.value)

    def test_get_config_requires_secret_key(self, monkeypatch):
        """get_config should raise error if SECRET_KEY missing"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')

        # Remove SECRET_KEY
        if 'SECRET_KEY' in os.environ:
            monkeypatch.delenv('SECRET_KEY')

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'SECRET_KEY' in str(exc_info.value)


class TestConfigValues:
    """Test specific configuration values"""

    def test_jwt_token_expiration_configured(self, monkeypatch):
        """JWT token expiration should be set"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config.JWT_ACCESS_TOKEN_EXPIRES == timedelta(minutes=15)
        assert config.JWT_REFRESH_TOKEN_EXPIRES == timedelta(days=30)

    def test_jwt_cookie_settings(self, monkeypatch):
        """JWT cookie settings should be configured for security"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config.JWT_COOKIE_HTTPONLY is True
        assert config.JWT_COOKIE_SAMESITE == 'Lax'
        assert config.JWT_COOKIE_CSRF_PROTECT is True

    def test_redis_defaults(self, monkeypatch):
        """Redis should have correct default values"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config.REDIS_PORT == 6379
        assert config.REDIS_MAX_CONNECTIONS == 50

    def test_database_port_default(self, monkeypatch):
        """Database should use default port 3306"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config.DB_PORT == 3306

    def test_rate_limiter_uses_redis_uri(self, monkeypatch):
        """Rate limiter should use Redis URI"""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'redishost')
        monkeypatch.setenv('REDIS_DB', '2')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config.RATELIMIT_STORAGE_URI == config.REDIS_URI
        assert config.RATELIMIT_STORAGE_URI == 'redis://:redispass@redishost:6379/2'


class TestConfigInheritance:
    """Test that child configs inherit from base Config"""

    def test_development_inherits_jwt_settings(self):
        """DevelopmentConfig should inherit JWT settings from Config"""
        config = DevelopmentConfig()

        assert hasattr(config, 'JWT_ACCESS_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_REFRESH_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_SECRET_KEY')

    def test_development_inherits_redis_settings(self):
        """DevelopmentConfig should inherit Redis settings from Config"""
        config = DevelopmentConfig()

        assert hasattr(config, 'REDIS_HOST')
        assert hasattr(config, 'REDIS_PORT')
        assert hasattr(config, 'REDIS_DB')
        assert hasattr(config, 'REDIS_PASSWORD')
        assert hasattr(config, 'REDIS_MAX_CONNECTIONS')
