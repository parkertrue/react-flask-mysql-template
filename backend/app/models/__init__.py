# Import all models here so Flask-Migrate can detect them
from .user import User
from .note import Note

__all__ = ['User', 'Note']
