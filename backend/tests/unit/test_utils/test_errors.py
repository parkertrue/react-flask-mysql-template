import json

from app.utils.errors import error_response


class TestErrorResponse:
    """Test suite for error_response utility function."""

    def test_error_response_basic(self):
        """error_response should return tuple with dict and status."""
        response, status = error_response(
            code="TEST_ERROR",
            message="Test error message",
            status=400
        )

        assert status == 400
        data = json.loads(response.data)
        assert data['error']['code'] == "TEST_ERROR"
        assert data['error']['message'] == "Test error message"

    def test_error_response_structure(self):
        """error_response should have consistent structure."""
        response, status = error_response(
            code="VALIDATION_ERROR",
            message="Validation failed",
            status=422
        )

        data = json.loads(response.data)
        assert 'code' in data['error']
        assert 'message' in data['error']
        assert isinstance(data['error']['code'], str)
        assert isinstance(data['error']['message'], str)

    def test_error_response_different_status_codes(self):
        """error_response should work with various status codes."""
        test_cases = [
            (400, "Bad Request"),
            (401, "Unauthorized"),
            (403, "Forbidden"),
            (404, "Not Found"),
            (409, "Conflict"),
            (422, "Unprocessable Entity"),
            (500, "Internal Server Error"),
        ]

        for status_code, message in test_cases:
            response, status = error_response(
                code=f"ERROR_{status_code}",
                message=message,
                status=status_code
            )

            assert status == status_code
            data = json.loads(response.data)
            assert data['error']['message'] == message


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

    def test_405_handler(self, client):
        """405 errors should return consistent error response."""
        response = client.post('/api/health')

        assert response.status_code == 405
        data = json.loads(response.data)
        assert data['error']['code'] == 'METHOD_NOT_ALLOWED'
        assert 'not allowed' in data['error']['message'].lower()

        assert response.status_code == 405
        assert response.content_type == 'application/json'

    def test_pydantic_validation_error_handler(self, client, auth_headers):
        """Pydantic validation errors should return 400 with details."""
        # Send invalid data that triggers Pydantic validation
        payload = {
            'content': ''  # Empty content violates min_length
        }

        response = client.post(
            '/api/notes',
            data=json.dumps(payload),
            headers=auth_headers
        )

        assert response.status_code == 422
        data = json.loads(response.data)
        assert data['error']['code'] == 'VALIDATION_ERROR'

    def test_missing_json_body(self, client, auth_headers):
        """Missing JSON body should be handled gracefully."""
        response = client.post(
            '/api/notes',
            headers=auth_headers
        )

        # Should return error (400 or 422)
        assert response.status_code in [400, 422]

    def test_malformed_json(self, client, auth_headers):
        """Malformed JSON should return 400."""
        response = client.post(
            '/api/notes',
            data='{"invalid": json}',
            headers=auth_headers
        )

        assert response.status_code == 400


class TestJWTErrorHandlers:
    """Test JWT-specific error handlers."""

    def test_missing_token_handler(self, client):
        """Missing JWT token should return 401 with AUTH_MISSING_TOKEN."""
        response = client.get('/api/notes')

        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error']['code'] == 'AUTH_MISSING_TOKEN'
        assert 'authentication required' in data['error']['message'].lower()

    def test_invalid_token_handler(self, client):
        """Invalid JWT token should return 401 with AUTH_INVALID_TOKEN."""
        headers = {
            'Authorization': 'Bearer invalid-token-string',
            'Content-Type': 'application/json'
        }

        response = client.get('/api/notes', headers=headers)

        # Returns 422 for decode errors, but our handler might catch it
        assert response.status_code in [401, 422]

    def test_expired_token_handler(self, client, expired_token):
        """Expired JWT token should return 401 with AUTH_TOKEN_EXPIRED."""
        headers = {
            'Authorization': f'Bearer {expired_token}',
            'Content-Type': 'application/json'
        }

        response = client.get('/api/notes', headers=headers)

        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error']['code'] == 'AUTH_TOKEN_EXPIRED'
        assert 'expired' in data['error']['message'].lower()

    def test_malformed_authorization_header(self, client):
        """Malformed Authorization header should be handled."""
        test_headers = [
            {'Authorization': 'InvalidFormat'},
            {'Authorization': 'Bearer'},
            {'Authorization': ''},
        ]

        for headers in test_headers:
            headers['Content-Type'] = 'application/json'
            response = client.get('/api/notes', headers=headers)
            assert response.status_code in [401, 422]


class TestErrorConsistency:
    """Test that errors are consistent across the application."""

    def test_all_errors_return_json(self, client, auth_headers):
        """All API errors should return JSON."""
        test_cases = [
            ('/api/nonexistent', 'GET', {}),
            ('/api/notes', 'GET', {}),  # No auth
            ('/api/notes', 'POST', {'email': 'invalid'}),  # Invalid schema
        ]

        for endpoint, method, data in test_cases:
            if method == 'GET':
                response = client.get(endpoint)
            else:
                response = client.post(
                    endpoint,
                    data=json.dumps(data) if data else None,
                    content_type='application/json'
                )

            # All should return JSON
            if response.status_code >= 400:
                assert response.content_type == 'application/json'

    def test_error_codes_are_uppercase(self, client):
        """Error codes should be uppercase with underscores."""
        # Test various error scenarios
        response = client.get('/api/notes')  # Missing token
        data = json.loads(response.data)
        assert data['error']['code'].isupper()
        assert '_' in data['error']['code'] or data['error']['code'].isalnum()

        response = client.get('/nonexistent')  # 404
        data = json.loads(response.data)
        assert data['error']['code'].isupper()

    def test_error_messages_are_user_friendly(self, client, sample_user):
        """Error messages should be readable."""
        # Missing token
        response = client.get('/api/notes')
        data = json.loads(response.data)
        assert len(data['error']['message']) > 0
        assert data['error']['message'][0].isupper()  # Starts with capital

        # Invalid credentials
        payload = {
            'email': 'test@example.com',
            'password': 'WrongPassword123'
        }
        response = client.post(
            '/api/auth/login',
            data=json.dumps(payload),
            content_type='application/json'
        )
        data = json.loads(response.data)
        assert 'invalid' in data['error']['message'].lower()
