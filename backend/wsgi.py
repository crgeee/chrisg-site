from app import create_app

# Gunicorn looks for a variable called 'app' in this module.
# Run with: gunicorn wsgi:app
app = create_app()
