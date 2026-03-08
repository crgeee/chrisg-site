from app.models.user import User

def _create_admin(db):
    """Helper to create an admin user for auth tests."""
    user = User(username="admin", email="admin@example.com")
    user.set_password("secure123")
    db.session.add(user)
    db.session.commit()
    return user

def test_login_success(client, db):
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
    _create_admin(db)
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401

def test_login_missing_user(client, db):
    response = client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "whatever"},
    )
    assert response.status_code == 401

def test_me_authenticated(client, db):
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
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_refresh_token(client, db):
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
