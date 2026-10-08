"""ON DELETE CASCADE in MySQL itself, not SQLite's emulation of it."""
from sqlalchemy import delete, func, select

from app.models import Note, User


def test_deleting_a_user_deletes_only_their_notes(integration_db, integration_user):
    other = User(email='other@test.com')
    other.set_password('TestPassword123')
    integration_db.session.add(other)
    integration_db.session.flush()
    integration_db.session.add_all([
        Note(user_id=integration_user.id, content='mine'),
        Note(user_id=other.id, content='theirs'),
    ])
    integration_db.session.commit()

    # A bulk DELETE: the ORM never loads the notes, so only the database
    # can remove them
    integration_db.session.execute(delete(User).where(User.id == integration_user.id))
    integration_db.session.commit()

    contents = integration_db.session.execute(select(Note.content)).scalars().all()
    assert contents == ['theirs']
    assert integration_db.session.execute(select(func.count(User.id))).scalar() == 1
