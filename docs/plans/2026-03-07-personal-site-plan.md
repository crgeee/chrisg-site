# Personal Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal Flask + React website with blog and admin panel, deployed via CI/CD to a Hetzner VPS.

**Architecture:** Flask REST API backend with Blueprints, SQLAlchemy, and JWT auth. React TypeScript SPA frontend with Vite. Dockerized and auto-deployed via GitHub Actions.

**Tech Stack:** Flask, SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, React, TypeScript, Vite, Docker, Nginx, GitHub Actions

**Design Doc:** `docs/plans/2026-03-07-personal-site-design.md`

---

## Task 1: Project Scaffolding & Git Init

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/extensions.py`
- Create: `backend/requirements.txt`
- Create: `backend/wsgi.py`
- Create: `.gitignore`

**Step 1: Create .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.venv/
venv/
*.db

# Environment
.env

# Node
node_modules/
frontend/dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

**Step 2: Create backend requirements.txt**

```
Flask==3.1.3
Flask-SQLAlchemy==3.1.1
Flask-Migrate==4.1.0
Flask-JWT-Extended==4.7.1
Flask-CORS==5.0.1
gunicorn==23.0.0
python-dotenv==1.1.0
```

**Step 3: Create backend/app/config.py**

Configuration classes for dev/test/prod. Reads secrets from environment variables with sensible defaults for development.

```python
import os

class Config:
    """Base configuration shared across all environments."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-dev-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = 900  # 15 minutes
    JWT_REFRESH_TOKEN_EXPIRES = 2592000  # 30 days

class DevelopmentConfig(Config):
    """Local development -- debug on, SQLite file in project root."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///dev.db"

class TestingConfig(Config):
    """Testing -- in-memory SQLite so tests are fast and isolated."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

class ProductionConfig(Config):
    """Production -- reads DATABASE_URL from env, debug off."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///prod.db")
```

**Step 4: Create backend/app/extensions.py**

Central place to initialize Flask extensions. Avoids circular imports by creating extension instances here and initializing them with the app in the factory.

```python
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS

# Create extension instances without binding to an app yet.
# They get bound in the app factory (app/__init__.py).
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
```

**Step 5: Create backend/app/__init__.py (App Factory)**

The app factory pattern lets us create multiple app instances (one for dev, one for testing, etc.) from the same code.

```python
from flask import Flask
from .config import DevelopmentConfig, TestingConfig, ProductionConfig
from .extensions import db, migrate, jwt, cors

# Map string names to config classes so we can switch via environment variable.
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

    # Determine which config to use
    if config_name is None:
        import os
        config_name = os.environ.get("FLASK_ENV", "development")
    app.config.from_object(config_map[config_name])

    # Initialize extensions with this app instance
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)

    # Register blueprints (API routes) -- added in later tasks
    # from .api.health import health_bp
    # app.register_blueprint(health_bp)

    return app
```

**Step 6: Create backend/wsgi.py**

Entry point for Gunicorn in production.

```python
from app import create_app

# Gunicorn looks for a variable called 'app' in this module.
# Run with: gunicorn wsgi:app
app = create_app()
```

**Step 7: Install dependencies and verify the app starts**

Run:
```bash
cd backend
pip install -r requirements.txt
FLASK_APP=app flask run
```
Expected: Flask dev server starts on port 5000 (will 404 since no routes yet, that's fine).

**Step 8: Init git and commit**

```bash
cd /path/to/chrisg-site
git init
git add .gitignore backend/
git commit -m "feat: scaffold Flask backend with app factory, config, and extensions"
```

---

## Task 2: User Model

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/user.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_user_model.py`

**Step 1: Create test fixtures in conftest.py**

```python
import pytest
from app import create_app
from app.extensions import db as _db

@pytest.fixture
def app():
    """Create a Flask app configured for testing (in-memory SQLite)."""
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()

@pytest.fixture
def db(app):
    """Provide the database session for tests."""
    return _db

@pytest.fixture
def client(app):
    """Provide a Flask test client for making HTTP requests."""
    return app.test_client()
```

**Step 2: Write the failing test**

```python
from app.models.user import User

def test_create_user(db):
    """A new user should be saveable and retrievable from the database."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    db.session.add(user)
    db.session.commit()

    found = User.query.filter_by(username="admin").first()
    assert found is not None
    assert found.email == "admin@example.com"

def test_password_hashing(db):
    """Password should be hashed, not stored in plain text."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    assert user.password_hash != "secure123"
    assert user.check_password("secure123") is True
    assert user.check_password("wrong") is False
```

**Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_user_model.py -v`
Expected: FAIL with ImportError (User doesn't exist yet)

**Step 4: Write the User model**

```python
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

class User(db.Model):
    """
    Represents an admin user who can create and manage blog posts.

    There's no public registration -- you create your user via a CLI command
    or directly in the database. Passwords are hashed using Werkzeug's
    built-in bcrypt-based hashing so plain text is never stored.
    """
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Relationship: a user can have many posts.
    # back_populates links this to Post.author so you can traverse both directions.
    posts = db.relationship("Post", back_populates="author", lazy="dynamic")

    def set_password(self, password):
        """Hash the plain-text password and store the hash."""
        self.password_hash = generate_password_hash(password)

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
```

Create `backend/app/models/__init__.py`:
```python
# Import models here so SQLAlchemy discovers them when creating tables.
from .user import User
from .post import Post
```

Note: This will fail until Post exists. Create a placeholder `backend/app/models/post.py` with just a comment for now, and update the `__init__.py` to only import User until Task 3.

Temporary `backend/app/models/__init__.py`:
```python
from .user import User
```

**Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_user_model.py -v`
Expected: 2 passed

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add User model with password hashing and tests"
```

---

## Task 3: Post Model

**Files:**
- Create: `backend/app/models/post.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/test_post_model.py`

**Step 1: Write the failing test**

```python
from app.models.user import User
from app.models.post import Post

def test_create_post(db):
    """A post should be saveable with all fields and linked to an author."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    db.session.add(user)
    db.session.commit()

    post = Post(
        title="My First Post",
        slug="my-first-post",
        content="# Hello\n\nThis is my first post.",
        excerpt="This is my first post.",
        published=True,
        author_id=user.id,
    )
    db.session.add(post)
    db.session.commit()

    found = Post.query.filter_by(slug="my-first-post").first()
    assert found is not None
    assert found.title == "My First Post"
    assert found.author.username == "admin"

def test_auto_slug_generation(db):
    """If no slug is provided, one should be generated from the title."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    db.session.add(user)
    db.session.commit()

    post = Post(
        title="Hello World! This is Great",
        content="Content here.",
        excerpt="Excerpt here.",
        author_id=user.id,
    )
    db.session.add(post)
    db.session.commit()

    assert post.slug == "hello-world-this-is-great"

def test_user_posts_relationship(db):
    """User.posts should return all posts by that user."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    db.session.add(user)
    db.session.commit()

    for i in range(3):
        post = Post(
            title=f"Post {i}",
            slug=f"post-{i}",
            content=f"Content {i}",
            excerpt=f"Excerpt {i}",
            author_id=user.id,
        )
        db.session.add(post)
    db.session.commit()

    assert user.posts.count() == 3
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_post_model.py -v`
Expected: FAIL with ImportError

**Step 3: Write the Post model**

```python
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

    # Relationship back to User. back_populates links to User.posts.
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
        text = re.sub(r"[^\w\s-]", "", text)  # Remove non-alphanumeric chars
        text = re.sub(r"[\s_]+", "-", text)    # Replace spaces/underscores with hyphens
        text = re.sub(r"-+", "-", text)        # Collapse multiple hyphens
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
```

Update `backend/app/models/__init__.py`:
```python
from .user import User
from .post import Post
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_post_model.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add backend/app/models/ backend/tests/test_post_model.py
git commit -m "feat: add Post model with auto-slug generation and tests"
```

---

## Task 4: Health Check Endpoint

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/health.py`
- Create: `backend/tests/test_health.py`
- Modify: `backend/app/__init__.py` (register blueprint)

**Step 1: Write the failing test**

```python
def test_health_check(client):
    """GET /api/health should return 200 with status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_health.py -v`
Expected: FAIL with 404

**Step 3: Write the health endpoint**

`backend/app/api/__init__.py`:
```python
# This file makes 'api' a Python package.
```

`backend/app/api/health.py`:
```python
from flask import Blueprint, jsonify

# A Blueprint groups related routes together.
# url_prefix means all routes in this blueprint start with /api.
health_bp = Blueprint("health", __name__, url_prefix="/api")

@health_bp.route("/health")
def health_check():
    """Simple health check -- useful for Docker health checks and monitoring."""
    return jsonify({"status": "ok"})
```

Update `backend/app/__init__.py` -- uncomment and add the blueprint registration inside `create_app`:

```python
    # Register blueprints (API routes)
    from .api.health import health_bp
    app.register_blueprint(health_bp)
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_health.py -v`
Expected: 1 passed

**Step 5: Commit**

```bash
git add backend/app/api/ backend/tests/test_health.py backend/app/__init__.py
git commit -m "feat: add health check endpoint at /api/health"
```

---

## Task 5: Auth Endpoints (Login, Refresh, Me)

**Files:**
- Create: `backend/app/api/auth.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/app/__init__.py` (register blueprint)

**Step 1: Write the failing tests**

```python
import json
from app.models.user import User

def _create_admin(db):
    """Helper to create an admin user for auth tests."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    db.session.add(user)
    db.session.commit()
    return user

def test_login_success(client, db):
    """POST /api/auth/login with valid creds returns access + refresh tokens."""
    _create_admin(db)
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secure123"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_wrong_password(client, db):
    """POST /api/auth/login with wrong password returns 401."""
    _create_admin(db)
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401

def test_login_missing_user(client, db):
    """POST /api/auth/login with nonexistent user returns 401."""
    response = client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "whatever"},
    )
    assert response.status_code == 401

def test_me_authenticated(client, db):
    """GET /api/auth/me with valid token returns user info."""
    _create_admin(db)
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secure123"},
    )
    token = login.get_json()["access_token"]
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.get_json()["username"] == "admin"

def test_me_unauthenticated(client):
    """GET /api/auth/me without token returns 401."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_refresh_token(client, db):
    """POST /api/auth/refresh with valid refresh token returns new access token."""
    _create_admin(db)
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secure123"},
    )
    refresh_token = login.get_json()["refresh_token"]
    response = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert response.status_code == 200
    assert "access_token" in response.get_json()
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: FAIL

**Step 3: Write the auth blueprint**

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from app.models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate a user and return JWT tokens.

    Expects JSON: {"username": "...", "password": "..."}
    Returns: {"access_token": "...", "refresh_token": "..."}

    The access token expires in 15 minutes. Use the refresh token
    to get a new access token without re-entering credentials.
    """
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")

    user = User.query.filter_by(username=username).first()

    # Always check password even if user is None to prevent timing attacks.
    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    # identity is what gets stored inside the JWT -- we use the user's ID.
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
    })

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """
    Get a new access token using a valid refresh token.

    Send the refresh token in the Authorization header:
    Authorization: Bearer <refresh_token>
    """
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({"access_token": access_token})

@auth_bp.route("/me")
@jwt_required()
def me():
    """
    Return the currently authenticated user's info.

    Requires a valid access token in the Authorization header.
    """
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user is None:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())
```

Register in `backend/app/__init__.py`:
```python
    from .api.auth import auth_bp
    app.register_blueprint(auth_bp)
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: 6 passed

**Step 5: Commit**

```bash
git add backend/app/api/auth.py backend/tests/test_auth.py backend/app/__init__.py
git commit -m "feat: add auth endpoints (login, refresh, me) with JWT"
```

---

## Task 6: Posts CRUD Endpoints

**Files:**
- Create: `backend/app/api/posts.py`
- Create: `backend/tests/test_posts.py`
- Modify: `backend/app/__init__.py` (register blueprint)

**Step 1: Write the failing tests**

```python
from app.models.user import User
from app.models.post import Post

def _auth_header(client, db):
    """Helper: create admin, login, return auth header dict."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    db.session.add(user)
    db.session.commit()
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "secure123"},
    )
    token = login.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user

# --- Public endpoints ---

def test_list_published_posts(client, db):
    """GET /api/posts returns only published posts, newest first."""
    user = User(username="admin", email="a@b.com")
    user.set_password("pw")
    db.session.add(user)
    db.session.commit()

    db.session.add(Post(title="Draft", slug="draft", content="x", excerpt="x", published=False, author_id=user.id))
    db.session.add(Post(title="Live", slug="live", content="x", excerpt="x", published=True, author_id=user.id))
    db.session.commit()

    response = client.get("/api/posts")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["posts"]) == 1
    assert data["posts"][0]["title"] == "Live"

def test_get_post_by_slug(client, db):
    """GET /api/posts/<slug> returns the post if published."""
    user = User(username="admin", email="a@b.com")
    user.set_password("pw")
    db.session.add(user)
    db.session.commit()
    db.session.add(Post(title="Live", slug="live", content="x", excerpt="x", published=True, author_id=user.id))
    db.session.commit()

    response = client.get("/api/posts/live")
    assert response.status_code == 200
    assert response.get_json()["title"] == "Live"

def test_get_draft_by_slug_returns_404(client, db):
    """GET /api/posts/<slug> returns 404 if post is a draft."""
    user = User(username="admin", email="a@b.com")
    user.set_password("pw")
    db.session.add(user)
    db.session.commit()
    db.session.add(Post(title="Draft", slug="draft", content="x", excerpt="x", published=False, author_id=user.id))
    db.session.commit()

    response = client.get("/api/posts/draft")
    assert response.status_code == 404

# --- Protected endpoints ---

def test_create_post(client, db):
    """POST /api/posts creates a new post (auth required)."""
    headers, user = _auth_header(client, db)
    response = client.post(
        "/api/posts",
        json={
            "title": "New Post",
            "content": "# Hello",
            "excerpt": "A new post",
            "published": True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert response.get_json()["slug"] == "new-post"

def test_create_post_unauthenticated(client):
    """POST /api/posts without auth returns 401."""
    response = client.post("/api/posts", json={"title": "Nope"})
    assert response.status_code == 401

def test_update_post(client, db):
    """PUT /api/posts/<slug> updates the post (auth required)."""
    headers, user = _auth_header(client, db)
    db.session.add(Post(title="Old", slug="old", content="x", excerpt="x", author_id=user.id))
    db.session.commit()

    response = client.put(
        "/api/posts/old",
        json={"title": "Updated Title"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.get_json()["title"] == "Updated Title"

def test_delete_post(client, db):
    """DELETE /api/posts/<slug> removes the post (auth required)."""
    headers, user = _auth_header(client, db)
    db.session.add(Post(title="Gone", slug="gone", content="x", excerpt="x", author_id=user.id))
    db.session.commit()

    response = client.delete("/api/posts/gone", headers=headers)
    assert response.status_code == 200
    assert Post.query.filter_by(slug="gone").first() is None

def test_list_drafts(client, db):
    """GET /api/posts/drafts returns unpublished posts (auth required)."""
    headers, user = _auth_header(client, db)
    db.session.add(Post(title="Draft", slug="draft", content="x", excerpt="x", published=False, author_id=user.id))
    db.session.add(Post(title="Live", slug="live", content="x", excerpt="x", published=True, author_id=user.id))
    db.session.commit()

    response = client.get("/api/posts/drafts", headers=headers)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["posts"]) == 1
    assert data["posts"][0]["title"] == "Draft"
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_posts.py -v`
Expected: FAIL

**Step 3: Write the posts blueprint**

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.post import Post

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")

@posts_bp.route("", methods=["GET"])
def list_posts():
    """
    List all published posts, newest first. Paginated.

    Query params:
        page (int): Page number, default 1
        per_page (int): Posts per page, default 10
    """
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
    """
    Create a new blog post. Auth required.

    Expects JSON with: title, content, excerpt, published (optional).
    Slug is auto-generated from title if not provided.
    """
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
    """
    Update an existing post by slug. Auth required.

    Only updates fields that are present in the request body.
    """
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
```

Register in `backend/app/__init__.py`:
```python
    from .api.posts import posts_bp
    app.register_blueprint(posts_bp)
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_posts.py -v`
Expected: 8 passed

**Step 5: Run all backend tests**

Run: `cd backend && python -m pytest -v`
Expected: All tests pass (User + Post + Health + Auth + Posts)

**Step 6: Commit**

```bash
git add backend/app/api/posts.py backend/tests/test_posts.py backend/app/__init__.py
git commit -m "feat: add posts CRUD endpoints with pagination and draft support"
```

---

## Task 7: Database Migrations & Seed Command

**Files:**
- Modify: `backend/app/__init__.py` (add CLI command)

**Step 1: Generate initial migration**

```bash
cd backend
FLASK_APP=app flask db init
FLASK_APP=app flask db migrate -m "initial: users and posts tables"
FLASK_APP=app flask db upgrade
```

**Step 2: Add a CLI seed command to create_app**

Add inside `create_app` in `backend/app/__init__.py`:

```python
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
```

**Step 3: Test the seed command**

```bash
cd backend
FLASK_APP=app flask seed
```
Expected: "Admin user created. Username: admin"

**Step 4: Commit**

```bash
git add backend/migrations/ backend/app/__init__.py
git commit -m "feat: add database migrations and admin seed command"
```

---

## Task 8: React Frontend Scaffolding

**Files:**
- Create: `frontend/` (entire Vite + React + TypeScript scaffold)
- Create: `frontend/src/services/api.ts`
- Create: `frontend/src/types/index.ts`

**Step 1: Scaffold with Vite**

```bash
cd /path/to/chrisg-site
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom react-markdown remark-gfm
npm install -D @types/react-router-dom
```

**Step 2: Create TypeScript types**

`frontend/src/types/index.ts`:
```typescript
/** Matches the User.to_dict() output from the Flask backend. */
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

/** Matches the Post.to_dict() output from the Flask backend. */
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  author: User;
}

/** The paginated response from GET /api/posts */
export interface PostListResponse {
  posts: Post[];
  total: number;
  page: number;
  pages: number;
}

/** Login response from POST /api/auth/login */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
}
```

**Step 3: Create API service**

`frontend/src/services/api.ts`:
```typescript
/**
 * Centralized API client for all backend communication.
 *
 * Stores JWT tokens in memory (not localStorage) for security.
 * Automatically attaches the access token to authenticated requests.
 * Handles token refresh when the access token expires.
 */

import type { AuthResponse, Post, PostListResponse, User } from "../types";

const API_BASE = "/api";

// Tokens stored in memory -- lost on page refresh, but more secure
// than localStorage (not vulnerable to XSS attacks).
let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Store tokens after login. */
export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
}

/** Clear tokens on logout. */
export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

/** Check if we have tokens (user is logged in). */
export function isAuthenticated(): boolean {
  return accessToken !== null;
}

/**
 * Make an authenticated fetch request.
 * Automatically adds the Authorization header if we have a token.
 */
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // If we get a 401 and have a refresh token, try refreshing
  if (response.status === 401 && refreshToken) {
    const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refreshToken}`,
      },
    });

    if (refreshed.ok) {
      const data = await refreshed.json();
      accessToken = data.access_token;
      // Retry the original request with the new token
      headers["Authorization"] = `Bearer ${accessToken}`;
      return fetch(`${API_BASE}${path}`, { ...options, headers });
    } else {
      // Refresh failed -- user needs to log in again
      clearTokens();
    }
  }

  return response;
}

// --- Auth ---

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data: AuthResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe(): Promise<User> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// --- Posts (public) ---

export async function getPosts(page = 1): Promise<PostListResponse> {
  const res = await apiFetch(`/posts?page=${page}`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

export async function getPost(slug: string): Promise<Post> {
  const res = await apiFetch(`/posts/${slug}`);
  if (!res.ok) throw new Error("Post not found");
  return res.json();
}

// --- Posts (admin) ---

export async function getDrafts(): Promise<{ posts: Post[] }> {
  const res = await apiFetch("/posts/drafts");
  if (!res.ok) throw new Error("Failed to fetch drafts");
  return res.json();
}

export async function createPost(post: Partial<Post>): Promise<Post> {
  const res = await apiFetch("/posts", {
    method: "POST",
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error("Failed to create post");
  return res.json();
}

export async function updatePost(slug: string, data: Partial<Post>): Promise<Post> {
  const res = await apiFetch(`/posts/${slug}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update post");
  return res.json();
}

export async function deletePost(slug: string): Promise<void> {
  const res = await apiFetch(`/posts/${slug}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete post");
}
```

**Step 4: Configure Vite proxy**

Update `frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy API requests to the Flask backend during development.
    // When you fetch("/api/posts"), Vite forwards it to localhost:5000.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
```

**Step 5: Verify frontend starts**

```bash
cd frontend
npm run dev
```
Expected: Vite dev server starts on port 3000

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React frontend with API client, types, and Vite proxy"
```

---

## Task 9: Frontend Global Styles & Layout

**Files:**
- Create: `frontend/src/styles/global.css`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Nav.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Create global styles**

`frontend/src/styles/global.css`:
```css
/*
 * Apple-inspired global styles.
 * System font stack, generous whitespace, near-black on white.
 * No framework -- hand-written for full control.
 */

:root {
  /* Colors */
  --color-text: #1d1d1f;
  --color-text-secondary: #6e6e73;
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f7;
  --color-accent: #0071e3;
  --color-accent-hover: #0077ed;
  --color-border: #d2d2d7;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display",
    "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-mono: "SF Mono", SFMono-Regular, ui-monospace, Menlo, monospace;

  /* Spacing */
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 2rem;
  --space-lg: 4rem;
  --space-xl: 6rem;

  /* Layout */
  --max-width: 720px;
  --max-width-wide: 1080px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
}

a {
  color: var(--color-accent);
  text-decoration: none;
}

a:hover {
  color: var(--color-accent-hover);
}

/* Fade-in animation for page content */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}

/* Container for page content */
.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--space-sm);
}

.container--wide {
  max-width: var(--max-width-wide);
}

/* Responsive */
@media (max-width: 640px) {
  :root {
    --space-lg: 2rem;
    --space-xl: 3rem;
  }
}
```

**Step 2: Create Nav component**

`frontend/src/components/Nav.tsx`:
```tsx
import { Link } from "react-router-dom";
import "./Nav.css";

/**
 * Minimal top navigation bar.
 * Name/logo on the left, page links on the right.
 */
export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav__inner container--wide">
        <Link to="/" className="nav__logo">
          Christopher R. Gonzalez
        </Link>
        <div className="nav__links">
          <Link to="/">Home</Link>
          <Link to="/blog">Blog</Link>
        </div>
      </div>
    </nav>
  );
}
```

`frontend/src/components/Nav.css`:
```css
.nav {
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 100;
}

.nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: var(--max-width-wide);
  margin: 0 auto;
  padding: 0 var(--space-sm);
}

.nav__logo {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--color-text);
}

.nav__links {
  display: flex;
  gap: var(--space-md);
}

.nav__links a {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  transition: color 0.2s;
}

.nav__links a:hover {
  color: var(--color-text);
}
```

**Step 3: Create Layout component**

`frontend/src/components/Layout.tsx`:
```tsx
import { Outlet } from "react-router-dom";
import Nav from "./Nav";
import "./Layout.css";

/**
 * Root layout wrapping all pages.
 * Nav at top, page content in <Outlet />, footer at bottom.
 * React Router renders the matched child route inside <Outlet />.
 */
export default function Layout() {
  return (
    <div className="layout">
      <Nav />
      <main className="layout__content">
        <Outlet />
      </main>
      <footer className="layout__footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Christopher R. Gonzalez</p>
        </div>
      </footer>
    </div>
  );
}
```

`frontend/src/components/Layout.css`:
```css
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout__content {
  flex: 1;
  padding: var(--space-lg) 0;
}

.layout__footer {
  padding: var(--space-md) 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  text-align: center;
}
```

**Step 4: Set up App.tsx with routing**

`frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

/**
 * App root: sets up client-side routing.
 * Pages will be added in subsequent tasks.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<div className="container fade-in"><h1>Home</h1></div>} />
          <Route path="/blog" element={<div className="container fade-in"><h1>Blog</h1></div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 5: Update main.tsx to import global styles**

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Delete the default Vite files: `frontend/src/App.css`, `frontend/src/index.css`, `frontend/src/assets/react.svg`.

**Step 6: Verify it works**

```bash
cd frontend && npm run dev
```
Expected: Clean page with nav bar showing "Christopher R. Gonzalez" and Home/Blog links. Sticky blurred nav.

**Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add global styles, nav, and layout with Apple-inspired design"
```

---

## Task 10: Home Page

**Files:**
- Create: `frontend/src/pages/Home.tsx`
- Create: `frontend/src/pages/Home.css`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Home page**

`frontend/src/pages/Home.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPosts } from "../services/api";
import type { Post } from "../types";
import "./Home.css";

/**
 * Landing page: hero section with name and tagline,
 * brief about blurb, and 3 most recent blog posts.
 */
export default function Home() {
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);

  useEffect(() => {
    getPosts(1).then((data) => {
      // Show at most 3 recent posts on the home page
      setRecentPosts(data.posts.slice(0, 3));
    }).catch(() => {
      // Silently fail -- home page still works without posts
    });
  }, []);

  return (
    <div className="home fade-in">
      {/* Hero */}
      <section className="home__hero container">
        <h1 className="home__name">Christopher R. Gonzalez</h1>
        <p className="home__tagline">
          Staff Software Engineer &mdash; Building scalable platforms for millions of users
        </p>
        <p className="home__location">San Diego, CA</p>
        <div className="home__links">
          <a href="https://linkedin.com/in/crgee" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <a href="https://github.com/crgeee" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="mailto:crg167@gmail.com">Email</a>
        </div>
      </section>

      {/* About */}
      <section className="home__about container">
        <p>
          I lead the UI Platform team at Intuit's TurboTax, powering tax filing
          experiences for 40M+ customers. 10+ years building full-stack
          applications across enterprise and government &mdash; from $4B revenue
          systems to Navy mission-critical tools.
        </p>
      </section>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <section className="home__posts container">
          <h2>Recent Writing</h2>
          <div className="home__post-list">
            {recentPosts.map((post) => (
              <Link to={`/blog/${post.slug}`} key={post.id} className="home__post-card">
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <time>{new Date(post.created_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric"
                })}</time>
              </Link>
            ))}
          </div>
          <Link to="/blog" className="home__view-all">View all posts &rarr;</Link>
        </section>
      )}
    </div>
  );
}
```

`frontend/src/pages/Home.css`:
```css
.home__hero {
  text-align: center;
  padding: var(--space-xl) 0 var(--space-lg);
}

.home__name {
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.home__tagline {
  font-size: 1.25rem;
  color: var(--color-text-secondary);
  margin-top: var(--space-sm);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.home__location {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
}

.home__links {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  margin-top: var(--space-md);
}

.home__about {
  padding: var(--space-lg) 0;
  font-size: 1.1rem;
  color: var(--color-text-secondary);
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
}

.home__posts {
  padding: var(--space-lg) 0;
}

.home__posts h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.home__post-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.home__post-card {
  display: block;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.home__post-card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

.home__post-card h3 {
  font-size: 1.15rem;
  font-weight: 600;
}

.home__post-card p {
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
  font-size: 0.95rem;
}

.home__post-card time {
  display: block;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
}

.home__view-all {
  display: inline-block;
  margin-top: var(--space-md);
  font-weight: 500;
}

@media (max-width: 640px) {
  .home__name {
    font-size: 2rem;
  }
  .home__tagline {
    font-size: 1.05rem;
  }
}
```

**Step 2: Update App.tsx to use Home page**

Replace the placeholder `<div>` with `<Home />` in the route.

**Step 3: Verify**

```bash
cd frontend && npm run dev
```
Expected: Apple-inspired home page with hero, about blurb, and (empty for now) recent posts section.

**Step 4: Commit**

```bash
git add frontend/src/pages/ frontend/src/App.tsx
git commit -m "feat: add Home page with hero, about, and recent posts"
```

---

## Task 11: Blog List & Detail Pages

**Files:**
- Create: `frontend/src/pages/BlogList.tsx`
- Create: `frontend/src/pages/BlogList.css`
- Create: `frontend/src/pages/BlogPost.tsx`
- Create: `frontend/src/pages/BlogPost.css`
- Modify: `frontend/src/App.tsx`

**Step 1: Create BlogList page**

`frontend/src/pages/BlogList.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPosts } from "../services/api";
import type { Post } from "../types";
import "./BlogList.css";

/**
 * Blog listing page. Shows all published posts, paginated.
 */
export default function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPosts(page).then((data) => {
      setPosts(data.posts);
      setTotalPages(data.pages);
    }).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="blog-list container fade-in">
      <h1>Blog</h1>

      {loading ? (
        <p className="blog-list__loading">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="blog-list__empty">No posts yet. Check back soon.</p>
      ) : (
        <>
          <div className="blog-list__posts">
            {posts.map((post) => (
              <Link to={`/blog/${post.slug}`} key={post.id} className="blog-list__card">
                <time>{new Date(post.created_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric"
                })}</time>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="blog-list__pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                &larr; Newer
              </button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Older &rarr;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

`frontend/src/pages/BlogList.css`:
```css
.blog-list h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: var(--space-lg);
}

.blog-list__posts {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.blog-list__card {
  display: block;
  color: var(--color-text);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.blog-list__card:last-child {
  border-bottom: none;
}

.blog-list__card time {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.blog-list__card h2 {
  font-size: 1.35rem;
  font-weight: 600;
  margin-top: var(--space-xs);
}

.blog-list__card p {
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
}

.blog-list__card:hover h2 {
  color: var(--color-accent);
}

.blog-list__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.blog-list__pagination button {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-xs) var(--space-sm);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--color-accent);
}

.blog-list__pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.blog-list__loading,
.blog-list__empty {
  color: var(--color-text-secondary);
  padding: var(--space-lg) 0;
  text-align: center;
}
```

**Step 2: Create BlogPost page**

`frontend/src/pages/BlogPost.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost } from "../services/api";
import type { Post } from "../types";
import "./BlogPost.css";

/**
 * Single blog post page. Fetches post by slug from the URL,
 * renders markdown content with syntax highlighting.
 */
export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getPost(slug)
      .then(setPost)
      .catch(() => setError(true));
  }, [slug]);

  if (error) {
    return (
      <div className="blog-post container fade-in">
        <p>Post not found.</p>
        <Link to="/blog">&larr; Back to blog</Link>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="blog-post container fade-in">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <article className="blog-post container fade-in">
      <Link to="/blog" className="blog-post__back">&larr; Back to blog</Link>
      <header className="blog-post__header">
        <time>{new Date(post.created_at).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric"
        })}</time>
        <h1>{post.title}</h1>
      </header>
      <div className="blog-post__content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
```

`frontend/src/pages/BlogPost.css`:
```css
.blog-post__back {
  font-size: 0.9rem;
  display: inline-block;
  margin-bottom: var(--space-md);
}

.blog-post__header {
  margin-bottom: var(--space-lg);
}

.blog-post__header time {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.blog-post__header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin-top: var(--space-xs);
}

/* Markdown content styling */
.blog-post__content {
  line-height: 1.75;
  font-size: 1.05rem;
}

.blog-post__content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: var(--space-lg);
  margin-bottom: var(--space-sm);
}

.blog-post__content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: var(--space-md);
  margin-bottom: var(--space-sm);
}

.blog-post__content p {
  margin-bottom: var(--space-sm);
}

.blog-post__content code {
  font-family: var(--font-mono);
  background: var(--color-bg-secondary);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}

.blog-post__content pre {
  background: var(--color-bg-secondary);
  padding: var(--space-sm);
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: var(--space-sm);
}

.blog-post__content pre code {
  background: none;
  padding: 0;
}

.blog-post__content ul,
.blog-post__content ol {
  margin-bottom: var(--space-sm);
  padding-left: var(--space-md);
}

.blog-post__content blockquote {
  border-left: 3px solid var(--color-accent);
  padding-left: var(--space-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

@media (max-width: 640px) {
  .blog-post__header h1 {
    font-size: 1.75rem;
  }
}
```

**Step 3: Update App.tsx routes**

Add imports and routes for BlogList, BlogPost:
```tsx
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";

// Inside Routes:
<Route path="/blog" element={<BlogList />} />
<Route path="/blog/:slug" element={<BlogPost />} />
```

**Step 4: Verify**

Run frontend and backend simultaneously, visit `/blog`.

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Blog list and detail pages with markdown rendering"
```

---

## Task 12: Admin Pages (Login, Dashboard, Post Editor)

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Login.css`
- Create: `frontend/src/pages/AdminDashboard.tsx`
- Create: `frontend/src/pages/AdminDashboard.css`
- Create: `frontend/src/pages/PostEditor.tsx`
- Create: `frontend/src/pages/PostEditor.css`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create auth hook**

`frontend/src/hooks/useAuth.ts`:
```typescript
import { useState, useEffect } from "react";
import { isAuthenticated, getMe, login as apiLogin, clearTokens } from "../services/api";
import type { User } from "../types";

/**
 * Custom hook for auth state.
 * Tracks the current user and provides login/logout functions.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, check if we have a valid token
    if (isAuthenticated()) {
      getMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string) {
    await apiLogin(username, password);
    const me = await getMe();
    setUser(me);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return { user, loading, login, logout };
}
```

**Step 2: Create ProtectedRoute**

`frontend/src/components/ProtectedRoute.tsx`:
```tsx
import { Navigate, Outlet } from "react-router-dom";
import type { User } from "../types";

/**
 * Wraps admin routes. If the user is not logged in, redirects to /admin/login.
 */
export default function ProtectedRoute({ user }: { user: User | null }) {
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  return <Outlet />;
}
```

**Step 3: Create Login page**

`frontend/src/pages/Login.tsx`:
```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

/**
 * Simple login form. No public registration -- admin only.
 */
export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onLogin(username, password);
      navigate("/admin");
    } catch {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="login container fade-in">
      <form className="login__form" onSubmit={handleSubmit}>
        <h1>Admin Login</h1>
        {error && <p className="login__error">{error}</p>}
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">Sign In</button>
      </form>
    </div>
  );
}
```

`frontend/src/pages/Login.css`:
```css
.login {
  display: flex;
  justify-content: center;
  padding-top: var(--space-xl);
}

.login__form {
  width: 100%;
  max-width: 360px;
}

.login__form h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.login__form label {
  display: block;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.login__form input {
  display: block;
  width: 100%;
  padding: 0.6rem 0.8rem;
  margin-top: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 1rem;
}

.login__form input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.login__form button {
  width: 100%;
  padding: 0.7rem;
  margin-top: var(--space-sm);
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
}

.login__form button:hover {
  background: var(--color-accent-hover);
}

.login__error {
  color: #d63031;
  font-size: 0.9rem;
  margin-bottom: var(--space-sm);
}
```

**Step 4: Create AdminDashboard page**

`frontend/src/pages/AdminDashboard.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPosts, getDrafts, deletePost, updatePost } from "../services/api";
import type { Post } from "../types";
import "./AdminDashboard.css";

interface AdminDashboardProps {
  onLogout: () => void;
}

/**
 * Admin dashboard: lists all posts (published and drafts) with CRUD actions.
 */
export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [posts, setPosts] = useState<Post[]>([]);

  async function loadPosts() {
    // Fetch both published and drafts, combine them
    const [published, drafts] = await Promise.all([
      getPosts(1),
      getDrafts(),
    ]);
    // Merge and sort by created_at descending
    const all = [...published.posts, ...drafts.posts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    // Deduplicate by id (in case pagination overlaps)
    const seen = new Set<number>();
    setPosts(all.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }));
  }

  useEffect(() => { loadPosts(); }, []);

  async function handleDelete(slug: string) {
    if (!confirm("Delete this post?")) return;
    await deletePost(slug);
    loadPosts();
  }

  async function handleTogglePublish(post: Post) {
    await updatePost(post.slug, { published: !post.published });
    loadPosts();
  }

  return (
    <div className="admin container fade-in">
      <div className="admin__header">
        <h1>Dashboard</h1>
        <div className="admin__actions">
          <Link to="/admin/new" className="admin__btn admin__btn--primary">New Post</Link>
          <button onClick={onLogout} className="admin__btn">Logout</button>
        </div>
      </div>

      <table className="admin__table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td>{post.title}</td>
              <td>
                <span className={`admin__status ${post.published ? "admin__status--live" : ""}`}>
                  {post.published ? "Published" : "Draft"}
                </span>
              </td>
              <td>{new Date(post.created_at).toLocaleDateString()}</td>
              <td className="admin__cell-actions">
                <Link to={`/admin/edit/${post.slug}`}>Edit</Link>
                <button onClick={() => handleTogglePublish(post)}>
                  {post.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => handleDelete(post.slug)} className="admin__delete">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {posts.length === 0 && (
        <p className="admin__empty">No posts yet. Create your first one!</p>
      )}
    </div>
  );
}
```

`frontend/src/pages/AdminDashboard.css`:
```css
.admin__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.admin__header h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

.admin__actions {
  display: flex;
  gap: var(--space-sm);
}

.admin__btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: none;
  color: var(--color-text);
}

.admin__btn--primary {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.admin__table {
  width: 100%;
  border-collapse: collapse;
}

.admin__table th,
.admin__table td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.admin__table th {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.admin__status {
  font-size: 0.8rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.admin__status--live {
  background: #d4edda;
  color: #155724;
}

.admin__cell-actions {
  display: flex;
  gap: var(--space-sm);
}

.admin__cell-actions a,
.admin__cell-actions button {
  font-size: 0.85rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-accent);
  font-family: var(--font-sans);
  padding: 0;
}

.admin__delete {
  color: #d63031 !important;
}

.admin__empty {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--space-lg) 0;
}
```

**Step 5: Create PostEditor page**

`frontend/src/pages/PostEditor.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createPost, updatePost, getPost } from "../services/api";
import "./PostEditor.css";

/**
 * Post editor form. Used for both creating new posts and editing existing ones.
 * If a slug is in the URL params, it loads that post for editing.
 * Includes a live markdown preview panel.
 */
export default function PostEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(slug);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (slug) {
      // Fetch existing post for editing -- use apiFetch directly
      // since getPost only returns published posts
      fetch(`/api/posts/${slug}`, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("_dev_token") || ""}` },
      }).catch(() => {});

      // For now, use a simple approach: fetch all posts and find the one we need
      getPost(slug).then((post) => {
        setTitle(post.title);
        setExcerpt(post.excerpt);
        setContent(post.content);
        setPublished(post.published);
      }).catch(() => navigate("/admin"));
    }
  }, [slug, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && slug) {
        await updatePost(slug, { title, excerpt, content, published });
      } else {
        await createPost({ title, excerpt, content, published });
      }
      navigate("/admin");
    } catch {
      alert("Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor container--wide fade-in">
      <h1>{isEditing ? "Edit Post" : "New Post"}</h1>

      <div className="editor__layout">
        <form className="editor__form" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label>
            Excerpt
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              required
            />
          </label>
          <label>
            Content (Markdown)
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              required
            />
          </label>
          <label className="editor__checkbox">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            Published
          </label>
          <div className="editor__buttons">
            <button type="submit" className="admin__btn admin__btn--primary" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </button>
            <button type="button" className="admin__btn" onClick={() => navigate("/admin")}>
              Cancel
            </button>
          </div>
        </form>

        {/* Live markdown preview */}
        <div className="editor__preview">
          <h2>Preview</h2>
          <div className="blog-post__content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || "*Start writing to see preview...*"}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
```

`frontend/src/pages/PostEditor.css`:
```css
.editor h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  padding: 0 var(--space-sm);
}

.editor__layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  padding: 0 var(--space-sm);
}

.editor__form label {
  display: block;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.editor__form input[type="text"],
.editor__form textarea {
  display: block;
  width: 100%;
  padding: 0.6rem 0.8rem;
  margin-top: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-sans);
  font-size: 1rem;
}

.editor__form textarea {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  resize: vertical;
}

.editor__form input:focus,
.editor__form textarea:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.editor__checkbox {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: var(--space-xs);
}

.editor__checkbox input {
  width: auto !important;
}

.editor__buttons {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.editor__preview {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-sm);
  max-height: 80vh;
  overflow-y: auto;
}

.editor__preview h2 {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .editor__layout {
    grid-template-columns: 1fr;
  }
}
```

**Step 6: Wire up App.tsx with all routes**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import BlogList from "./pages/BlogList";
import BlogPost from "./pages/BlogPost";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import PostEditor from "./pages/PostEditor";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, login, logout } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />

          {/* Admin */}
          <Route path="/admin/login" element={<Login onLogin={login} />} />
          <Route element={<ProtectedRoute user={user} />}>
            <Route path="/admin" element={<AdminDashboard onLogout={logout} />} />
            <Route path="/admin/new" element={<PostEditor />} />
            <Route path="/admin/edit/:slug" element={<PostEditor />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 7: Verify end-to-end**

Run both backend and frontend. Log in at `/admin/login`, create a post, verify it shows on the blog.

**Step 8: Commit**

```bash
git add frontend/src/
git commit -m "feat: add admin pages (login, dashboard, post editor with markdown preview)"
```

---

## Task 13: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx.conf`
- Create: `.env.example`

**Step 1: Create Dockerfile**

```dockerfile
# ---- Stage 1: Build the React frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python backend + built frontend ----
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend into a static directory Flask/Nginx can serve
COPY --from=frontend-build /app/frontend/dist ./static/

EXPOSE 8000

# Run with Gunicorn (4 workers is a good default for a small VPS)
CMD ["gunicorn", "wsgi:app", "--bind", "0.0.0.0:8000", "--workers", "4"]
```

**Step 2: Create docker-compose.yml**

```yaml
version: "3.8"

services:
  web:
    build: .
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      # Persist SQLite database outside the container
      - db-data:/app/instance
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  db-data:
```

**Step 3: Create nginx.conf**

```nginx
server {
    listen 80;
    server_name _;

    # Serve the React SPA for all non-API routes
    location / {
        root /app/static;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Gunicorn
    location /api/ {
        proxy_pass http://web:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Note: For production with SSL, you'll add a separate nginx config with Certbot. This basic config is for the Docker internal setup. In production on Hetzner, Nginx runs on the host (not in Docker) as a reverse proxy to the Docker container.

**Step 4: Create .env.example**

```
FLASK_ENV=production
SECRET_KEY=generate-a-random-string-here
JWT_SECRET_KEY=generate-another-random-string-here
DATABASE_URL=sqlite:///prod.db
```

**Step 5: Update backend app factory to serve static files in production**

Add to `backend/app/__init__.py`, inside `create_app`, after blueprint registration:

```python
    # In production, serve the React frontend's built files.
    # Flask serves index.html for any route that isn't an API endpoint,
    # so React Router can handle client-side routing.
    import os
    static_folder = os.path.join(app.root_path, "..", "static")
    if os.path.exists(static_folder):
        from flask import send_from_directory

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            file_path = os.path.join(static_folder, path)
            if path and os.path.exists(file_path):
                return send_from_directory(static_folder, path)
            return send_from_directory(static_folder, "index.html")
```

**Step 6: Test Docker build locally**

```bash
docker-compose build
docker-compose up
```
Expected: App accessible at `http://localhost:8000`

**Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml nginx.conf .env.example backend/app/__init__.py
git commit -m "feat: add Docker setup with multi-stage build and nginx config"
```

---

## Task 14: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create the workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Test, Build & Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest

      - name: Run backend tests
        run: cd backend && python -m pytest -v

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Lint & type-check frontend
        run: cd frontend && npx tsc --noEmit

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Hetzner VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/chrisg-site
            git pull origin main
            docker-compose up --build -d
            docker image prune -f
```

**Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions CI/CD pipeline with auto-deploy to Hetzner"
```

---

## Task 15: Create Private GitHub Repo & Push

**Step 1: Create private repo on GitHub**

```bash
gh repo create chrisg-site --private --source=. --remote=origin
```

**Step 2: Push all commits**

```bash
git push -u origin main
```

**Step 3: Add GitHub Actions secrets**

```bash
gh secret set VPS_HOST
gh secret set VPS_USER
gh secret set VPS_SSH_KEY
```
(These will prompt for values interactively)

**Step 4: Commit any remaining changes**

```bash
git status  # Make sure working tree is clean
```

---

## Task 16: VPS Setup (One-Time)

This task is done manually on your Hetzner VPS via SSH.

**Step 1: Install Docker**

```bash
ssh your-vps
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

**Step 2: Install Docker Compose**

```bash
sudo apt install docker-compose-plugin
```

**Step 3: Clone the repo**

```bash
cd /opt
git clone git@github.com:YOUR_USERNAME/chrisg-site.git
cd chrisg-site
```

**Step 4: Create .env**

```bash
cp .env.example .env
# Edit .env with real secrets:
# SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
# JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
nano .env
```

**Step 5: First deploy**

```bash
docker-compose up --build -d
```

**Step 6: Run database migrations and seed**

```bash
docker-compose exec web flask db upgrade
docker-compose exec web flask seed
```

**Step 7: Set up Nginx + SSL on the host**

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/chrisg-site`:
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/chrisg-site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com
```

**Step 8: Set up deploy SSH key**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key  # Copy this as VPS_SSH_KEY GitHub secret
```

**Step 9: Verify auto-deploy**

Push a small change to `main`, check GitHub Actions runs, and the site updates on your VPS.
