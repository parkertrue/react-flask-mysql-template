from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import db
if TYPE_CHECKING:
    from app.models import User

# The schemas validate against this, so an over-long note is a 422, not a
# database error. frontend/src/utils/validation.js mirrors it.
NOTE_MAX_LENGTH = 256


class Note(db.Model):
    __tablename__ = 'notes'
    __table_args__ = (
        # GET /api/notes pages through one user's notes by id (a cursor), so
        # this index is what keeps every page equally cheap. It also serves
        # the foreign key. Any list paginated the same way needs its own.
        db.Index('ix_notes_user_id_id', 'user_id', 'id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        # Deleting a user deletes their notes in the same statement, in the
        # database, rather than the ORM loading and deleting each one
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False
    )
    content: Mapped[str] = mapped_column(
        db.String(NOTE_MAX_LENGTH),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )
    user: Mapped['User'] = relationship(
        'User',
        backref=db.backref(
            'notes', cascade='all, delete-orphan', passive_deletes=True)
    )

    def __init__(self, *, user_id: int, content: str) -> None:
        self.user_id = user_id
        self.content = content
