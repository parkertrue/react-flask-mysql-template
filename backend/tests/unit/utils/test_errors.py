import json

import pytest

from app.utils.errors import (
    SERVICE_UNAVAILABLE_MESSAGE, error_response, quota_exceeded, service_unavailable)


# jsonify needs an app context, which the app fixture holds open
@pytest.mark.usefixtures('app')
class TestErrorResponse:
    """Test suite for error_response utility function."""

    def test_error_response_basic(self):
        """error_response should return tuple with dict and status."""
        response, status = error_response(
            code='TEST_ERROR',
            message='Test error message',
            status=400
        )

        assert status == 400
        data = json.loads(response.data)
        assert data['error']['code'] == 'TEST_ERROR'
        assert data['error']['message'] == 'Test error message'

    def test_error_response_structure(self):
        """error_response should have consistent structure."""
        response, status = error_response(
            code='VALIDATION_ERROR',
            message='Validation failed',
            status=422
        )

        data = json.loads(response.data)
        assert 'code' in data['error']
        assert 'message' in data['error']
        assert isinstance(data['error']['code'], str)
        assert isinstance(data['error']['message'], str)

    @pytest.mark.parametrize(('status_code', 'message'), [
        (400, 'Bad Request'),
        (401, 'Unauthorized'),
        (403, 'Forbidden'),
        (404, 'Not Found'),
        (409, 'Conflict'),
        (422, 'Unprocessable Entity'),
        (500, 'Internal Server Error'),
    ])
    def test_error_response_different_status_codes(self, status_code, message):
        """error_response should work with various status codes."""
        response, status = error_response(
            code=f'ERROR_{status_code}',
            message=message,
            status=status_code
        )

        assert status == status_code
        data = json.loads(response.data)
        assert data['error']['message'] == message

    def test_error_response_takes_keywords_only(self):
        with pytest.raises(TypeError):
            error_response('TEST_ERROR', 'Test error message')

    # Tested here too: a new app deletes the example feature that uses it
    def test_quota_exceeded_is_a_409_with_its_message(self):
        response, status = quota_exceeded('You can keep at most 3 things.')

        assert status == 409
        assert response.get_json()['error'] == {
            'code': 'QUOTA_EXCEEDED', 'message': 'You can keep at most 3 things.'}

    @pytest.mark.parametrize(('args', 'message'), [
        ((), SERVICE_UNAVAILABLE_MESSAGE),
        (('The server is busy',), 'The server is busy'),
    ])
    def test_service_unavailable_is_a_503(self, args, message):
        response, status = service_unavailable(*args)

        assert status == 503
        assert response.get_json()['error'] == {'code': 'SERVICE_UNAVAILABLE', 'message': message}


class TestGlobalErrorHandlers:
    """Test global error handlers in Flask app."""

    def test_404_handler(self, client):
        """404 errors should return consistent error response."""
        response = client.get('/nonexistent-route')

        assert response.status_code == 404
        data = json.loads(response.data)
        assert data['error']['code'] == 'NOT_FOUND'
        assert 'not found' in data['error']['message'].lower()

    def test_404_on_api_route(self, client):
        """404 on API routes should return JSON error."""
        response = client.get('/api/nonexistent')

        assert response.status_code == 404
        assert response.get_json()['error']['code'] == 'NOT_FOUND'

    def test_405_handler(self, client):
        """405 errors should return consistent error response."""
        response = client.post('/api/health')

        assert response.status_code == 405
        data = json.loads(response.data)
        assert data['error']['code'] == 'METHOD_NOT_ALLOWED'
        assert 'not allowed' in data['error']['message'].lower()

        assert response.status_code == 405
        assert response.content_type == 'application/json'

    # The register route stands in for any route with a JSON body: it is
    # public and validates its body with a schema
    def test_pydantic_validation_error_handler(self, client):
        """Pydantic validation errors return 422 VALIDATION_ERROR."""
        response = client.post(
            '/api/auth/register',
            json={'email': 'not-an-email', 'password': 'TestPassword123'})

        assert response.status_code == 422
        assert response.get_json()['error']['code'] == 'VALIDATION_ERROR'

    def test_missing_json_body(self, client):
        """A JSON request with no body is malformed"""
        response = client.post('/api/auth/register', content_type='application/json')

        assert response.status_code == 400
        assert response.get_json()['error']['code'] == 'BAD_REQUEST'

    def test_malformed_json(self, client):
        """Malformed JSON should return 400."""
        response = client.post(
            '/api/auth/register',
            data='{"invalid": json}',
            content_type='application/json'
        )

        assert response.status_code == 400
        assert response.get_json()['error']['code'] == 'BAD_REQUEST'


# GET /api/account stands in for any route that needs a token: every app keeps it
class TestJWTErrorHandlers:
    """Test JWT-specific error handlers."""

    def test_missing_token_handler(self, client):
        """Missing JWT token should return 401 with AUTH_MISSING_TOKEN."""
        response = client.get('/api/account')

        assert response.status_code == 401
        data = response.get_json()
        assert data['error']['code'] == 'AUTH_MISSING_TOKEN'
        assert 'authentication required' in data['error']['message'].lower()

    def test_invalid_token_handler(self, client):
        """Invalid JWT token should return 401 with AUTH_INVALID_TOKEN."""
        response = client.get(
            '/api/account', headers={'Authorization': 'Bearer invalid-token-string'})

        assert response.status_code == 401
        assert response.get_json()['error']['code'] == 'AUTH_INVALID_TOKEN'

    def test_expired_token_handler(self, client, expired_token):
        """Expired JWT token should return 401 with AUTH_TOKEN_EXPIRED."""
        response = client.get(
            '/api/account', headers={'Authorization': f'Bearer {expired_token}'})

        assert response.status_code == 401
        data = response.get_json()
        assert data['error']['code'] == 'AUTH_TOKEN_EXPIRED'
        assert 'expired' in data['error']['message'].lower()

    @pytest.mark.parametrize('authorization, code', [
        # Not a Bearer header at all, so no token was sent
        ('InvalidFormat', 'AUTH_MISSING_TOKEN'),
        ('', 'AUTH_MISSING_TOKEN'),
        # A Bearer header without a token is a bad token
        ('Bearer', 'AUTH_INVALID_TOKEN'),
    ])
    def test_malformed_authorization_header(self, client, authorization, code):
        response = client.get('/api/account', headers={'Authorization': authorization})

        assert response.status_code == 401
        assert response.get_json()['error']['code'] == code


class TestErrorConsistency:
    """Every error, whichever handler made it, has the same JSON shape."""

    @pytest.mark.parametrize('method, url, kwargs, status, code', [
        ('GET', '/api/nonexistent', {}, 404, 'NOT_FOUND'),
        ('GET', '/api/account', {}, 401, 'AUTH_MISSING_TOKEN'),
        ('POST', '/api/auth/register', {'json': {'email': 'invalid'}}, 422, 'VALIDATION_ERROR'),
        ('POST', '/api/auth/login',
         {'json': {'email': 'nobody@example.com', 'password': 'WrongPassword123'}},
         401, 'INVALID_CREDENTIALS'),
    ])
    def test_errors_share_one_shape(self, client, method, url, kwargs, status, code):
        response = client.open(url, method=method, **kwargs)

        assert response.status_code == status
        assert response.content_type == 'application/json'
        error = response.get_json()['error']
        assert error['code'] == code
        # Codes are UPPER_SNAKE_CASE; messages are sentences a user can read
        assert error['code'].replace('_', '').isalpha() and error['code'].isupper()
        assert error['message'][0].isupper()
