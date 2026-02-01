from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pydantic import ValidationError

from app.config import get_config
from app.utils.errors import error_response
from app.utils.redis_service import RedisService


jwt = JWTManager()
db = SQLAlchemy()
migrate = Migrate()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000 per day", "200 per hour"]
)
redis_service: RedisService | None = None


def create_app():
    """Application factory for creating Flask app instances"""
    global redis_service

    app = Flask(__name__)

    # Load configuration
    config = get_config()
    app.config.from_object(config)

    # Initialize extensions
    jwt.init_app(app)
    db.init_app(app)
    migrate.init_app(app, db)

    # Initialize Redis and rate limiter (skip in testing)
    if app.config["FLASK_ENV"] != "testing":
        redis_service = RedisService(
            host=app.config["REDIS_HOST"],
            port=app.config["REDIS_PORT"],
            db=app.config["REDIS_DB"],
            password=app.config["REDIS_PASSWORD"],
            max_connections=app.config["REDIS_MAX_CONNECTIONS"]
        )

        limiter.init_app(app)

    # Enable CORS (only in development)
    if app.config["FLASK_ENV"] == "development":
        CORS(app, origins=app.config["CORS_ORIGINS"],
             supports_credentials=True)

    # JWT blocklist loader for token revocation
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        """Check if refresh token has been revoked"""
        # Only check refresh tokens
        if jwt_payload.get('type') != 'refresh':
            return False

        # Skip Redis check in testing
        if app.config["FLASK_ENV"] == "testing" or redis_service is None:
            return False

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

    # Generic error handlers
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

    @app.errorhandler(500)
    def server_error(e):
        app.logger.exception(e)
        return error_response(
            code="INTERNAL_ERROR",
            message="Something went wrong",
            status=500
        )

    # Register blueprints
    from app.routes import register_routes
    register_routes(app)

    return app
