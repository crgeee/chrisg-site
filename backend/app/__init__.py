import logging
import os

from flask import Flask, jsonify
from .config import DevelopmentConfig, TestingConfig, ProductionConfig
from .extensions import db, migrate, jwt, cors

logger = logging.getLogger(__name__)

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
        config_name = os.environ.get("FLASK_ENV", "development")
    app.config.from_object(config_map[config_name])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Register token blocklist checker for logout support
    from .api.auth import is_token_revoked
    jwt.token_in_blocklist_loader(is_token_revoked)

    # CORS: restrict origins via CORS_ORIGINS env var (comma-separated)
    origins = app.config.get("CORS_ORIGINS", "*")
    if origins != "*":
        origins = [o.strip() for o in origins.split(",")]
    cors.init_app(app, origins=origins)

    # Global error handler — don't leak stack traces
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.exception("Unhandled exception")
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    # Register blueprints (API routes)
    from .api.health import health_bp
    app.register_blueprint(health_bp)

    from .api.auth import auth_bp
    app.register_blueprint(auth_bp)

    from .api.posts import posts_bp
    app.register_blueprint(posts_bp)

    from .api.sitemap import sitemap_bp
    app.register_blueprint(sitemap_bp)

    from .api.contact import contact_bp
    app.register_blueprint(contact_bp)

    @app.cli.command("seed")
    def seed():
        """Create the admin user. Run with: flask seed"""
        from .models.user import User
        admin_password = os.environ.get("ADMIN_PASSWORD")
        if not admin_password:
            print("ERROR: Set ADMIN_PASSWORD env var before seeding.")
            return
        existing = User.query.filter_by(username="admin").first()
        if existing:
            existing.set_password(admin_password)
            db.session.commit()
            print("Admin password updated.")
            return
        user = User(username="admin", email="crg167@gmail.com")
        user.set_password(admin_password)
        db.session.add(user)
        db.session.commit()
        print("Admin user created. Username: admin")

    # In production, serve the React frontend's built files.
    static_folder = os.path.join(app.root_path, "..", "static")
    if os.path.exists(static_folder):
        from flask import send_from_directory

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            # send_from_directory is safe against path traversal
            file_path = os.path.join(static_folder, path)
            if path and os.path.isfile(file_path):
                return send_from_directory(static_folder, path)
            return send_from_directory(static_folder, "index.html")

    return app
