from flask import Flask
from .config import DevelopmentConfig, TestingConfig, ProductionConfig
from .extensions import db, migrate, jwt, cors

config_map = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}

def create_app(config_name=None):
    """
    App factory: creates and configures a Flask application instance.

    Args:
        config_name: One of 'development', 'testing', 'production'.
                     Defaults to FLASK_ENV env var, or 'development'.
    """
    app = Flask(__name__)

    if config_name is None:
        import os
        config_name = os.environ.get("FLASK_ENV", "development")
    app.config.from_object(config_map[config_name])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)

    # Register blueprints (API routes)
    from .api.health import health_bp
    app.register_blueprint(health_bp)

    from .api.auth import auth_bp
    app.register_blueprint(auth_bp)

    return app
