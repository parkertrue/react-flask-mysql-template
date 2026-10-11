import hashlib
from datetime import datetime, timezone

from flask import Blueprint, abort, g, request, make_response, jsonify, current_app
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    current_user,
    jwt_required,
    get_jwt,
    set_refresh_cookies,
    unset_jwt_cookies,
    get_csrf_token,
    decode_token
)
from jwt.exceptions import PyJWTError
from flask_jwt_extended.exceptions import JWTExtendedException
from werkzeug.security import generate_password_hash

from flask_limiter.util import get_remote_address

from app import db, limiter
from app.models import User
from app.schemas import RegisterRequest, LoginRequest
from app.schemas.auth import normalize_email
from app.utils.errors import error_response
from app.utils.passwords import verify_password
from app.utils.redis_service import get_redis_service


auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# Same algorithm as User.set_password, so checking it costs the same.
_DUMMY_PASSWORD_HASH = generate_password_hash('not-a-real-password')


def _login_email_key():
    """Rate-limit key for the account being logged in to, whatever the IP.

    A per-IP limit alone either locks out everyone behind a shared address or,
    set loosely, lets one attacker guess an account's password from many. The
    email is normalized as the schema stores it, so every spelling of one
    address shares a bucket, then lowercased like MySQL's case-insensitive
    match on users.email, and hashed so the limiter's Redis keys hold no
    addresses.
    """
    body = request.get_json(silent=True)
    email = body.get('email') if isinstance(body, dict) else None
    if not isinstance(email, str):
        email = ''
    try:
        email = normalize_email(email)
    except ValueError:
        # The login itself will answer 422; any key will do
        email = email.strip()
    return 'email:' + hashlib.sha256(email.lower().encode()).hexdigest()


def _login_email_and_ip_key():
    """The account and the client's address: a lockout hits only that address"""
    return f'{_login_email_key()}:ip:{get_remote_address()}'


def _login_failed(response):
    """Only wrong passwords count toward the account limits, so the owner's
    own successful logins never use them up."""
    return response.status_code == 401


def _refresh_user_id():
    """The user a valid refresh cookie belongs to, or None.

    Limits are checked before @jwt_required runs, so the cookie is decoded
    here; decode_token checks the signature and expiry.
    """
    if 'refresh_user_id' not in g:
        g.refresh_user_id = None
        token = request.cookies.get(current_app.config['JWT_REFRESH_COOKIE_NAME'])
        if token:
            try:
                claims = decode_token(token)
            except (PyJWTError, JWTExtendedException):
                claims = {}
            if claims.get('type') == 'refresh':
                g.refresh_user_id = claims.get('sub')
    return g.refresh_user_id


def _issue_tokens(user_id: int, auth_time: int, replaces: str | None = None):
    """Build a 200 response carrying a fresh access token and refresh cookie.

    `auth_time` is when the user logged in, carried through every rotation:
    the refresh token expires JWT_REFRESH_TOKEN_EXPIRES after it, however
    often it is refreshed, so a session (or a stolen cookie) has an absolute
    lifetime. Once it passes, the cookie is expired and refresh answers 401.

    The new refresh token's JTI is recorded in Redis, in place of the JTI in
    `replaces` when rotating; the blocklist loader treats any refresh token
    whose JTI is absent there as revoked.
    """
    session_ends = (datetime.fromtimestamp(auth_time, timezone.utc)
                    + current_app.config['JWT_REFRESH_TOKEN_EXPIRES'])
    remaining = session_ends - datetime.now(timezone.utc)
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(
        identity=str(user_id),
        additional_claims={'auth_time': auth_time},
        expires_delta=remaining)

    redis_service = get_redis_service()
    jti = decode_token(refresh_token)['jti']
    ttl = max(int(remaining.total_seconds()), 1)
    if redis_service is None:
        recorded = None
    elif replaces:
        recorded = redis_service.rotate_refresh_token(user_id, replaces, jti, ttl_seconds=ttl)
    else:
        # A new sign-in replaces nothing, so its only failure is Redis's own
        recorded = redis_service.store_refresh_token(user_id, jti, ttl_seconds=ttl) or None

    if recorded is False:
        # Another request rotated this token between the blocklist check and
        # here; refuse it as the blocklist would have a moment later.
        return error_response(
            code='AUTH_TOKEN_REVOKED',
            message='Session revoked',
            status=401
        )
    if recorded is None:
        # A refresh token Redis never recorded counts as revoked, so the
        # session would end silently once the access token expires. Refuse
        # up front.
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


def _already_registered():
    return error_response(
        code='EMAIL_ALREADY_REGISTERED',
        message='Email already registered',
        status=409
    )


@auth_bp.route('/register', methods=['POST'])
@limiter.limit('10 per hour')
def register():
    payload = RegisterRequest.model_validate(request.get_json())

    # A fast path that skips hashing a password for a taken email. The
    # unique index on users.email is the real check, below.
    stmt = select(User).where(User.email == payload.email)
    if db.session.execute(stmt).scalar_one_or_none():
        return _already_registered()

    user = User(email=payload.email)
    user.set_password(payload.password)

    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        # Another request registered the same email since the check above
        # (a double submit, or a client retrying)
        db.session.rollback()
        return _already_registered()

    return jsonify({'message': 'User created'}), 201


@auth_bp.route('/login', methods=['POST'])
# Loose per IP, so a shared address keeps working.
# Tight per account and address, so a stranger's wrong guesses lock out only
# the stranger; loose per account alone, which bounds guessing spread over
# many addresses.
@limiter.limit('20 per minute')
@limiter.limit('5 per minute', key_func=_login_email_and_ip_key, deduct_when=_login_failed)
@limiter.limit('100 per hour', key_func=_login_email_key, deduct_when=_login_failed)
def login():
    payload = LoginRequest.model_validate(request.get_json())

    stmt = select(User).where(User.email == payload.email)
    user = db.session.execute(stmt).scalar_one_or_none()

    if user is None:
        # Hash anyway, so an unknown email takes as long as a wrong password
        # and response timing doesn't reveal which emails are registered.
        verify_password(_DUMMY_PASSWORD_HASH, payload.password)

    if user is None or not user.check_password(payload.password):
        return error_response(
            code='INVALID_CREDENTIALS',
            message='Invalid email or password',
            status=401
        )

    return _issue_tokens(user.id, auth_time=int(datetime.now(timezone.utc).timestamp()))


@auth_bp.route('/refresh', methods=['POST'])
# Per user, not per IP: everyone behind a shared address refreshes from it,
# and a 429 here would log them all out. A request without a valid cookie
# is exempt, since @jwt_required turns it away cheaply with a 401.
@limiter.limit(
    '10 per minute',
    key_func=lambda: f'user:{_refresh_user_id()}',
    exempt_when=lambda: _refresh_user_id() is None)
@jwt_required(refresh=True, locations=['cookies'])
def refresh():
    """Rotate: issue a new token pair and revoke the refresh token just used"""
    claims = get_jwt()
    return _issue_tokens(current_user.id, auth_time=claims['auth_time'], replaces=claims['jti'])


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(refresh=True, locations=['cookies'])
def logout():
    user_id = current_user.id
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
    # Unlike logout, this exists only for its effect on the server: other
    # devices stay signed in unless Redis drops their tokens. Report a failure
    # and keep the cookie, so the user can try again.
    redis_service = get_redis_service()
    count = redis_service.revoke_all_user_tokens(current_user.id) if redis_service else None
    if count is None:
        return error_response(
            code='SERVICE_UNAVAILABLE',
            message='Could not sign out other devices, please try again shortly',
            status=503
        )

    message = f'Logged out from {count} device(s)' if count > 0 else 'No active sessions found'
    response = make_response(jsonify({'message': message}), 200)
    unset_jwt_cookies(response)
    return response
