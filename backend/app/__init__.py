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

    from .api.posts import posts_bp
    app.register_blueprint(posts_bp)

    @app.cli.command("seed")
    def seed():
        """Create the admin user. Run with: flask seed"""
        from .models.user import User
        if User.query.filter_by(username="admin").first():
            print("Admin user already exists.")
            return
        user = User(username="admin", email="crg167@gmail.com")
        user.set_password("changeme")  # Change this immediately after first login
        db.session.add(user)
        db.session.commit()
        print("Admin user created. Username: admin")

    return app
