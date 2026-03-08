from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.post import Post

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")

MAX_TITLE_LENGTH = 200
MAX_EXCERPT_LENGTH = 500
MAX_CONTENT_LENGTH = 50000


def _validate_post_data(data):
    """Validate post input fields. Returns error message or None."""
    title = data.get("title", "")
    if not title or not title.strip():
        return "Title is required"
    if len(title) > MAX_TITLE_LENGTH:
        return "Title too long"

    content = data.get("content", "")
    if not content or not content.strip():
        return "Content is required"
    if len(content) > MAX_CONTENT_LENGTH:
        return "Content too long"

    excerpt = data.get("excerpt", "")
    if not excerpt or not excerpt.strip():
        return "Excerpt is required"
    if len(excerpt) > MAX_EXCERPT_LENGTH:
        return "Excerpt too long"

    return None


@posts_bp.route("", methods=["GET"])
def list_posts():
    """List all published posts, newest first. Paginated. Returns summaries (no content)."""
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 10, type=int), 50)

    pagination = (
        Post.query
        .filter_by(published=True)
        .order_by(Post.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "posts": [p.to_summary_dict() for p in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
    })

@posts_bp.route("/drafts", methods=["GET"])
@jwt_required()
def list_drafts():
    """List all unpublished drafts. Admin only."""
    posts = (
        Post.query
        .filter_by(published=False)
        .order_by(Post.created_at.desc())
        .all()
    )
    return jsonify({"posts": [p.to_summary_dict() for p in posts]})

@posts_bp.route("/<slug>", methods=["GET"])
def get_post(slug):
    """Get a single published post by its slug."""
    post = Post.query.filter_by(slug=slug, published=True).first()
    if post is None:
        return jsonify({"error": "Post not found"}), 404
    return jsonify(post.to_dict())

@posts_bp.route("", methods=["POST"])
@jwt_required()
def create_post():
    """Create a new blog post. Auth required."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    error = _validate_post_data(data)
    if error:
        return jsonify({"error": error}), 400

    user_id = int(get_jwt_identity())

    post = Post(
        title=data["title"].strip(),
        slug=data.get("slug"),
        content=data["content"],
        excerpt=data["excerpt"].strip(),
        published=data.get("published", False),
        author_id=user_id,
    )
    db.session.add(post)
    db.session.commit()

    return jsonify(post.to_dict()), 201

@posts_bp.route("/<slug>", methods=["PUT"])
@jwt_required()
def update_post(slug):
    """Update an existing post by slug. Only the author can update."""
    post = Post.query.filter_by(slug=slug).first()
    if post is None:
        return jsonify({"error": "Post not found"}), 404

    user_id = int(get_jwt_identity())
    if post.author_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    for field in ["title", "slug", "content", "excerpt", "published"]:
        if field in data:
            value = data[field]
            if field in ("title", "excerpt") and isinstance(value, str):
                value = value.strip()
            setattr(post, field, value)

    db.session.commit()
    return jsonify(post.to_dict())

@posts_bp.route("/<slug>", methods=["DELETE"])
@jwt_required()
def delete_post(slug):
    """Delete a post by slug. Only the author can delete."""
    post = Post.query.filter_by(slug=slug).first()
    if post is None:
        return jsonify({"error": "Post not found"}), 404

    user_id = int(get_jwt_identity())
    if post.author_id != user_id:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted"})
