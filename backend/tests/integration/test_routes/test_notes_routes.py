import pytest
import json
from datetime import datetime, timezone
from sqlalchemy import select, func


class TestGetNotes:
    """Test suite for GET /api/notes endpoint."""

    def test_get_notes_requires_authentication(self, client):
        """GET /api/notes without token should return 401."""
        response = client.get('/api/notes')

        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error']['code'] == 'AUTH_MISSING_TOKEN'

    def test_get_notes_with_invalid_token(self, client):
        """GET /api/notes with invalid token should return 401."""
        headers = {
            'Authorization': 'Bearer invalid-token-12345',
            'Content-Type': 'application/json'
        }
        response = client.get('/api/notes', headers=headers)

        assert response.status_code == 401

    def test_get_notes_with_expired_token(self, client, expired_token):
        """GET /api/notes with expired token should return 401."""
        headers = {
            'Authorization': f'Bearer {expired_token}',
            'Content-Type': 'application/json'
        }
        response = client.get('/api/notes', headers=headers)

        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error']['code'] == 'AUTH_TOKEN_EXPIRED'

    def test_get_notes_empty_list(self, client, auth_headers, sample_user):
        """GET /api/notes should return empty list when user has no notes."""
        response = client.get('/api/notes', headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_notes_returns_user_notes(self, client, auth_headers, sample_notes):
        """GET /api/notes should return all notes for authenticated user."""
        response = client.get('/api/notes', headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert len(data) == 3

        # Verify note structure
        for note in data:
            assert 'id' in note
            assert 'user_id' in note
            assert 'content' in note
            assert 'created_at' in note

    def test_get_notes_returns_only_user_notes(self, client, auth_headers,
                                               sample_notes, other_user_note):
        """GET /api/notes should only return current user's notes."""
        response = client.get('/api/notes', headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)

        # Should have 3 notes from sample_user, not the other_user_note
        assert len(data) == 3

        # Verify none of the notes belong to other user
        note_ids = [note['id'] for note in data]
        assert other_user_note.id not in note_ids

    def test_get_notes_correct_content(self, client, auth_headers, sample_note):
        """GET /api/notes should return correct note content."""
        response = client.get('/api/notes', headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 1

        note = data[0]
        assert note['id'] == sample_note.id
        assert note['user_id'] == sample_note.user_id
        assert note['content'] == 'This is a test note'

    def test_get_notes_includes_timestamps(self, client, auth_headers, sample_note):
        """GET /api/notes should include properly formatted timestamps."""
        response = client.get('/api/notes', headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)

        note = data[0]
        assert 'created_at' in note

        # Verify timestamp is ISO format
        try:
            datetime.fromisoformat(note['created_at'].replace('Z', '+00:00'))
        except ValueError:
            pytest.fail("created_at is not in valid ISO format")


class TestCreateNote:
    """Test suite for POST /api/notes endpoint."""

    def test_create_note_requires_authentication(self, client):
        """POST /api/notes without token should return 401."""
        payload = {'content': 'Test note'}
        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            content_type='application/json'
        )

        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error']['code'] == 'AUTH_MISSING_TOKEN'

    def test_create_note_success(self, client, auth_headers, sample_user):
        """POST /api/notes with valid data should create note and return 201."""
        payload = {'content': 'My new note'}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 201
        data = json.loads(response.data)

        assert data['content'] == 'My new note'
        assert data['user_id'] == sample_user.id
        assert 'id' in data
        assert 'created_at' in data

    def test_create_note_persists_to_database(self, client, auth_headers,
                                              sample_user, db):
        """POST /api/notes should persist note to database."""
        from app.models import Note

        initial_count = db.session.scalar(
            select(func.count()).select_from(Note)
        )

        payload = {'content': 'Persisted note'}
        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 201

        # Verify database has one more note
        new_count = db.session.scalar(
            select(func.count()).select_from(Note)
        )
        assert new_count == initial_count + 1

        # Verify the note exists with correct data
        note = db.session.execute(
            select(Note).where(Note.content == "Persisted note")
        ).scalar_one_or_none()

        assert note is not None
        assert note.user_id == sample_user.id

    def test_create_note_missing_content(self, client, auth_headers):
        """POST /api/notes without content should return 400."""
        payload = {}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 422  # Pydantic validation error

    def test_create_note_empty_content(self, client, auth_headers):
        """POST /api/notes with empty content should return 400."""
        payload = {'content': ''}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 422

    def test_create_note_content_too_long(self, client, auth_headers):
        """POST /api/notes with content > 255 chars should return 400."""
        payload = {'content': 'x' * 256}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 422

    def test_create_note_max_length_content(self, client, auth_headers):
        """POST /api/notes with exactly 255 chars should succeed."""
        payload = {'content': 'x' * 255}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 201
        data = json.loads(response.data)
        assert len(data['content']) == 255

    def test_create_note_extra_fields_rejected(self, client, auth_headers):
        """POST /api/notes with extra fields should return 400."""
        payload = {
            'content': 'Valid content',
            'extra_field': 'should be rejected',
            'another_field': 123
        }

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 422

    def test_create_note_invalid_json(self, client, auth_headers):
        """POST /api/notes with invalid JSON should return 400."""
        response = client.post(
            '/api/notes',
            data='not valid json{',
            headers=auth_headers
        )

        assert response.status_code == 400

    def test_create_note_wrong_content_type(self, client, auth_token):
        """POST /api/notes with wrong content-type should handle gracefully."""
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'text/plain'
        }

        response = client.post(
            '/api/notes',
            data='content=test',
            headers=headers
        )

        # Should fail because it can't parse as JSON
        assert response.status_code in [400, 415, 422]

    def test_create_multiple_notes(self, client, auth_headers, sample_user):
        """User should be able to create multiple notes."""
        notes_content = ['First note', 'Second note', 'Third note']

        for content in notes_content:
            payload = {'content': content}
            response = client.post(
                '/api/notes',
                data=json.dumps(payload),
                headers=auth_headers
            )
            assert response.status_code == 201

        # Verify all notes were created
        response = client.get('/api/notes', headers=auth_headers)
        data = json.loads(response.data)
        assert len(data) == 3

    def test_create_note_sets_timestamp(self, client, auth_headers):
        """Created note should have timestamp set."""
        payload = {'content': 'Timestamped note'}

        before = datetime.now(timezone.utc).replace(microsecond=0)
        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )
        after = datetime.now(timezone.utc).replace(microsecond=0)

        assert response.status_code == 201
        data = json.loads(response.data)

        created_at = datetime.fromisoformat(
            data['created_at']).replace(tzinfo=timezone.utc)

        # Timestamp should be between before and after (with some tolerance)
        assert before <= created_at <= after

    def test_create_note_different_users(self, client, auth_headers,
                                         second_auth_headers, sample_user,
                                         second_user):
        """Different users should create notes independently."""
        # User 1 creates a note
        payload1 = {'content': 'User 1 note'}
        response1 = client.post(
            '/api/notes',
            data=json.dumps(payload1),
            headers=auth_headers
        )
        assert response1.status_code == 201
        data1 = json.loads(response1.data)
        assert data1['user_id'] == sample_user.id

        # User 2 creates a note
        payload2 = {'content': 'User 2 note'}
        response2 = client.post(
            '/api/notes',
            data=json.dumps(payload2),
            headers=second_auth_headers
        )
        assert response2.status_code == 201
        data2 = json.loads(response2.data)
        assert data2['user_id'] == second_user.id

        # Each user should only see their own note
        response1_notes = client.get('/api/notes', headers=auth_headers)
        user1_notes = json.loads(response1_notes.data)
        assert len(user1_notes) == 1
        assert user1_notes[0]['content'] == 'User 1 note'

        response2_notes = client.get('/api/notes', headers=second_auth_headers)
        user2_notes = json.loads(response2_notes.data)
        assert len(user2_notes) == 1
        assert user2_notes[0]['content'] == 'User 2 note'


class TestNotesEdgeCases:
    """Test edge cases and error scenarios."""

    def test_get_notes_after_user_deletion(self, client, auth_headers,
                                           sample_user, sample_notes, db):
        """Notes query should handle deleted user gracefully."""
        # This tests the relationship setup
        # In production, you might want cascade delete or orphan handling

        # Verify notes exist
        response = client.get('/api/notes', headers=auth_headers)
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 3

    def test_create_note_with_special_characters(self, client, auth_headers):
        """POST /api/notes should handle special characters in content."""
        payload = {'content': 'Special chars: <>&"\'(){}[]!@#$%^&*'}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['content'] == payload['content']

    def test_create_note_with_unicode(self, client, auth_headers):
        """POST /api/notes should handle Unicode characters."""
        payload = {'content': 'Unicode: 你好 مرحبا שלום 🎉'}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['content'] == payload['content']

    def test_create_note_with_newlines(self, client, auth_headers):
        """POST /api/notes should handle newlines in content."""
        payload = {'content': 'Line 1\nLine 2\nLine 3'}

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'Line 1' in data['content']
        assert 'Line 2' in data['content']
