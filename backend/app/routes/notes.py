from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import select

from app import db
from app.models import Note, User
from app.schemas import NoteCreateRequest, NoteResponse, NotesPageQuery


notes_bp = Blueprint('notes', __name__, url_prefix='/api/notes')


@notes_bp.route('', methods=['GET'])
@jwt_required()
def get_notes():
    """Return one page of the current user's notes, newest first.

    Cursor pagination: pass a page's next_cursor as ?before= to get the next
    one. Unlike an offset, a cursor neither skips nor repeats notes when new
    ones are added between pages, and every page costs the same: the user_id
    index is ordered by id within each user.
    """
    query = NotesPageQuery.model_validate(request.args.to_dict())
    user_id = int(get_jwt_identity())

    stmt = select(Note).where(Note.user_id == user_id)
    if query.before is not None:
        stmt = stmt.where(Note.id < query.before)
    # One extra row says whether another page follows
    stmt = stmt.order_by(Note.id.desc()).limit(query.limit + 1)
    notes = db.session.execute(stmt).scalars().all()

    page = notes[:query.limit]
    next_cursor = page[-1].id if len(notes) > query.limit else None
    return jsonify({
        'notes': [NoteResponse.model_validate(note).model_dump() for note in page],
        'next_cursor': next_cursor,
    }), 200


@notes_bp.route('', methods=['POST'])
@jwt_required()
def create_note():
    """Create a new note"""
    payload = NoteCreateRequest.model_validate(request.get_json())
    user_id = int(get_jwt_identity())
    user = db.get_or_404(User, user_id)

    new_note = Note(
        content=payload.content,
        user_id=user.id
    )
    db.session.add(new_note)
    db.session.commit()

    response = NoteResponse.model_validate(new_note).model_dump()
    return jsonify(response), 201
