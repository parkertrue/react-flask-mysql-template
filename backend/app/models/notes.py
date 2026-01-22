from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app import db
if TYPE_CHECKING:
    from app.models import User


class Note(db.Model):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        db.ForeignKey('users.id'),
        nullable=False
    )
    content: Mapped[str] = mapped_column(
        db.String(255),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )
    user: Mapped["User"] = relationship(
        "User",
        backref=db.backref("notes", cascade="all, delete-orphan")
    )

    def __init__(self, *, user_id: int, content: str) -> None:
        self.user_id = user_id
        self.content = content
