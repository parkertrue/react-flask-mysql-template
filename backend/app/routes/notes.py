from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import Note, User
from app.schemas import CreateNoteRequest, NoteResponse


notes_bp = Blueprint('notes', __name__, url_prefix='/api/notes')


@notes_bp.route('', methods=['GET'])
@jwt_required()
def get_notes():
    """Return all notes belonging to the current user"""
    user_id = int(get_jwt_identity())
    notes = Note.query.filter_by(user_id=user_id).all()

    response = [
        NoteResponse.model_validate(note).model_dump()
        for note in notes
    ]
    return jsonify(response), 200


@notes_bp.route('', methods=['POST'])
@jwt_required()
def create_note():
    """Create a new note"""
    payload = CreateNoteRequest(**request.get_json())
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)

    new_note = Note(
        content=payload.content,    # pyright: ignore[reportCallIssue]
        user_id=user.id             # pyright: ignore[reportCallIssue]
    )
    db.session.add(new_note)
    db.session.commit()

    response = NoteResponse.model_validate(new_note).model_dump()
    return jsonify(response), 201
