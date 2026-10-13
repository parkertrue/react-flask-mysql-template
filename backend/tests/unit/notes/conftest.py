"""Fixtures for the notes example's tests; shared fixtures are in tests/conftest.py."""
import pytest
from sqlalchemy import insert

from app.notes.models import NOTES_MAX_PER_USER, Note


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
def notes_one_below_cap(db, sample_user):
    """The sample user keeps one note fewer than NOTES_MAX_PER_USER."""
    db.session.execute(insert(Note), [
        {'user_id': sample_user.id, 'content': f'Note {i}'}
        for i in range(NOTES_MAX_PER_USER - 1)
    ])
    db.session.commit()
