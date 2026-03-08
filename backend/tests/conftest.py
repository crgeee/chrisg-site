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
