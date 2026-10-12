import pytest


class TestHealthEndpoint:
    """GET /api/health: liveness only, open to anyone"""

    @pytest.mark.parametrize('path, with_token', [
        ('/api/health', False),
        ('/api/health?foo=bar&baz=qux', False),
        ('/api/health', True),
    ], ids=['plain', 'query params ignored', 'token ignored'])
    def test_get_answers_ok(self, client, auth_headers, path, with_token):
        response = client.get(path, headers=auth_headers if with_token else None)

        assert response.status_code == 200
        assert response.content_type == 'application/json'
        assert response.get_json() == {'status': 'ok'}

    @pytest.mark.parametrize('method', ['post', 'put', 'delete'])
    def test_other_methods_are_not_allowed(self, client, method):
        response = getattr(client, method)('/api/health')

        assert response.status_code == 405
