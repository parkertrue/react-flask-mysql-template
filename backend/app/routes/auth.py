from flask import Blueprint, request, make_response, jsonify, current_app
from sqlalchemy import select
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
    set_refresh_cookies,
    unset_jwt_cookies,
    get_csrf_token,
    decode_token
)

from app import db, limiter, redis_service
from app.models import User
from app.schemas import RegisterRequest, LoginRequest
from app.utils.errors import error_response


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("3 per hour")
def register():
    payload = RegisterRequest(**request.get_json())

    stmt = select(User).where(User.email == payload.email)
    existing_user = db.session.execute(stmt).scalar_one_or_none()

    if existing_user:
        return error_response(
            code="EMAIL_ALREADY_REGISTERED",
            message="Email already registered",
            status=409
        )

    user = User(email=payload.email)
    user.set_password(payload.password)

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User created"}), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    payload = LoginRequest(**request.get_json())

    stmt = select(User).where(User.email == payload.email)
    user = db.session.execute(stmt).scalar_one_or_none()

    if not user or not user.check_password(payload.password):
        return error_response(
            code="INVALID_CREDENTIALS",
            message="Invalid email or password",
            status=401
        )

    # Create tokens
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    # Extract JTI from refresh token and store in Redis
    if redis_service:
        decoded = decode_token(refresh_token)
        jti = decoded.get('jti')

        if jti:
            success = redis_service.store_refresh_token(
                user.id, jti, ttl_seconds=2592000)
            if not success:
                raise RuntimeError(
                    "Failed to store refresh token in Redis")

    # Only advertise a CSRF token when cookie CSRF protection is actually on;
    # IntegrationConfig turns it off for headless API tests.
    response_data = {"access_token": access_token}
    if current_app.config.get("JWT_COOKIE_CSRF_PROTECT", True):
        response_data["refresh_csrf"] = get_csrf_token(refresh_token)

    response = make_response(jsonify(response_data), 200)

    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/refresh", methods=["POST"])
@limiter.limit("10 per minute")
@jwt_required(refresh=True, locations=["cookies"])
def refresh():
    user_id = int(get_jwt_identity())
    old_jwt = get_jwt()
    old_jti = old_jwt.get('jti')

    # Create new tokens (rotation)
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))

    # Extract JTI from new refresh token
    if redis_service:
        decoded = decode_token(refresh_token)
        new_jti = decoded.get('jti')

        if new_jti:
            success = redis_service.store_refresh_token(
                user_id, new_jti, ttl_seconds=2592000)
            if not success:
                raise RuntimeError(
                    "Failed to store new refresh token in Redis")

            # Revoke old token
            if old_jti:
                redis_service.revoke_token(user_id, old_jti)

    # Only advertise a CSRF token when cookie CSRF protection is actually on;
    # IntegrationConfig turns it off for headless API tests.
    response_data = {"access_token": access_token}
    if current_app.config.get("JWT_COOKIE_CSRF_PROTECT", True):
        response_data["refresh_csrf"] = get_csrf_token(refresh_token)

    response = make_response(jsonify(response_data), 200)

    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True, locations=["cookies"])
def logout():
    user_id = int(get_jwt_identity())
    jwt_data = get_jwt()
    jti = jwt_data.get('jti')

    # Revoke refresh token
    if redis_service and jti:
        redis_service.revoke_token(user_id, jti)

    response = make_response(jsonify({"message": "Logged out"}), 200)
    unset_jwt_cookies(response)
    return response


@auth_bp.route("/logout-all", methods=["POST"])
@jwt_required(refresh=True, locations=["cookies"])
def logout_all():
    """Revoke all refresh tokens for the current user (logout from all devices)"""
    user_id = int(get_jwt_identity())

    # Revoke all user tokens
    message = "Logged out"
    if redis_service:
        count = redis_service.revoke_all_user_tokens(user_id)
        message = f"Logged out from {count} device(s)" if count > 0 else "No active sessions found"

    response = make_response(jsonify({"message": message}), 200)
    unset_jwt_cookies(response)
    return response
