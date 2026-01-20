from app import db

# Import all models here so Flask-Migrate can detect them
from .auth import User
from .notes import Note
