from flask import Blueprint

from app import limiter

health_bp = Blueprint('health', __name__, url_prefix='/api')


@health_bp.route('/health', methods=['GET'])
# The container healthcheck alone polls this 360 times an hour from one
# address; under the default limits it would start failing with 429s.
@limiter.exempt
def health():
    """Health check endpoint"""
    return {'status': 'ok'}, 200
