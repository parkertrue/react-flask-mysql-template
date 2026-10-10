# Import all models here so Flask-Migrate can detect them
from .user import User
from .note import Note

# The largest id an INT primary key holds. Every id in a URL or a cursor is
# one, so anything past this is malformed; unchecked, a long enough number
# overflows the database driver and answers 500.
ID_MAX = 2**31 - 1

__all__ = ['User', 'Note', 'ID_MAX']
