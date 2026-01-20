from pydantic import BaseModel, EmailStr, Field, ConfigDict


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    model_config = ConfigDict(extra="forbid")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    model_config = ConfigDict(extra="forbid")
