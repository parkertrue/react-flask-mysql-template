from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
import re

# The users.email column's size. EmailStr alone allows up to 254 characters,
# which MySQL would reject with a 500 instead of a validation error.
EMAIL_MAX_LENGTH = 128


class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=EMAIL_MAX_LENGTH)
    password: str = Field(min_length=8, max_length=128)

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
    password: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(extra='forbid')
