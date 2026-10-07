from pydantic import BaseModel, Field, ConfigDict, field_serializer
from datetime import datetime

from app.models.note import NOTE_MAX_LENGTH


class NoteCreateRequest(BaseModel):
    # Stored as the user typed it, markup included. Output safety belongs to
    # the render layer: React escapes text, so "<b>" shows as "<b>". Never
    # inject it as HTML (dangerouslySetInnerHTML, innerHTML) without
    # sanitizing at that point.
    content: str = Field(min_length=1, max_length=NOTE_MAX_LENGTH)

    # Trimmed before the length checks, so whitespace-only notes are rejected
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class NotesListQuery(BaseModel):
    """GET /api/notes query string: ?before=<next_cursor>&limit=<n>"""
    before: int | None = Field(default=None, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


class NoteResponse(BaseModel):
    id: int
    user_id: int
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at')
    def serialize_dt(self, dt: datetime, _info):
        return dt.isoformat()
