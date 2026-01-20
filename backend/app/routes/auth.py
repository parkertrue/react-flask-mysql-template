from flask import Blueprint, request, make_response, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    set_refresh_cookies,
    unset_jwt_cookies,
    get_csrf_token
)

from app import db
from app.models import User
from app.schemas import RegisterRequest, LoginRequest
from app.errors import error_response


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    payload = RegisterRequest(**request.get_json())

    if User.query.filter_by(email=payload.email).first():
        return error_response(
            code="EMAIL_ALREADY_REGISTERED",
            message="Email already registered",
            status=409
        )

    user = User(email=payload.email)    # pyright: ignore[reportCallIssue]
    user.set_password(payload.password)

    db.session.add(user)
    db.session.commit()

    return {"message": "User created"}, 201


@auth_bp.route("/login", methods=["POST"])
def login():
    payload = LoginRequest(**request.get_json())

    user = User.query.filter_by(email=payload.email).first()
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
@jwt_required(refresh=True, locations=["cookies"])
def refresh():
    user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(user_id))

    return {"access_token": access_token}, 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True, locations=["cookies"])
def logout():
    print("LOGOUT")
    response = make_response(jsonify({"message": "Logged out"}), 200)
    unset_jwt_cookies(response)
    return response
