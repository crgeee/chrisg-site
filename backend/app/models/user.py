from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class User(db.Model):
    """
    Represents an admin user who can create and manage blog posts.

    There's no public registration -- you create your user via a CLI command
    or directly in the database. Passwords are hashed using Werkzeug's
    built-in hashing so plain text is never stored.
    """
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Relationship to posts will be added in Task 3 when Post model is created:
    # posts = db.relationship("Post", back_populates="author", lazy="dynamic")

    def set_password(self, password):
        """Hash the plain-text password and store the hash."""
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    def check_password(self, password):
        """Verify a plain-text password against the stored hash."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Serialize user to a dict for JSON responses (never include password)."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
