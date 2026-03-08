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

def test_list_published_posts(client, db):
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
    user = User(username="admin", email="a@b.com")
    user.set_password("pw")
    db.session.add(user)
    db.session.commit()
    db.session.add(Post(title="Draft", slug="draft", content="x", excerpt="x", published=False, author_id=user.id))
    db.session.commit()

    response = client.get("/api/posts/draft")
    assert response.status_code == 404

def test_create_post(client, db):
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
    response = client.post("/api/posts", json={"title": "Nope"})
    assert response.status_code == 401

def test_update_post(client, db):
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
    headers, user = _auth_header(client, db)
    db.session.add(Post(title="Gone", slug="gone", content="x", excerpt="x", author_id=user.id))
    db.session.commit()

    response = client.delete("/api/posts/gone", headers=headers)
    assert response.status_code == 200
    assert Post.query.filter_by(slug="gone").first() is None

def test_list_drafts(client, db):
    headers, user = _auth_header(client, db)
    db.session.add(Post(title="Draft", slug="draft", content="x", excerpt="x", published=False, author_id=user.id))
    db.session.add(Post(title="Live", slug="live", content="x", excerpt="x", published=True, author_id=user.id))
    db.session.commit()

    response = client.get("/api/posts/drafts", headers=headers)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data["posts"]) == 1
    assert data["posts"][0]["title"] == "Draft"
