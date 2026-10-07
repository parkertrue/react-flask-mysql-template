from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
import re

# EmailStr alone allows up to 254 characters, more than the users.email
# column holds, so every email field is capped at the column's size.
from app.models.user import EMAIL_MAX_LENGTH

# Only the hash is stored, so these are policy rather than a column size.
# frontend/src/utils/validation.js mirrors them.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=EMAIL_MAX_LENGTH)
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    model_config = ConfigDict(extra='forbid')

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain number')
        return v


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=EMAIL_MAX_LENGTH)
    # No strength rules: tightening RegisterRequest's must not lock out users
    # whose existing passwords predate the change.
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

    model_config = ConfigDict(extra='forbid')
