import pytest
from datetime import timedelta
from flask_jwt_extended import create_access_token

from app import create_app, db as _db
from app.models import User, Note


@pytest.fixture(scope='session')
def app():
    """Create and configure a Flask app instance for testing."""
    import os

    # Set testing environment variables
    os.environ['FLASK_ENV'] = 'testing'
    os.environ['SECRET_KEY'] = 'test-secret-key-12345'
    os.environ['MYSQL_USER'] = 'test'
    os.environ['MYSQL_PASSWORD'] = 'test'
    os.environ['MYSQL_HOST'] = 'localhost'
    os.environ['MYSQL_DATABASE'] = 'test'

    app = create_app()

    # Establish application context
    with app.app_context():
        yield app


@pytest.fixture(scope='function')
def db(app):
    """Create a fresh database for each test."""
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
    """Create a test client for making requests."""
    return app.test_client()


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
