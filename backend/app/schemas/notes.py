from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class CreateNoteRequest(BaseModel):
    content: str = Field(min_length=1, max_length=255)

    model_config = ConfigDict(extra="forbid")


class NoteResponse(BaseModel):
    id: int
    user_id: int
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
