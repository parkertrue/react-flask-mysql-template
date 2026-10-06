import pytest
import os
from datetime import timedelta

from app.config import (
    Config,
    DevelopmentConfig,
    TestingConfig,
    IntegrationConfig,
    ProductionConfig,
    get_config
)

STRONG_SECRET = 'x' * 32

SERVICE_ENV = {
    'MYSQL_USER': 'user',
    'MYSQL_PASSWORD': 'pass',
    'MYSQL_HOST': 'mysqlhost',
    'MYSQL_DATABASE': 'db',
    'REDIS_HOST': 'redishost',
    'REDIS_PASSWORD': 'redispass',
}


@pytest.fixture(autouse=True)
def isolate_config_tests(monkeypatch):
    """Give every test the same environment, whatever the shell has loaded.

    Optional vars are cleared so tests see the documented defaults, and the
    MySQL/Redis vars the non-testing configs require are set to placeholders.
    Tests that need other values set or delete them with monkeypatch.
    """
    for var in ('MYSQL_PORT', 'REDIS_PORT', 'REDIS_DB', 'FLASK_DEBUG', 'E2E_MODE'):
        monkeypatch.delenv(var, raising=False)
    for var, value in SERVICE_ENV.items():
        monkeypatch.setenv(var, value)


class TestConfigClasses:
    """Test Config class attributes"""

    def test_config_class_reads_env_vars(self, monkeypatch):
        """Config class should read environment variables"""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('REDIS_HOST', 'localhost')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = Config()

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
        assert config.REDIS_ENABLED is True
        assert config.RATELIMIT_ENABLED is True

    def test_testing_config_attributes(self):
        """TestingConfig should have correct attributes"""
        config = TestingConfig()

        assert config.FLASK_ENV == 'testing'
        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'
        assert config.REDIS_ENABLED is False
        assert config.RATELIMIT_ENABLED is False

    def test_integration_config_attributes(self):
        """IntegrationConfig should disable rate limiting"""
        config = IntegrationConfig()

        assert config.FLASK_ENV == 'integration'
        assert config.REDIS_ENABLED is True
        assert config.RATELIMIT_ENABLED is False

    def test_integration_config_without_e2e_mode(self, monkeypatch):
        """Without E2E_MODE, cookie security and CSRF are off for API tests"""
        monkeypatch.delenv('E2E_MODE', raising=False)
        config = IntegrationConfig()

        assert config.JWT_COOKIE_SECURE is False
        assert config.JWT_COOKIE_CSRF_PROTECT is False

    def test_integration_config_with_e2e_mode(self, monkeypatch):
        """With E2E_MODE, the browser-facing protections come back on"""
        monkeypatch.setenv('E2E_MODE', 'true')
        config = IntegrationConfig()

        assert config.JWT_COOKIE_SECURE is True
        assert config.JWT_COOKIE_CSRF_PROTECT is True

    def test_production_config_attributes(self, monkeypatch):
        """ProductionConfig should have correct attributes"""
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)
        config = ProductionConfig()

        assert config.FLASK_ENV == 'production'
        assert config.FLASK_DEBUG is False
        assert config.JWT_COOKIE_SECURE is True
        assert config.REDIS_ENABLED is True
        assert config.RATELIMIT_ENABLED is True


class TestGetConfigFactory:
    """Test get_config() factory function"""

    def test_get_config_development(self, monkeypatch):
        """get_config should return DevelopmentConfig for dev env"""
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

        assert isinstance(config, DevelopmentConfig)
        assert config.FLASK_ENV == 'development'
        assert config.SQLALCHEMY_DATABASE_URI == 'mysql+pymysql://testuser:testpass@testhost:3306/testdb'
        assert config.REDIS_URI == 'redis://:redispass@redishost:6379/1'
        assert config.RATELIMIT_STORAGE_URI == 'redis://:redispass@redishost:6379/1'

    def test_get_config_testing(self, monkeypatch):
        """get_config should return TestingConfig for testing env"""
        monkeypatch.setenv('FLASK_ENV', 'testing')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert isinstance(config, TestingConfig)
        assert config.FLASK_ENV == 'testing'
        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'
        assert config.REDIS_ENABLED is False
        assert config.RATELIMIT_ENABLED is False

    def test_e2e_mode_cannot_downgrade_production(self, monkeypatch):
        """E2E_MODE must not swap ProductionConfig for a weaker config"""
        monkeypatch.setenv('FLASK_ENV', 'production')
        monkeypatch.setenv('E2E_MODE', 'true')
        monkeypatch.setenv('MYSQL_USER', 'produser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'prodpass')
        monkeypatch.setenv('MYSQL_HOST', 'prodhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'proddb')
        monkeypatch.setenv('REDIS_HOST', 'prodredis')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'prodredispass')
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)

        config = get_config()

        assert isinstance(config, ProductionConfig)
        assert config.FLASK_ENV == 'production'
        assert config.RATELIMIT_ENABLED is True
        assert config.REDIS_ENABLED is True
        assert config.JWT_COOKIE_SECURE is True

    def test_get_config_production(self, monkeypatch):
        """get_config should return ProductionConfig for prod env"""
        monkeypatch.setenv('FLASK_ENV', 'production')
        monkeypatch.setenv('MYSQL_USER', 'produser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'prodpass')
        monkeypatch.setenv('MYSQL_HOST', 'prodhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'proddb')
        monkeypatch.setenv('REDIS_HOST', 'prodredis')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'prodredispass')
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)

        config = get_config()

        assert isinstance(config, ProductionConfig)
        assert config.FLASK_ENV == 'production'
        assert config.SQLALCHEMY_DATABASE_URI == 'mysql+pymysql://produser:prodpass@prodhost:3306/proddb'
        assert config.REDIS_URI == 'redis://:prodredispass@prodredis:6379/0'
        assert config.RATELIMIT_STORAGE_URI == 'redis://:prodredispass@prodredis:6379/0'

    def test_get_config_invalid_env(self, monkeypatch):
        """get_config should raise error for invalid FLASK_ENV"""
        monkeypatch.setenv('FLASK_ENV', 'invalid')

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'FLASK_ENV' in str(exc_info.value)
        assert 'invalid' in str(exc_info.value)

    def test_get_config_defaults_to_production(self, monkeypatch):
        """get_config should default to production if FLASK_ENV not set"""
        if 'FLASK_ENV' in os.environ:
            monkeypatch.delenv('FLASK_ENV')

        monkeypatch.setenv('MYSQL_USER', 'produser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'prodpass')
        monkeypatch.setenv('MYSQL_HOST', 'prodhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'proddb')
        monkeypatch.setenv('REDIS_HOST', 'prodredis')
        monkeypatch.setenv('REDIS_DB', '0')
        monkeypatch.setenv('REDIS_PASSWORD', 'prodredispass')
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)

        config = get_config()

        assert isinstance(config, ProductionConfig)
        assert config.FLASK_ENV == 'production'


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
        for var in ['REDIS_HOST', 'REDIS_PASSWORD']:
            if var in os.environ:
                monkeypatch.delenv(var)

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'Redis' in str(exc_info.value)

    def test_testing_config_needs_no_service_vars(self, monkeypatch):
        """Unit tests use SQLite with Redis off, so need no MySQL/Redis settings"""
        monkeypatch.setenv('FLASK_ENV', 'testing')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')
        for var in SERVICE_ENV:
            monkeypatch.delenv(var)

        config = get_config()

        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'
        assert config.REDIS_URI is None

    @pytest.mark.parametrize('config_class', [IntegrationConfig, ProductionConfig])
    def test_service_configs_still_require_vars(self, monkeypatch, config_class):
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)
        monkeypatch.delenv('MYSQL_HOST')

        with pytest.raises(ValueError, match='MySQL'):
            config_class()

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
        monkeypatch.delenv('REDIS_DB', raising=False)
        monkeypatch.setenv('REDIS_PASSWORD', 'redispass')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config.REDIS_PORT == 6379
        assert config.REDIS_DB == '0'
        assert config.REDIS_URI == 'redis://:redispass@localhost:6379/0'
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

    def test_integration_inherits_from_config(self):
        """IntegrationConfig should inherit all base settings"""
        config = IntegrationConfig()

        assert hasattr(config, 'JWT_ACCESS_TOKEN_EXPIRES')
        assert hasattr(config, 'REDIS_HOST')
        assert hasattr(config, 'SQLALCHEMY_DATABASE_URI')


class TestRateLimitBehavior:
    """Test rate limiting configuration across environments"""

    def test_rate_limiting_enabled_in_development(self):
        """Rate limiting should be enabled in development"""
        config = DevelopmentConfig()
        assert config.RATELIMIT_ENABLED is True

    def test_rate_limiting_disabled_in_testing(self):
        """Rate limiting should be disabled in testing"""
        config = TestingConfig()
        assert config.RATELIMIT_ENABLED is False

    def test_rate_limiting_disabled_in_integration(self):
        """Rate limiting is off in integration to allow unlimited test traffic"""
        config = IntegrationConfig()
        assert config.RATELIMIT_ENABLED is False

    def test_rate_limiting_enabled_in_production(self, monkeypatch):
        """Rate limiting should be enabled in production"""
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)
        config = ProductionConfig()
        assert config.RATELIMIT_ENABLED is True


class TestProductionSecretKey:
    """ProductionConfig refuses secrets that would let anyone forge JWTs"""

    def test_rejects_short_secret(self, monkeypatch):
        monkeypatch.setenv('SECRET_KEY', 'x' * 31)

        with pytest.raises(ValueError, match='SECRET_KEY'):
            ProductionConfig()

    def test_rejects_template_placeholder(self, monkeypatch):
        monkeypatch.setenv('SECRET_KEY', 'your_secret_key_here')

        with pytest.raises(ValueError, match='SECRET_KEY'):
            ProductionConfig()

    def test_accepts_long_secret(self, monkeypatch):
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)

        assert ProductionConfig().JWT_SECRET_KEY == STRONG_SECRET

    @pytest.mark.parametrize('var, placeholder', [
        ('MYSQL_PASSWORD', 'your_db_password_here'),
        ('REDIS_PASSWORD', 'your_redis_password_here'),
        # The migrate service passes the root password as MYSQL_PASSWORD
        ('MYSQL_PASSWORD', 'your_root_password_here'),
    ])
    def test_rejects_placeholder_passwords(self, monkeypatch, var, placeholder):
        monkeypatch.setenv('SECRET_KEY', STRONG_SECRET)
        monkeypatch.setenv(var, placeholder)

        with pytest.raises(ValueError, match=var):
            ProductionConfig()

    def test_short_secret_allowed_outside_production(self, monkeypatch):
        monkeypatch.setenv('SECRET_KEY', 'short')

        assert DevelopmentConfig().JWT_SECRET_KEY == 'short'


class TestConnectionUris:
    """Credentials must survive URI parsing whatever characters they contain"""

    def test_special_characters_are_encoded(self, monkeypatch):
        monkeypatch.setenv('MYSQL_USER', 'app')
        monkeypatch.setenv('MYSQL_PASSWORD', 'p@ss/w:rd#1')
        monkeypatch.setenv('REDIS_PASSWORD', 'r@dis/pw')

        config = DevelopmentConfig()

        from sqlalchemy.engine import make_url
        from redis.connection import parse_url
        assert make_url(config.SQLALCHEMY_DATABASE_URI).password == 'p@ss/w:rd#1'
        assert make_url(config.SQLALCHEMY_DATABASE_URI).host == config.DB_HOST
        assert parse_url(config.REDIS_URI)['password'] == 'r@dis/pw'
