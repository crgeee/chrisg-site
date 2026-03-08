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
