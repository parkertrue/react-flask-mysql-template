from flask import Blueprint, request, make_response, jsonify
from sqlalchemy import select
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    set_refresh_cookies,
    unset_jwt_cookies,
    get_csrf_token
)

from app import db, limiter
from app.models import User
from app.schemas import RegisterRequest, LoginRequest
from app.errors import error_response


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

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    response = make_response(jsonify({
        "access_token": access_token,
        "refresh_csrf": get_csrf_token(refresh_token)
    }), 200)

    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/refresh", methods=["POST"])
@limiter.limit("10 per minute")
@jwt_required(refresh=True, locations=["cookies"])
def refresh():
    user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(user_id))

    return jsonify({"access_token": access_token}), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True, locations=["cookies"])
def logout():
    response = make_response(jsonify({"message": "Logged out"}), 200)
    unset_jwt_cookies(response)
    return response
