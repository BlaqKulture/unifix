"""Entry point for gunicorn (production) and `flask --app wsgi run` (local)."""
from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
