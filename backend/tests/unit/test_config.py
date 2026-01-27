import pytest
import os
import sys
from datetime import timedelta

from app.config import (
    DevelopmentConfig,
    TestingConfig,
    ProductionConfig,
    get_config
)


@pytest.fixture(autouse=True)
def isolate_config_tests():
    """Isolate config tests from session env vars."""
    # Remove cached module
    if 'app.config' in sys.modules:
        del sys.modules['app.config']
    yield
    # Cleanup
    if 'app.config' in sys.modules:
        del sys.modules['app.config']


class TestBaseConfig:
    """Test base Config class."""

    def test_config_requires_database_env_vars(self):
        """Config should raise error if DB env vars missing."""
        # Clear env vars
        env_vars = ['MYSQL_USER', 'MYSQL_PASSWORD',
                    'MYSQL_HOST', 'MYSQL_DATABASE']
        original_values = {k: os.getenv(k) for k in env_vars}

        try:
            for var in env_vars:
                if var in os.environ:
                    del os.environ[var]

            with pytest.raises(ValueError) as exc_info:
                from app.config import Config
                Config()

            assert 'database' in str(exc_info.value).lower()

        finally:
            # Restore original values
            for k, v in original_values.items():
                if v is not None:
                    os.environ[k] = v

    def test_config_requires_secret_key(self, monkeypatch):
        """Config should raise error if SECRET_KEY missing."""
        # Set DB vars but remove SECRET_KEY
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')

        if 'SECRET_KEY' in os.environ:
            monkeypatch.delenv('SECRET_KEY')

        with pytest.raises(ValueError) as exc_info:
            from app.config import Config
            Config()

        assert 'SECRET_KEY' in str(exc_info.value)

    def test_database_uri_construction(self, monkeypatch):
        """Config should construct proper DATABASE_URI."""
        monkeypatch.setenv('MYSQL_USER', 'testuser')
        monkeypatch.setenv('MYSQL_PASSWORD', 'testpass')
        monkeypatch.setenv('MYSQL_HOST', 'testhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'testdb')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        from app.config import Config
        config = Config()

        expected_uri = 'mysql+pymysql://testuser:testpass@testhost:3306/testdb'
        assert config.SQLALCHEMY_DATABASE_URI == expected_uri

    def test_jwt_token_expiration_configured(self, monkeypatch):
        """JWT token expiration should be set."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        from app.config import Config
        config = Config()

        assert config.JWT_ACCESS_TOKEN_EXPIRES == timedelta(minutes=15)
        assert config.JWT_REFRESH_TOKEN_EXPIRES == timedelta(days=30)

    def test_jwt_cookie_settings(self, monkeypatch):
        """JWT cookie settings should be configured for security."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        from app.config import Config
        config = Config()

        assert config.JWT_COOKIE_HTTPONLY is True
        assert config.JWT_COOKIE_SAMESITE == 'Lax'
        assert config.JWT_COOKIE_CSRF_PROTECT is True


class TestDevelopmentConfig:
    """Test DevelopmentConfig."""

    def test_development_config_attributes(self, monkeypatch):
        """Development config should have correct attributes."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = DevelopmentConfig()

        assert config.FLASK_ENV == 'development'
        assert config.DEBUG is True
        assert config.TESTING is False

    def test_development_cors_origins(self, monkeypatch):
        """Development should have CORS origins set."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = DevelopmentConfig()

        assert hasattr(config, 'CORS_ORIGINS')
        assert 'http://localhost:5173' in config.CORS_ORIGINS


class TestTestingConfig:
    """Test TestingConfig."""

    def test_testing_config_attributes(self, monkeypatch):
        """Testing config should have correct attributes."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = TestingConfig()

        assert config.FLASK_ENV == 'testing'
        assert config.DEBUG is True
        assert config.TESTING is True

    def test_testing_uses_sqlite(self, monkeypatch):
        """Testing should use SQLite in-memory database."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = TestingConfig()

        assert config.SQLALCHEMY_DATABASE_URI == 'sqlite:///:memory:'


class TestProductionConfig:
    """Test ProductionConfig."""

    def test_production_config_attributes(self, monkeypatch):
        """Production config should have correct attributes."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = ProductionConfig()

        assert config.FLASK_ENV == 'production'
        assert config.DEBUG is False
        assert config.TESTING is False


class TestGetConfig:
    """Test get_config factory function."""

    def test_get_config_development(self, monkeypatch):
        """get_config should return DevelopmentConfig for dev env."""
        monkeypatch.setenv('FLASK_ENV', 'development')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert isinstance(config, type)
        assert config == DevelopmentConfig

    def test_get_config_testing(self, monkeypatch):
        """get_config should return TestingConfig for testing env."""
        monkeypatch.setenv('FLASK_ENV', 'testing')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config == TestingConfig

    def test_get_config_production(self, monkeypatch):
        """get_config should return ProductionConfig for prod env."""
        monkeypatch.setenv('FLASK_ENV', 'production')
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = get_config()

        assert config == ProductionConfig

    def test_get_config_invalid_env(self, monkeypatch):
        """get_config should raise error for invalid FLASK_ENV."""
        monkeypatch.setenv('FLASK_ENV', 'invalid')

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'FLASK_ENV' in str(exc_info.value)

    def test_get_config_missing_env(self, monkeypatch):
        """get_config should raise error if FLASK_ENV not set."""
        if 'FLASK_ENV' in os.environ:
            monkeypatch.delenv('FLASK_ENV')

        with pytest.raises(ValueError) as exc_info:
            get_config()

        assert 'FLASK_ENV' in str(exc_info.value)


class TestConfigInheritance:
    """Test that child configs inherit from base Config."""

    def test_development_inherits_jwt_settings(self, monkeypatch):
        """DevelopmentConfig should inherit JWT settings from Config."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = DevelopmentConfig()

        assert hasattr(config, 'JWT_ACCESS_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_REFRESH_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_SECRET_KEY')

    def test_testing_inherits_jwt_settings(self, monkeypatch):
        """TestingConfig should inherit JWT settings from Config."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = TestingConfig()

        assert hasattr(config, 'JWT_ACCESS_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_SECRET_KEY')

    def test_production_inherits_jwt_settings(self, monkeypatch):
        """ProductionConfig should inherit JWT settings from Config."""
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', 'testsecret')

        config = ProductionConfig()

        assert hasattr(config, 'JWT_ACCESS_TOKEN_EXPIRES')
        assert hasattr(config, 'JWT_SECRET_KEY')


class TestConfigSecurity:
    """Test security-related configuration."""

    def test_jwt_secret_key_set(self, monkeypatch):
        """JWT_SECRET_KEY should be set from environment."""
        secret = 'super-secret-key-12345'
        monkeypatch.setenv('MYSQL_USER', 'test')
        monkeypatch.setenv('MYSQL_PASSWORD', 'test')
        monkeypatch.setenv('MYSQL_HOST', 'localhost')
        monkeypatch.setenv('MYSQL_DATABASE', 'test')
        monkeypatch.setenv('SECRET_KEY', secret)

        from app.config import Config
        config = Config()

        assert config.JWT_SECRET_KEY == secret
