from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pydantic import ValidationError
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import get_config
from app.utils.errors import error_response
from app.utils.redis_service import connect_redis, get_redis_service


jwt = JWTManager()
db = SQLAlchemy()
migrate = Migrate()
# No default limits: only the routes that need one (login, register,
# refresh) declare it. nginx caps every client's request rate, and a per-IP
# daily quota on the whole API would lock out everyone sharing an address
# (an office, a campus, a mobile carrier's NAT) once a few of them hit it.
limiter = Limiter(key_func=get_remote_address)


def create_app():
    """Application factory for creating Flask app instances"""
    app = Flask(__name__)

    config = get_config()
    app.config.from_object(config)

    # Behind nginx, REMOTE_ADDR is the proxy's address. Without this every
    # client shares one rate-limit bucket, so a single user can lock everyone
    # out of login. Only trust as many X-Forwarded-* hops as there are proxies.
    proxies = app.config["TRUSTED_PROXY_COUNT"]
    if proxies:
        app.wsgi_app = ProxyFix(
            app.wsgi_app, x_for=proxies, x_proto=proxies, x_host=proxies)

    jwt.init_app(app)
    db.init_app(app)
    migrate.init_app(app, db)

    # A Redis failure must not stop the app from booting; get_redis_service()
    # retries later, and the blocklist loader below fails closed meanwhile.
    app.extensions["redis_service"] = None
    if app.config["REDIS_ENABLED"]:
        connect_redis(app)

    if app.config["RATELIMIT_ENABLED"]:
        limiter.init_app(app)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        """Check if refresh token has been revoked"""
        # Only refresh tokens are tracked in Redis
        if jwt_payload.get('type') != 'refresh':
            return False

        # Fail closed: without Redis we cannot tell a live refresh token from a
        # revoked one, so treat them all as revoked rather than honouring
        # tokens the user already logged out of.
        redis_service = get_redis_service()
        if redis_service is None:
            return True

        jti = jwt_payload.get('jti')
        user_id = jwt_payload.get('sub')

        if not jti or not user_id:
            return True

        # Returns True if token is revoked (not found in Redis)
        try:
            user_id_int = int(user_id)
            is_valid = redis_service.is_token_valid(user_id_int, jti)
            return not is_valid
        except (ValueError, TypeError):
            return True

    # JWT error handlers
    @jwt.unauthorized_loader
    def missing_token(reason):
        return error_response(
            code="AUTH_MISSING_TOKEN",
            message="Authentication required",
            status=401
        )

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return error_response(
            code="AUTH_INVALID_TOKEN",
            message="Invalid authentication token",
            status=401
        )

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return error_response(
            code="AUTH_TOKEN_EXPIRED",
            message="Session expired",
            status=401
        )

    @jwt.revoked_token_loader
    def revoked_token(jwt_header, jwt_payload):
        return error_response(
            code="AUTH_TOKEN_REVOKED",
            message="Session revoked",
            status=401
        )

    # Pydantic error handler
    @app.errorhandler(ValidationError)
    def handle_pydantic_error(e):
        return error_response(
            code="VALIDATION_ERROR",
            message="Invalid input",
            status=422
        )

    # Generic error handlers. Werkzeug's defaults are HTML pages, which the
    # frontend cannot show; every error leaves the API in the same JSON shape.
    @app.errorhandler(400)
    def bad_request(e):
        return error_response(
            code="BAD_REQUEST",
            message="Malformed request",
            status=400
        )

    @app.errorhandler(404)
    def not_found(e):
        return error_response(
            code="NOT_FOUND",
            message="Resource not found",
            status=404
        )

    @app.errorhandler(405)
    def method_not_allowed(e):
        return error_response(
            code="METHOD_NOT_ALLOWED",
            message="Method not allowed",
            status=405
        )

    @app.errorhandler(413)
    def payload_too_large(e):
        return error_response(
            code="PAYLOAD_TOO_LARGE",
            message="Request body too large",
            status=413
        )

    @app.errorhandler(415)
    def unsupported_media_type(e):
        return error_response(
            code="UNSUPPORTED_MEDIA_TYPE",
            message="Request body must be JSON",
            status=415
        )

    @app.errorhandler(429)
    def rate_limited(e):
        return error_response(
            code="RATE_LIMITED",
            message="Too many requests, please try again later",
            status=429
        )

    # No logging here: Flask logs the traceback of an unhandled exception
    # before calling this handler.
    @app.errorhandler(500)
    def server_error(e):
        return error_response(
            code="INTERNAL_ERROR",
            message="Something went wrong",
            status=500
        )

    # Imported here, not at the top: the route modules import db and limiter
    # from this package, so a module-level import would be circular.
    from app.routes import register_routes
    register_routes(app)

    return app
