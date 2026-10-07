from flask import Blueprint

health_bp = Blueprint('health', __name__, url_prefix='/api')


@health_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return {'status': 'ok'}, 200
