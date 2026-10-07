import os
import pytest
import time
from datetime import timedelta
from flask_jwt_extended import create_access_token

from app import create_app, db as _db
from app.models import User, Note

# Every config requires SECRET_KEY, including the ones tests build directly.
# Integration runs get theirs from .env.test, which this does not override.
os.environ.setdefault('SECRET_KEY', 'test-secret-key-0123456789abcdef')


# ============================================================================
# UNIT TEST FIXTURES (Fast, SQLite in-memory, no Redis)
# ============================================================================

@pytest.fixture(scope='session')
def app():
    """Unit test app - fast SQLite in-memory, no real services needed

    Uses UnitTestConfig which:
    - Sets APP_ENV=unit
    - Uses SQLite in-memory (no MySQL needed)
    - Disables Redis
    - Disables rate limiting

    Note: Config reads from environment, but UnitTestConfig overrides with
    in-memory SQLite regardless of DB_* env vars.
    """
    # Only set APP_ENV to trigger UnitTestConfig; everything else comes from
    # UnitTestConfig defaults or the ambient environment.
    os.environ['APP_ENV'] = 'unit'

    app = create_app()

    with app.app_context():
        yield app


@pytest.fixture(scope='function')
def db(app):
    """Unit test database - SQLite in-memory"""
    with app.app_context():
        # Enable foreign keys for SQLite
        from sqlalchemy import event
        from sqlalchemy.engine import Engine

        @event.listens_for(Engine, 'connect')
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute('PRAGMA foreign_keys=ON')
            cursor.close()

        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db):
    """Unit test client"""
    return app.test_client()


class FakeRedisService:
    """In-memory stand-in for RedisService's refresh-token methods."""

    def __init__(self):
        self.tokens = set()  # {(user_id, jti)}

    def store_refresh_token(self, user_id, jti, ttl_seconds, replaces=None):
        self.tokens.discard((user_id, replaces))
        self.tokens.add((user_id, jti))
        return True

    def is_token_valid(self, user_id, jti):
        return (user_id, jti) in self.tokens

    def revoke_token(self, user_id, jti):
        present = (user_id, jti) in self.tokens
        self.tokens.discard((user_id, jti))
        return present

    def revoke_all_user_tokens(self, user_id):
        mine = {t for t in self.tokens if t[0] == user_id}
        self.tokens -= mine
        return len(mine)


@pytest.fixture
def fake_redis(app):
    """Give the unit app a Redis token store.

    UnitTestConfig disables Redis, and without it the blocklist loader fails
    closed, so every refresh-cookie route would return 401.
    """
    fake = FakeRedisService()
    app.extensions['redis_service'] = fake
    yield fake
    app.extensions['redis_service'] = None


# ============================================================================
# INTEGRATION TEST FIXTURES (Real MySQL + Redis from docker-compose.test.yml)
# ============================================================================

@pytest.fixture(scope='session')
def integration_app():
    """Integration test app - uses real MySQL + Redis

    Uses IntegrationConfig which:
    - Reads MySQL/Redis connection details from environment
    - Connects to test services on ports 3307 (MySQL) and 6380 (Redis)
    - Disables rate limiting for test speed

    Environment variables are loaded by run_tests.sh from .env.test. If running
    pytest directly, ensure .env.test is loaded first.
    """
    os.environ['APP_ENV'] = 'integration'

    required_vars = ['DB_NAME', 'DB_HOST', 'REDIS_HOST']
    missing = [v for v in required_vars if v not in os.environ]
    if missing:
        raise RuntimeError(
            f'Missing required environment variables: {missing}\n'
            f'Make sure to run tests with ./run_tests.sh which loads .env.test'
        )

    app = create_app()

    with app.app_context():
        # Wait for test services to be ready
        max_retries = 30
        retry_delay = 1

        for attempt in range(1, max_retries + 1):
            try:
                with _db.engine.connect():
                    pass

                break

            except Exception as e:
                if attempt == max_retries:
                    raise RuntimeError(
                        f"Test services not ready after {max_retries} attempts "
                        f"({max_retries}s). Error: {e}\n"
                        f"Make sure 'docker compose -f docker-compose.test.yml "
                        f"up -d' is running."
                    )
                time.sleep(retry_delay)

        # IntegrationConfig enables Redis, so a missing service means it failed
        # to connect in create_app(). Fail here rather than let every
        # Redis-backed test skip and the suite report green.
        if app.extensions['redis_service'] is None:
            raise RuntimeError(
                'Redis failed to initialise; see the log above. Make sure '
                'docker-compose.test.yml services are healthy.')

        yield app


@pytest.fixture(scope='function')
def integration_db(integration_app):
    """Integration test database - real MySQL

    Creates a fresh schema before each test and drops it after, so tests stay
    isolated from one another.
    """
    with integration_app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def integration_client(integration_app, integration_db):
    """Integration test client"""
    return integration_app.test_client()


@pytest.fixture(scope='function')
def integration_redis(integration_app):
    """Integration test Redis - real Redis

    Deletes the app's keys after each test to keep tests isolated. FLUSHDB
    is not an option: the app's ACL user may not run it.
    """
    with integration_app.app_context():
        redis_service = integration_app.extensions['redis_service']
        yield redis_service
        client = redis_service.get_client()
        for pattern in ('refresh_tokens:*', 'LIMITS:*'):
            keys = list(client.scan_iter(pattern))
            if keys:
                client.delete(*keys)


@pytest.fixture
def integration_user(integration_db):
    """Sample user for integration tests"""
    user = User(email='integration@test.com')
    user.set_password('TestPassword123')
    integration_db.session.add(user)
    integration_db.session.commit()
    integration_db.session.refresh(user)
    return user


# ============================================================================
# SHARED FIXTURES - users, tokens, and notes
# ============================================================================

@pytest.fixture
def sample_user(db):
    """Create a sample user for testing."""
    user = User(email='test@example.com')
    user.set_password('TestPassword123')
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return user


@pytest.fixture
def second_user(db):
    """Create a second user for authorization tests."""
    user = User(email='other@example.com')
    user.set_password('OtherPassword123')
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return user


@pytest.fixture
def auth_token(app, sample_user):
    """Generate a valid JWT token for the sample user."""
    with app.app_context():
        token = create_access_token(identity=str(sample_user.id))
        return token


@pytest.fixture
def second_auth_token(app, second_user):
    """Generate a valid JWT token for the second user."""
    with app.app_context():
        token = create_access_token(identity=str(second_user.id))
        return token


@pytest.fixture
def expired_token(app, sample_user):
    """Generate an expired JWT token."""
    with app.app_context():
        token = create_access_token(
            identity=str(sample_user.id),
            expires_delta=timedelta(seconds=-1)
        )
        return token


@pytest.fixture
def sample_note(db, sample_user):
    """Create a single note for the sample user."""
    note = Note(
        user_id=sample_user.id,
        content='This is a test note'
    )
    db.session.add(note)
    db.session.commit()
    db.session.refresh(note)
    return note


@pytest.fixture
def sample_notes(db, sample_user):
    """Create multiple notes for the sample user."""
    notes = [
        Note(user_id=sample_user.id, content='First note'),
        Note(user_id=sample_user.id, content='Second note'),
        Note(user_id=sample_user.id, content='Third note'),
    ]
    db.session.add_all(notes)
    db.session.commit()
    for note in notes:
        db.session.refresh(note)
    return notes


@pytest.fixture
def other_user_note(db, second_user):
    """Create a note belonging to a different user."""
    note = Note(
        user_id=second_user.id,
        content='Note from another user'
    )
    db.session.add(note)
    db.session.commit()
    db.session.refresh(note)
    return note


@pytest.fixture
def auth_headers(auth_token):
    """Generate authorization headers with valid token."""
    return {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }


@pytest.fixture
def second_auth_headers(second_auth_token):
    """Generate authorization headers for second user."""
    return {
        'Authorization': f'Bearer {second_auth_token}',
        'Content-Type': 'application/json'
    }
