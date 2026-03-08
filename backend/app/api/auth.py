from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from app.extensions import db
from app.models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# In-memory token blocklist (resets on restart, which is acceptable for
# a single-user blog — refresh tokens expire after 30 days anyway)
_blocklisted_jtis: set[str] = set()


def is_token_revoked(jwt_header, jwt_payload):
    return jwt_payload.get("jti") in _blocklisted_jtis


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate a user and return JWT tokens.
    Expects JSON: {"username": "...", "password": "..."}
    Returns: {"access_token": "...", "refresh_token": "..."}
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
    })

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Get a new access token using a valid refresh token."""
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({"access_token": access_token})

@auth_bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True)
def logout():
    """Revoke the refresh token so it can't be used again."""
    jti = get_jwt()["jti"]
    _blocklisted_jtis.add(jti)
    return jsonify({"message": "Logged out"})

@auth_bp.route("/me")
@jwt_required()
def me():
    """Return the currently authenticated user's info."""
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if user is None:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())
