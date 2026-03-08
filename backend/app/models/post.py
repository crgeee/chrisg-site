import re
from datetime import datetime, timezone
from app.extensions import db


class Post(db.Model):
    """
    Represents a blog post. Posts can be drafts (published=False) or live.

    The slug is the URL-friendly version of the title (e.g. "my-first-post").
    If you don't provide one, it's auto-generated from the title.
    Content is stored as markdown and rendered on the frontend.
    """
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(200), unique=True, nullable=False)
    content = db.Column(db.Text, nullable=False)
    excerpt = db.Column(db.String(500), nullable=False)
    published = db.Column(db.Boolean, default=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    author = db.relationship("User", back_populates="posts")

    def __init__(self, **kwargs):
        """Auto-generate slug from title if not provided."""
        if "slug" not in kwargs or not kwargs["slug"]:
            kwargs["slug"] = self._slugify(kwargs.get("title", ""))
        super().__init__(**kwargs)

    @staticmethod
    def _slugify(text):
        """
        Convert a title into a URL-safe slug.
        'Hello World! This is Great' -> 'hello-world-this-is-great'
        """
        text = text.lower().strip()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[\s_]+", "-", text)
        text = re.sub(r"-+", "-", text)
        return text.strip("-")

    def to_dict(self):
        """Serialize post to a dict for JSON responses."""
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "content": self.content,
            "excerpt": self.excerpt,
            "published": self.published,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "author": self.author.to_dict() if self.author else None,
        }
