from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import select

from app import db
from app.models import ID_MAX, Note
from app.schemas import NoteCreateRequest, NoteResponse, NotesListQuery, NoteUpdateRequest


notes_bp = Blueprint('notes', __name__, url_prefix='/api/notes')


def get_own_note_or_404(note_id):
    """The current user's note with this id. Another user's note is a 404,
    exactly like a missing one, so probing ids reveals nothing."""
    # Checked here rather than with the converter's max=: on two rules sharing
    # a path, werkzeug turns a failed max= into a 405 instead of a 404
    if note_id > ID_MAX:
        abort(404)
    return db.one_or_404(
        select(Note).where(Note.id == note_id, Note.user_id == current_user.id))


@notes_bp.route('', methods=['GET'])
@jwt_required()
def get_notes():
    """Return one page of the current user's notes, newest first.

    Cursor pagination: pass a page's next_cursor as ?before= to get the next
    one. Unlike an offset, a cursor neither skips nor repeats notes when new
    ones are added between pages, and every page costs the same: the
    (user_id, id) index on Note finds each page directly.
    """
    query = NotesListQuery.model_validate(request.args.to_dict())

    stmt = select(Note).where(Note.user_id == current_user.id)
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
    payload = NoteCreateRequest.model_validate(request.get_json())

    new_note = Note(
        content=payload.content,
        user_id=current_user.id
    )
    db.session.add(new_note)
    db.session.commit()

    response = NoteResponse.model_validate(new_note).model_dump()
    return jsonify(response), 201


@notes_bp.route('/<int:note_id>', methods=['PUT'])
@jwt_required()
def update_note(note_id):
    payload = NoteUpdateRequest.model_validate(request.get_json())
    note = get_own_note_or_404(note_id)

    note.content = payload.content
    db.session.commit()

    return jsonify(NoteResponse.model_validate(note).model_dump()), 200


@notes_bp.route('/<int:note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    note = get_own_note_or_404(note_id)

    db.session.delete(note)
    db.session.commit()

    return '', 204
