from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_serializer,
    field_validator
)
from datetime import datetime
from app.utils.sanitizer import InputSanitizer


class NoteCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=256)

    model_config = ConfigDict(extra="forbid")

    @field_validator('content')
    @classmethod
    def sanitize_content(cls, v):
        sanitized = InputSanitizer.sanitize_text(v)
        if not sanitized:
            raise ValueError('Note content cannot be empty after sanitization')
        return sanitized


class NoteResponse(BaseModel):
    id: int
    user_id: int
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at')
    def serialize_dt(self, dt: datetime, _info):
        return dt.isoformat()
