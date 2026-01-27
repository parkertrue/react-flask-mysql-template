import pytest
import json


class TestHealthEndpoint:
    """Test suite for the /api/health endpoint."""

    def test_health_check_returns_200(self, client):
        """Health check should return 200 OK status."""
        response = client.get('/api/health')

        assert response.status_code == 200

    def test_health_check_returns_json(self, client):
        """Health check should return JSON content type."""
        response = client.get('/api/health')

        assert response.content_type == 'application/json'

    def test_health_check_response_structure(self, client):
        """Health check should return correct response structure."""
        response = client.get('/api/health')
        data = json.loads(response.data)

        assert 'status' in data
        assert data['status'] == 'ok'

    def test_health_check_no_authentication_required(self, client):
        """Health check should work without authentication."""
        # No auth headers provided
        response = client.get('/api/health')

        assert response.status_code == 200

    def test_health_check_accepts_only_get(self, client):
        """Health check should only accept GET requests."""
        # POST should not be allowed
        response = client.post('/api/health')
        assert response.status_code == 405

        # PUT should not be allowed
        response = client.put('/api/health')
        assert response.status_code == 405

        # DELETE should not be allowed
        response = client.delete('/api/health')
        assert response.status_code == 405

    def test_health_check_with_query_params(self, client):
        """Health check should ignore query parameters."""
        response = client.get('/api/health?foo=bar&baz=qux')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'ok'

    def test_health_check_with_headers(self, client, auth_headers):
        """Health check should work with any headers present."""
        response = client.get('/api/health', headers=auth_headers)

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['status'] == 'ok'

    def test_health_check_idempotent(self, client):
        """Multiple health checks should return same result."""
        response1 = client.get('/api/health')
        response2 = client.get('/api/health')
        response3 = client.get('/api/health')

        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response3.status_code == 200

        data1 = json.loads(response1.data)
        data2 = json.loads(response2.data)
        data3 = json.loads(response3.data)

        assert data1 == data2 == data3
