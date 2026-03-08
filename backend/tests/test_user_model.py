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
