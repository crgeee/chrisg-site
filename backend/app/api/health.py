from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__, url_prefix="/api")

@health_bp.route("/health")
def health_check():
    """Simple health check -- useful for Docker health checks and monitoring."""
    return jsonify({"status": "ok"})
