from flask import Blueprint, jsonify
from flask_jwt_extended import current_user, jwt_required

from app.account.schemas import AccountResponse

account_bp = Blueprint('account', __name__, url_prefix='/api/account')


@account_bp.route('', methods=['GET'])
@jwt_required()
def get_account():
    """The signed-in user's account. Every app keeps it, so shared tests use
    it as their protected route; account settings and deletion belong here."""
    return jsonify(AccountResponse.model_validate(current_user).model_dump()), 200
