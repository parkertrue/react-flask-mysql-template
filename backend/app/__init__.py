from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from pydantic import ValidationError

from app.config import get_config
from app.errors import error_response


jwt = JWTManager()
db = SQLAlchemy()
migrate = Migrate()


def create_app():
    """Application factory for creating Flask app instances"""
    app = Flask(__name__)

    # Load configuration
    config = get_config()
    app.config.from_object(config)

    # Initialize extensions
    jwt.init_app(app)
    db.init_app(app)
    migrate.init_app(app, db)

    # Enable CORS only in development
    if app.config.get("FLASK_ENV") == "development":
        CORS(app, origins=app.config["CORS_ORIGINS"],
             supports_credentials=True)

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

    # Global error handler for Pydantic validation errors
    @app.errorhandler(ValidationError)
    def handle_pydantic_error(e):
        return error_response(
            code="VALIDATION_ERROR",
            message="Invalid input",
            status=400
        )

    # Fallback error handler
    @app.errorhandler(404)
    def not_found(e):
        return error_response(
            code="NOT_FOUND",
            message="Resource not found",
            status=404
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
