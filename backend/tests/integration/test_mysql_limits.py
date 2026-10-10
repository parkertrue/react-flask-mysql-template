"""Column limits that SQLite ignores, so unit tests cannot catch them."""
import pytest
from flask_jwt_extended import create_access_token
from sqlalchemy.exc import DataError

from app.models import Note
from app.models.note import NOTE_MAX_LENGTH


def test_overlong_email_is_a_validation_error(integration_client):
    """MySQL rejects an over-long email with a 500 unless the schema stops it"""
    email = 'a' * 130 + '@example.com'

    response = integration_client.post(
        '/api/auth/register',
        json={'email': email, 'password': 'TestPassword123'})

    assert response.status_code == 422


def test_database_rejects_an_overlong_note(integration_db, integration_user):
    """The column's size is a real limit: MySQL's strict mode refuses, not truncates"""
    integration_db.session.add(
        Note(user_id=integration_user.id, content='x' * (NOTE_MAX_LENGTH + 1)))

    with pytest.raises(DataError):
        integration_db.session.commit()
    integration_db.session.rollback()


def test_longest_note_survives_in_multibyte_characters(integration_client, integration_user):
    """The limit counts characters, not bytes: three-byte 日 fits like a letter"""
    content = '日' * NOTE_MAX_LENGTH
    token = create_access_token(identity=str(integration_user.id))
    headers = {'Authorization': f'Bearer {token}'}

    created = integration_client.post('/api/notes', json={'content': content}, headers=headers)
    listed = integration_client.get('/api/notes', headers=headers)

    assert created.status_code == 201
    assert listed.get_json()['notes'][0]['content'] == content


@pytest.mark.parametrize('method', ['PUT', 'DELETE'])
@pytest.mark.parametrize('note_id', [2**31, int('9' * 19)])
def test_note_id_past_the_int_range_is_not_found(
        integration_client, integration_user, method, note_id):
    """Past ID_MAX, MySQL's driver would fail the query; the route answers 404"""
    token = create_access_token(identity=str(integration_user.id))

    response = integration_client.open(
        f'/api/notes/{note_id}', method=method, json={'content': 'x'},
        headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 404
    assert response.get_json()['error']['code'] == 'NOT_FOUND'
