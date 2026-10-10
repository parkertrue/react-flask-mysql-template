from unittest.mock import patch

import pytest
import redis
from flask import abort, request
from flask_jwt_extended import create_refresh_token, decode_token

import app as app_module
from app import create_app
from app.config import UnitTestConfig
from app.utils import redis_service
from app.utils.redis_service import get_redis_service


def build_app(monkeypatch, **overrides):
    """A fresh app from UnitTestConfig with some settings overridden."""
    config = UnitTestConfig()
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


class TestRedisReconnect:
    """A worker that boots while Redis is down must pick it up once it's back"""

    @pytest.fixture
    def redis_down_at_boot(self, monkeypatch):
        clock = [1000.0]
        monkeypatch.setattr(redis_service.time, 'monotonic', lambda: clock[0])
        with patch('app.utils.redis_service.redis.Redis') as redis_class:
            redis_class.return_value.ping.side_effect = redis.ConnectionError
            app = build_app(
                monkeypatch, USES_SERVICES=True, REDIS_HOST='localhost',
                REDIS_DB=0, REDIS_USERNAME='app', REDIS_PASSWORD='redispass')
            yield app, redis_class, clock

    def test_boot_failure_leaves_no_service(self, redis_down_at_boot):
        app, _, _ = redis_down_at_boot

        assert app.extensions['redis_service'] is None

    def test_retries_after_interval(self, redis_down_at_boot):
        app, redis_class, clock = redis_down_at_boot
        redis_class.return_value.ping.side_effect = None
        clock[0] += redis_service.RECONNECT_INTERVAL_SECONDS

        with app.app_context():
            service = get_redis_service()

        assert service is not None
        assert app.extensions['redis_service'] is service

    def test_backs_off_between_attempts(self, redis_down_at_boot):
        app, redis_class, clock = redis_down_at_boot
        redis_class.return_value.ping.side_effect = None
        clock[0] += redis_service.RECONNECT_INTERVAL_SECONDS - 1

        with app.app_context():
            assert get_redis_service() is None
        assert redis_class.call_count == 1  # only the boot attempt

    def test_refresh_fails_closed_while_down(self, redis_down_at_boot):
        app, _, _ = redis_down_at_boot
        with app.app_context():
            token = create_refresh_token(identity='1')
            csrf = decode_token(token)['csrf']
        client = app.test_client()
        client.set_cookie('__Secure-refresh_token', token, path='/api/auth')

        response = client.post(
            '/api/auth/refresh', headers={'X-CSRF-REFRESH-TOKEN': csrf})

        assert response.status_code == 503
        assert response.get_json()['error']['code'] == 'SERVICE_UNAVAILABLE'


class TestCacheControl:
    """Tokens and private notes must not be kept by any cache"""

    def test_api_responses_are_not_stored(self, client, sample_user, auth_headers):
        responses = [
            client.post('/api/auth/login',
                        json={'email': 'test@example.com', 'password': 'TestPassword123'}),
            client.get('/api/notes', headers=auth_headers),
            client.get('/api/notes/does-not-exist'),
        ]

        assert [r.headers.get('Cache-Control') for r in responses] == ['no-store'] * 3

    def test_a_route_can_set_its_own(self, monkeypatch):
        app = build_app(monkeypatch)

        @app.route('/_cached')
        def cached():
            return {}, 200, {'Cache-Control': 'max-age=60'}

        assert app.test_client().get('/_cached').headers['Cache-Control'] == 'max-age=60'


class TestJsonErrors:
    """Every error leaves the API as JSON the frontend can display"""

    @pytest.mark.parametrize('status, code', [
        (400, 'BAD_REQUEST'),
        (413, 'PAYLOAD_TOO_LARGE'),
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

    def test_oversized_body_is_rejected_before_parsing(self, client):
        response = client.post(
            '/api/auth/login', json={'email': 'a@b.com', 'password': 'x' * 20000})

        assert response.status_code == 413
        assert response.get_json()['error']['code'] == 'PAYLOAD_TOO_LARGE'

    def test_unhandled_exception_is_json_and_logged_once(self, monkeypatch, caplog):
        app = build_app(monkeypatch)
        app.config['PROPAGATE_EXCEPTIONS'] = False

        @app.route('/_crash')
        def crash():
            raise RuntimeError('boom')

        response = app.test_client().get('/_crash')

        assert response.status_code == 500
        assert response.get_json()['error']['code'] == 'INTERNAL_ERROR'
        tracebacks = [r for r in caplog.records if r.exc_info]
        assert len(tracebacks) == 1
