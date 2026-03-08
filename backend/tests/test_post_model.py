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
