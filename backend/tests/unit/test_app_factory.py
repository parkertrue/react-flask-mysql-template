import pytest
from flask import abort, request

import app as app_module
from app import create_app
from app.config import TestingConfig


def build_app(monkeypatch, **overrides):
    """A fresh app from TestingConfig with some settings overridden."""
    config = TestingConfig()
    for key, value in overrides.items():
        setattr(config, key, value)
    monkeypatch.setattr(app_module, 'get_config', lambda: config)
    return create_app()


class TestProxyFix:
    """Rate limits key on request.remote_addr, so it must be the real client"""

    @pytest.fixture
    def remote_addr(self):
        def fetch(app, forwarded_for):
            @app.route('/_remote_addr')
            def show_remote_addr():
                return request.remote_addr

            response = app.test_client().get(
                '/_remote_addr',
                headers={'X-Forwarded-For': forwarded_for},
                environ_base={'REMOTE_ADDR': '172.18.0.5'},  # the proxy
            )
            return response.get_data(as_text=True)
        return fetch

    def test_behind_proxy_uses_forwarded_client(self, monkeypatch, remote_addr):
        app = build_app(monkeypatch, TRUSTED_PROXY_COUNT=1)

        assert remote_addr(app, '203.0.113.7') == '203.0.113.7'

    def test_ignores_client_spoofed_hops(self, monkeypatch, remote_addr):
        """nginx appends the real address; anything before it is client-supplied"""
        app = build_app(monkeypatch, TRUSTED_PROXY_COUNT=1)

        assert remote_addr(app, '1.2.3.4, 203.0.113.7') == '203.0.113.7'

    def test_without_proxy_ignores_header(self, monkeypatch, remote_addr):
        app = build_app(monkeypatch, TRUSTED_PROXY_COUNT=0)

        assert remote_addr(app, '203.0.113.7') == '172.18.0.5'


class TestJsonErrors:
    """Every error leaves the API as JSON the frontend can display"""

    @pytest.mark.parametrize('status, code', [
        (400, 'BAD_REQUEST'),
        (415, 'UNSUPPORTED_MEDIA_TYPE'),
        (429, 'RATE_LIMITED'),
    ])
    def test_http_errors_are_json(self, monkeypatch, status, code):
        app = build_app(monkeypatch)

        @app.route('/_abort')
        def raise_status():
            abort(status)

        response = app.test_client().get('/_abort')

        assert response.status_code == status
        assert response.get_json()['error']['code'] == code

    @pytest.mark.parametrize('body', ['null', '[]', '"text"'])
    def test_non_object_json_body_is_validation_error(self, client, body):
        response = client.post(
            '/api/auth/login', data=body, content_type='application/json')

        assert response.status_code == 422
        assert response.get_json()['error']['code'] == 'VALIDATION_ERROR'

    def test_non_json_content_type(self, client):
        response = client.post('/api/auth/login', data='email=a@b.com')

        assert response.status_code == 415
        assert response.get_json()['error']['code'] == 'UNSUPPORTED_MEDIA_TYPE'
