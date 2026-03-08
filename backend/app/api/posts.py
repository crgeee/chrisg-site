from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.post import Post

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")

@posts_bp.route("", methods=["GET"])
def list_posts():
    """List all published posts, newest first. Paginated."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    pagination = (
        Post.query
        .filter_by(published=True)
        .order_by(Post.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "posts": [p.to_dict() for p in pagination.items],
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
    return jsonify({"posts": [p.to_dict() for p in posts]})

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
    user_id = int(get_jwt_identity())

    post = Post(
        title=data["title"],
        slug=data.get("slug"),
        content=data["content"],
        excerpt=data["excerpt"],
        published=data.get("published", False),
        author_id=user_id,
    )
    db.session.add(post)
    db.session.commit()

    return jsonify(post.to_dict()), 201

@posts_bp.route("/<slug>", methods=["PUT"])
@jwt_required()
def update_post(slug):
    """Update an existing post by slug. Auth required."""
    post = Post.query.filter_by(slug=slug).first()
    if post is None:
        return jsonify({"error": "Post not found"}), 404

    data = request.get_json()
    for field in ["title", "slug", "content", "excerpt", "published"]:
        if field in data:
            setattr(post, field, data[field])

    db.session.commit()
    return jsonify(post.to_dict())

@posts_bp.route("/<slug>", methods=["DELETE"])
@jwt_required()
def delete_post(slug):
    """Delete a post by slug. Auth required."""
    post = Post.query.filter_by(slug=slug).first()
    if post is None:
        return jsonify({"error": "Post not found"}), 404

    db.session.delete(post)
    db.session.commit()
    return jsonify({"message": "Post deleted"})
