from .health import health_bp
from .auth import auth_bp
from .notes import notes_bp


def register_routes(app):
    """Register all blueprints with the Flask app"""
    blueprints = [auth_bp, health_bp, notes_bp]
    for bp in blueprints:
        app.register_blueprint(bp)
