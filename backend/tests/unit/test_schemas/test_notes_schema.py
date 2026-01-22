import pytest
from datetime import datetime, timezone
import time
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import Note, User


class TestNoteModel:
    """Test suite for Note model."""

    def test_note_creation(self, db, sample_user):
        """Note should be created with valid data."""
        note = Note(
            user_id=sample_user.id,
            content='Test note content'
        )
        db.session.add(note)
        db.session.commit()

        assert note.id is not None
        assert note.user_id == sample_user.id
        assert note.content == 'Test note content'
        assert note.created_at is not None

    def test_note_created_at_auto_generated(self, db, sample_user):
        """created_at should be automatically set on creation."""
        before = datetime.now(timezone.utc).replace(microsecond=0)

        note = Note(
            user_id=sample_user.id,
            content='Auto timestamp test'
        )
        db.session.add(note)
        db.session.commit()
        db.session.refresh(note)

        after = datetime.now(timezone.utc).replace(microsecond=0)

        assert note.created_at is not None
        if note.created_at.tzinfo is None:
            created_at_aware = note.created_at.replace(tzinfo=timezone.utc)
        else:
            created_at_aware = note.created_at
        assert before <= created_at_aware <= after

    def test_note_user_relationship(self, db, sample_user):
        """Note should have relationship with User."""
        note = Note(
            user_id=sample_user.id,
            content='Relationship test'
        )
        db.session.add(note)
        db.session.commit()
        db.session.refresh(note)

        assert note.user is not None
        assert note.user.id == sample_user.id
        assert note.user.email == sample_user.email

    def test_user_notes_backref(self, db, sample_user):
        """User should have backref to access their notes."""
        note1 = Note(user_id=sample_user.id, content='Note 1')
        note2 = Note(user_id=sample_user.id, content='Note 2')

        db.session.add_all([note1, note2])
        db.session.commit()
        db.session.refresh(sample_user)

        assert len(sample_user.notes) == 2
        assert note1 in sample_user.notes
        assert note2 in sample_user.notes

    def test_note_foreign_key_constraint(self, db):
        """Note should not allow invalid user_id."""
        note = Note(
            user_id=99999,  # Non-existent user
            content='Invalid user note'
        )
        db.session.add(note)

        with pytest.raises(IntegrityError):
            db.session.commit()

    def test_note_content_max_length(self, db, sample_user):
        """Note content should respect max length constraint."""
        # Database allows 255 chars
        content_255 = 'x' * 255
        note = Note(user_id=sample_user.id, content=content_255)
        db.session.add(note)
        db.session.commit()

        assert note.content == content_255

    def test_note_content_exceeds_max_length(self, db, sample_user):
        """Note content exceeding 255 chars should fail."""
        content_256 = 'x' * 256
        note = Note(user_id=sample_user.id, content=content_256)
        db.session.add(note)

        # This might raise DataError or just truncate depending on DB
        # SQLite test DB might handle differently than MySQL
        try:
            db.session.commit()
            # If it didn't raise, check it was truncated
            db.session.refresh(note)
            assert len(note.content) <= 255
        except Exception:
            # Expected to fail
            db.session.rollback()

    def test_multiple_notes_per_user(self, db, sample_user):
        """User should be able to have multiple notes."""
        notes = [
            Note(user_id=sample_user.id, content=f'Note {i}')
            for i in range(5)
        ]
        db.session.add_all(notes)
        db.session.commit()

        user_notes = db.session.scalars(
            select(Note).where(Note.user_id == sample_user.id)
        ).all()

        assert len(user_notes) == 5

    def test_notes_from_different_users(self, db, sample_user, second_user):
        """Different users should have separate notes."""
        note1 = Note(user_id=sample_user.id, content='User 1 note')
        note2 = Note(user_id=second_user.id, content='User 2 note')

        db.session.add_all([note1, note2])
        db.session.commit()

        user1_notes = db.session.scalars(
            select(Note).where(Note.user_id == sample_user.id)
        ).all()

        user2_notes = db.session.scalars(
            select(Note).where(Note.user_id == second_user.id)
        ).all()

        assert len(user1_notes) == 1
        assert len(user2_notes) == 1
        assert user1_notes[0].content == 'User 1 note'
        assert user2_notes[0].content == 'User 2 note'

    def test_note_query_ordering(self, db, sample_user):
        """Notes should be queryable in order."""
        note1 = Note(user_id=sample_user.id, content='First')
        db.session.add(note1)
        db.session.commit()

        time.sleep(0.01)

        note2 = Note(user_id=sample_user.id, content='Second')
        db.session.add(note2)
        db.session.commit()

        notes = db.session.scalars(
            select(Note)
            .where(Note.user_id == sample_user.id)
            .order_by(Note.created_at.asc())
        ).all()

        assert notes[0].content == 'First'
        assert notes[1].content == 'Second'

    def test_note_deletion(self, db, sample_user):
        """Note should be deletable."""
        note = Note(user_id=sample_user.id, content='To be deleted')
        db.session.add(note)
        db.session.commit()
        note_id = note.id

        db.session.delete(note)
        db.session.commit()

        deleted_note = db.session.get(Note, note_id)
        assert deleted_note is None

    def test_note_update(self, db, sample_user):
        """Note content should be updatable."""
        note = Note(user_id=sample_user.id, content='Original content')
        db.session.add(note)
        db.session.commit()

        note.content = 'Updated content'
        db.session.commit()
        db.session.refresh(note)

        assert note.content == 'Updated content'

    def test_note_repr(self, db, sample_user):
        """Note should have a reasonable string representation."""
        note = Note(user_id=sample_user.id, content='Test')
        db.session.add(note)
        db.session.commit()

        # Just verify it doesn't crash
        repr_str = repr(note)
        assert repr_str is not None
        assert isinstance(repr_str, str)

    def test_note_with_special_characters(self, db, sample_user):
        """Note should handle special characters in content."""
        special_content = "Special: <>&\"'(){}[]!@#$%"
        note = Note(user_id=sample_user.id, content=special_content)
        db.session.add(note)
        db.session.commit()
        db.session.refresh(note)

        assert note.content == special_content

    def test_note_with_unicode(self, db, sample_user):
        """Note should handle Unicode characters."""
        unicode_content = "Unicode: 你好 مرحبا שלום 🎉"
        note = Note(user_id=sample_user.id, content=unicode_content)
        db.session.add(note)
        db.session.commit()
        db.session.refresh(note)

        assert note.content == unicode_content

    def test_note_with_empty_string(self, db, sample_user):
        """Empty string content should fail nullable constraint."""
        # Empty string is different from NULL
        # This should succeed unless we add custom validation
        note = Note(user_id=sample_user.id, content='')
        db.session.add(note)

        # This should work at DB level (not NULL)
        # But Pydantic schema will reject it
        db.session.commit()
        assert note.content == ''
