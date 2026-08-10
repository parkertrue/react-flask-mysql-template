import pytest
import time
from datetime import timedelta
from flask_jwt_extended import create_access_token

import app as _app_module
from app import create_app, db as _db
from app.models import User, Note


# ============================================================================
# UNIT TEST FIXTURES (Fast, SQLite in-memory, no Redis)
# ============================================================================

@pytest.fixture(scope='session')
def app():
    """Unit test app - fast SQLite in-memory, no real services needed

    Uses TestingConfig which:
    - Sets FLASK_ENV=testing
    - Uses SQLite in-memory (no MySQL needed)
    - Disables Redis
    - Disables rate limiting

    Note: Config reads from environment, but TestingConfig overrides with
    in-memory SQLite regardless of MYSQL_* env vars.
    """
    import os

    # Only set FLASK_ENV to trigger TestingConfig; everything else comes from
    # TestingConfig defaults or the ambient environment.
    os.environ['FLASK_ENV'] = 'testing'

    # SECRET_KEY is required by the Config base class
    if 'SECRET_KEY' not in os.environ:
        os.environ['SECRET_KEY'] = 'test-secret-key-12345'

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

        @event.listens_for(Engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db):
    """Unit test client"""
    return app.test_client()


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
    - Enables CORS for testing

    Environment variables are loaded by run_tests.sh from .env.test. If running
    pytest directly, ensure .env.test is loaded first.
    """
    import os

    os.environ['FLASK_ENV'] = 'integration'

    required_vars = ['MYSQL_DATABASE', 'MYSQL_HOST', 'REDIS_HOST']
    missing = [v for v in required_vars if v not in os.environ]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {missing}\n"
            f"Make sure to run tests with ./run_tests.sh which loads .env.test"
        )

    app = create_app()

    with app.app_context():
        # Wait for test services to be ready
        max_retries = 30
        retry_delay = 1

        for attempt in range(1, max_retries + 1):
            try:
                _db.engine.connect()

                if _app_module.redis_service:
                    _app_module.redis_service.get_client().ping()
                    print(
                        f"Test services ready (attempt {attempt}/{max_retries})")
                else:
                    print("Redis is disabled in IntegrationConfig")

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

    Skips the test if Redis is unavailable. Flushes the db after each test to
    keep tests isolated.
    """
    with integration_app.app_context():
        if _app_module.redis_service is None:
            pytest.skip("Redis is not enabled for integration tests")

        yield _app_module.redis_service

        if _app_module.redis_service:
            try:
                _app_module.redis_service.get_client().flushdb()
            except Exception as e:
                print(f"Failed to flush Redis: {e}")


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
