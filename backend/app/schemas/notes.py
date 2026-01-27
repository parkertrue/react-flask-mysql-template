from pydantic import BaseModel, Field, ConfigDict, field_serializer
from datetime import datetime


class CreateNoteRequest(BaseModel):
    content: str = Field(min_length=1, max_length=256)

    model_config = ConfigDict(extra="forbid")


class NoteResponse(BaseModel):
    id: int
    user_id: int
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('created_at')
    def serialize_dt(self, dt: datetime, _info):
        return dt.isoformat()
