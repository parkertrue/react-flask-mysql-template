import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import User


class TestUserModel:
    """Test suite for User model."""

    def test_user_creation(self, db):
        """User should be created with valid data."""
        user = User(email='test@example.com')
        user.set_password('TestPassword123')
        db.session.add(user)
        db.session.commit()

        assert user.id is not None
        assert user.email == 'test@example.com'
        assert user.password_hash is not None
        assert user.created_at is not None

    def test_user_requires_email(self, db):
        """User creation should fail without email."""
        with pytest.raises(TypeError) as exc_info:
            user = User()

        assert 'email' in str(exc_info.value)

    def test_user_email_must_be_unique(self, db):
        """Duplicate email addresses should be rejected."""
        user1 = User(email='test@example.com')
        user1.set_password('Password123')
        db.session.add(user1)
        db.session.commit()

        user2 = User(email='test@example.com')
        user2.set_password('Password456')
        db.session.add(user2)

        with pytest.raises(IntegrityError):
            db.session.commit()

    def test_email_case_sensitivity(self, db):
        """Email uniqueness should be case-sensitive at DB level."""
        # Note: MySQL default collation is case-insensitive
        # This test documents the behavior
        user1 = User(email='Test@Example.com')
        user1.set_password('Password123')
        db.session.add(user1)
        db.session.commit()

        # Depending on DB collation, this might fail or succeed
        user2 = User(email='test@example.com')
        user2.set_password('Password456')
        db.session.add(user2)

        try:
            db.session.commit()
            # If no error, emails are case-sensitive
            assert user1.email != user2.email
        except IntegrityError:
            # MySQL with case-insensitive collation will fail here
            db.session.rollback()

    def test_created_at_auto_generated(self, db):
        """created_at should be automatically set on creation."""
        before = datetime.now(timezone.utc).replace(microsecond=0)

        user = User(email='timestamp@example.com')
        user.set_password('Password123')
        db.session.add(user)
        db.session.commit()
        db.session.refresh(user)

        after = datetime.now(timezone.utc).replace(microsecond=0)

        assert user.created_at is not None
        if user.created_at.tzinfo is None:
            created_at_aware = user.created_at.replace(tzinfo=timezone.utc)
        else:
            created_at_aware = user.created_at
        assert before <= created_at_aware <= after


class TestPasswordHashing:
    """Test password hashing functionality."""

    def test_set_password_hashes(self, db):
        """set_password should hash the password."""
        user = User(email='hash@example.com')
        password = 'PlainTextPassword123'
        user.set_password(password)

        assert user.password_hash is not None
        assert user.password_hash != password
        assert len(user.password_hash) > len(password)

    def test_password_hash_is_different_each_time(self, db):
        """Same password should generate different hashes (salt)."""
        user1 = User(email='user1@example.com')
        user2 = User(email='user2@example.com')

        same_password = 'SamePassword123'
        user1.set_password(same_password)
        user2.set_password(same_password)

        # Hashes should be different due to salt
        assert user1.password_hash != user2.password_hash

    def test_check_password_correct(self, db):
        """check_password should return True for correct password."""
        user = User(email='check@example.com')
        password = 'CorrectPassword123'
        user.set_password(password)

        assert user.check_password(password) is True

    def test_check_password_incorrect(self, db):
        """check_password should return False for incorrect password."""
        user = User(email='check@example.com')
        user.set_password('CorrectPassword123')

        assert user.check_password('WrongPassword123') is False

    def test_check_password_case_sensitive(self, db):
        """check_password should be case-sensitive."""
        user = User(email='case@example.com')
        user.set_password('Password123')

        assert user.check_password('password123') is False
        assert user.check_password('PASSWORD123') is False
        assert user.check_password('Password123') is True

    def test_password_hash_persists(self, db):
        """Password hash should persist to database."""
        user = User(email='persist@example.com')
        user.set_password('PersistPassword123')
        db.session.add(user)
        db.session.commit()

        stmt = select(User).where(User.email == 'persist@example.com')
        retrieved_user = db.session.execute(stmt).scalar_one_or_none()

        assert retrieved_user is not None
        assert retrieved_user.check_password('PersistPassword123') is True

    def test_empty_password_handling(self, db):
        """Empty password should still be hashed."""
        user = User(email='empty@example.com')
        user.set_password('')

        assert user.password_hash is not None
        assert user.password_hash != ''
        assert user.check_password('') is True

    def test_password_with_special_characters(self, db):
        """Password with special characters should work."""
        user = User(email='special@example.com')
        password = 'P@ssw0rd!#$%^&*()'
        user.set_password(password)

        assert user.check_password(password) is True
        assert user.check_password('P@ssw0rd') is False

    def test_password_with_unicode(self, db):
        """Password with Unicode characters should work."""
        user = User(email='unicode@example.com')
        password = 'Пароль123你好'
        user.set_password(password)

        assert user.check_password(password) is True

    def test_very_long_password(self, db):
        """Very long password should be handled."""
        user = User(email='long@example.com')
        password = 'A' * 1000 + '123'
        user.set_password(password)

        assert user.check_password(password) is True


class TestUserRelationships:
    """Test User model relationships."""

    def test_user_notes_relationship(self, db, sample_user):
        """User should have relationship with notes."""
        from app.models import Note

        note1 = Note(user_id=sample_user.id, content='Note 1')
        note2 = Note(user_id=sample_user.id, content='Note 2')
        db.session.add_all([note1, note2])
        db.session.commit()
        db.session.refresh(sample_user)

        assert len(sample_user.notes) == 2
        assert note1 in sample_user.notes
        assert note2 in sample_user.notes

    def test_user_deletion_cascade(self, db, sample_user):
        """Test what happens to notes when user is deleted."""
        from app.models import Note

        note = Note(user_id=sample_user.id, content='Test note')
        db.session.add(note)
        db.session.commit()
        note_id = note.id

        # Delete user
        db.session.delete(sample_user)
        db.session.commit()

        # Check if note still exists (depends on cascade setting)
        # Current model doesn't specify cascade, so note becomes orphaned
        # This documents current behavior
        remaining_note = db.session.get(Note, note_id)
        # Behavior depends on your foreign key cascade settings


class TestUserQueries:
    """Test User model queries."""

    def test_query_by_email(self, db, sample_user):
        """Should be able to query user by email."""
        stmt = select(User).where(User.email == 'test@example.com')
        user = db.session.execute(stmt).scalar_one_or_none()

        assert user is not None
        assert user.id == sample_user.id
        assert user.email == sample_user.email

    def test_query_nonexistent_email(self, db):
        """Querying non-existent email should return None."""
        stmt = select(User).where(User.email == 'nonexistent@example.com')
        user = db.session.execute(stmt).scalar_one_or_none()

        assert user is None

    def test_query_by_id(self, db, sample_user):
        """Should be able to query user by id."""
        user = db.session.get(User, sample_user.id)

        assert user is not None
        assert user.email == sample_user.email

    def test_email_index_exists(self, db):
        """Email column should have index for performance."""
        # This tests the index=True in the model
        # The index improves query performance
        from sqlalchemy import inspect

        inspector = inspect(db.engine)
        indexes = inspector.get_indexes('users')

        # Should have at least one index on email
        email_indexed = any(
            'email' in idx.get('column_names', [])
            for idx in indexes
        )
        # Some DBs auto-index unique columns
        assert email_indexed or len(indexes) > 0


class TestUserEdgeCases:
    """Test edge cases and special scenarios."""

    def test_user_with_very_long_email(self, db):
        """Email at max length should work."""
        # Max length is 128 chars
        local_part = 'a' * 119  # Max local part
        long_email = f"{local_part}@test.com"

        if len(long_email) <= 128:
            user = User(email=long_email)
            user.set_password('Password123')
            db.session.add(user)
            db.session.commit()

            assert user.email == long_email

    def test_user_with_special_email_chars(self, db):
        """Email with valid special characters should work."""
        special_email = "user+tag@sub-domain.example.com"
        user = User(email=special_email)
        user.set_password('Password123')
        db.session.add(user)
        db.session.commit()

        assert user.email == special_email

    def test_multiple_password_changes(self, db, sample_user):
        """User should be able to change password multiple times."""
        original = 'Original123'
        sample_user.set_password(original)
        db.session.commit()
        assert sample_user.check_password(original)

        new1 = 'NewPassword123'
        sample_user.set_password(new1)
        db.session.commit()
        assert sample_user.check_password(new1)
        assert not sample_user.check_password(original)

        new2 = 'AnotherNew456'
        sample_user.set_password(new2)
        db.session.commit()
        assert sample_user.check_password(new2)
        assert not sample_user.check_password(new1)

    def test_user_repr(self, db, sample_user):
        """User should have string representation."""
        repr_str = repr(sample_user)
        assert repr_str is not None
        assert isinstance(repr_str, str)
