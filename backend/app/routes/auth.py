from flask import Blueprint, abort, request, make_response, jsonify, current_app
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
from werkzeug.security import check_password_hash, generate_password_hash

from app import db, limiter
from app.models import User
from app.schemas import RegisterRequest, LoginRequest
from app.utils.errors import error_response
from app.utils.redis_service import get_redis_service


auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# Same algorithm as User.set_password, so checking it costs the same.
_DUMMY_PASSWORD_HASH = generate_password_hash('not-a-real-password')


def _issue_tokens(user_id: int, replaces: str | None = None):
    """Build a 200 response carrying a fresh access token and refresh cookie.

    The new refresh token's JTI is recorded in Redis, in place of the JTI in
    `replaces` when rotating; the blocklist loader treats any refresh token
    whose JTI is absent there as revoked.
    """
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))

    # A refresh token Redis never recorded counts as revoked, so the session
    # would end silently once the access token expires. Refuse up front.
    # Only unit tests run with Redis disabled and no store at all.
    redis_service = get_redis_service()
    if redis_service is not None or current_app.config['USES_SERVICES']:
        jti = decode_token(refresh_token)['jti']
        ttl = int(current_app.config['JWT_REFRESH_TOKEN_EXPIRES'].total_seconds())
        if redis_service is None or not redis_service.store_refresh_token(
                user_id, jti, ttl_seconds=ttl, replaces=replaces):
            return error_response(
                code='SERVICE_UNAVAILABLE',
                message='Sign-in is temporarily unavailable, please try again shortly',
                status=503
            )

    # Only advertise a CSRF token when cookie CSRF protection is actually on;
    # IntegrationConfig turns it off for headless API tests.
    response_data = {'access_token': access_token}
    if current_app.config.get('JWT_COOKIE_CSRF_PROTECT', True):
        response_data['refresh_csrf'] = get_csrf_token(refresh_token)

    response = make_response(jsonify(response_data), 200)
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route('/register', methods=['POST'])
@limiter.limit('3 per hour')
def register():
    payload = RegisterRequest.model_validate(request.get_json())

    stmt = select(User).where(User.email == payload.email)
    existing_user = db.session.execute(stmt).scalar_one_or_none()

    if existing_user:
        return error_response(
            code='EMAIL_ALREADY_REGISTERED',
            message='Email already registered',
            status=409
        )

    user = User(email=payload.email)
    user.set_password(payload.password)

    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'User created'}), 201


@auth_bp.route('/login', methods=['POST'])
@limiter.limit('5 per minute')
def login():
    payload = LoginRequest.model_validate(request.get_json())

    stmt = select(User).where(User.email == payload.email)
    user = db.session.execute(stmt).scalar_one_or_none()

    if user is None:
        # Hash anyway, so an unknown email takes as long as a wrong password
        # and response timing doesn't reveal which emails are registered.
        check_password_hash(_DUMMY_PASSWORD_HASH, payload.password)

    if user is None or not user.check_password(payload.password):
        return error_response(
            code='INVALID_CREDENTIALS',
            message='Invalid email or password',
            status=401
        )

    return _issue_tokens(user.id)


@auth_bp.route('/refresh', methods=['POST'])
@limiter.limit('10 per minute')
@jwt_required(refresh=True, locations=['cookies'])
def refresh():
    """Rotate: issue a new token pair and revoke the refresh token just used"""
    user_id = int(get_jwt_identity())
    return _issue_tokens(user_id, replaces=get_jwt().get('jti'))


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(refresh=True, locations=['cookies'])
def logout():
    user_id = int(get_jwt_identity())
    jti = get_jwt().get('jti')

    redis_service = get_redis_service()
    if redis_service and jti:
        redis_service.revoke_token(user_id, jti)

    response = make_response(jsonify({'message': 'Logged out'}), 200)
    unset_jwt_cookies(response)
    return response


@auth_bp.route('/clear-cookies', methods=['POST'])
def clear_cookies():
    """Expire the refresh cookies when a logout request itself failed.

    They are HttpOnly, so the client cannot remove them. No token is needed,
    since logout may have failed on exactly that. Requiring a JSON body means
    another site can only send this with a CORS preflight, which it won't pass.
    """
    if not request.is_json:
        abort(415)

    response = make_response(jsonify({'message': 'Cookies cleared'}), 200)
    unset_jwt_cookies(response)
    return response


@auth_bp.route('/logout-all', methods=['POST'])
@jwt_required(refresh=True, locations=['cookies'])
def logout_all():
    """Revoke all refresh tokens for the current user (logout from all devices)"""
    user_id = int(get_jwt_identity())

    message = 'Logged out'
    redis_service = get_redis_service()
    if redis_service:
        count = redis_service.revoke_all_user_tokens(user_id)
        message = f'Logged out from {count} device(s)' if count > 0 else 'No active sessions found'

    response = make_response(jsonify({'message': message}), 200)
    unset_jwt_cookies(response)
    return response
