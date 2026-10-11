from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column

from app import db
from app.utils.passwords import hash_password, verify_password

# The schemas validate against this, so an over-long email is a 422, not a
# database error. frontend/src/utils/validation.js mirrors it.
EMAIL_MAX_LENGTH = 128


class User(db.Model):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(
        db.String(EMAIL_MAX_LENGTH),
        unique=True,
        nullable=False,
        index=True
    )
    password_hash: Mapped[str] = mapped_column(
        db.String(255),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime,
        server_default=db.func.now(),
        nullable=False
    )

    def __init__(self, *, email: str) -> None:
        self.email = email

    def set_password(self, password: str) -> None:
        self.password_hash = hash_password(password)

    def check_password(self, password: str) -> bool:
        return verify_password(self.password_hash, password)
