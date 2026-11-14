"""UniFix – Campus Maintenance Request System (Flask REST API).

create_app() is the application factory used by gunicorn (wsgi.py) and tests.
"""
import os

import yaml
from flasgger import Swagger
from flask import Flask, jsonify
from sqlalchemy import text
from werkzeug.exceptions import HTTPException

from .config import Config
from .extensions import bcrypt, cors, db, jwt
from .models import TokenBlocklist, User
from .utils import APIError


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ---- extensions ----
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    origins = app.config["CORS_ORIGINS"]
    cors.init_app(app, resources={r"/api/*": {"origins": origins.split(",") if origins != "*" else "*"}},
                  expose_headers=["Content-Disposition"])

    # ---- API documentation (Swagger UI at /api/docs) ----
    spec_path = os.path.join(os.path.dirname(__file__), "openapi.yaml")
    with open(spec_path, encoding="utf-8") as f:
        spec = yaml.safe_load(f)
    app.config["SWAGGER"] = {"openapi": "3.0.3", "uiversion": 3}
    Swagger(app, template=spec, config={
        "headers": [],
        "specs": [{"endpoint": "openapi", "route": "/api/openapi.json"}],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/api/docs/",
    })

    # ---- JWT session handling ----
    @jwt.user_lookup_loader
    def load_user(_header, payload):
        return db.session.get(User, int(payload["sub"]))

    @jwt.token_in_blocklist_loader
    def is_revoked(_header, payload):
        return db.session.query(TokenBlocklist.id).filter_by(jti=payload["jti"]).first() is not None

    @jwt.user_lookup_error_loader
    def user_missing(_header, _payload):
        return jsonify({"error": "Account no longer exists."}), 401

    @jwt.expired_token_loader
    def expired(_header, _payload):
        return jsonify({"error": "Your session has expired. Please log in again."}), 401

    @jwt.revoked_token_loader
    def revoked(_header, _payload):
        return jsonify({"error": "You have been logged out. Please log in again."}), 401

    @jwt.invalid_token_loader
    def invalid(reason):
        return jsonify({"error": f"Invalid token: {reason}"}), 401

    @jwt.unauthorized_loader
    def missing(reason):
        return jsonify({"error": "Authentication required. Please log in."}), 401

    # ---- consistent JSON error handling ----
    @app.errorhandler(APIError)
    def handle_api_error(err):
        body = {"error": err.message}
        if err.details:
            body["details"] = err.details
        return jsonify(body), err.status

    @app.errorhandler(HTTPException)
    def handle_http(err):
        messages = {404: "Resource not found.", 405: "Method not allowed.",
                    413: "Upload too large. Images must be under 3 MB each."}
        return jsonify({"error": messages.get(err.code, err.description)}), err.code

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        db.session.rollback()
        app.logger.exception(err)
        return jsonify({"error": "Something went wrong on the server. Please try again."}), 500

    # ---- routes ----
    from .routes import auth, categories, notifications, reports, requests, users
    for module in (auth, users, categories, requests, notifications, reports):
        app.register_blueprint(module.bp)

    @app.get("/")
    @app.get("/api/health")
    def health():
        """Health check that proves the API can reach the database."""
        try:
            db.session.execute(text("SELECT 1"))
            database = "connected"
        except Exception as exc:  # pragma: no cover
            database = f"error: {exc.__class__.__name__}"
        return jsonify({"service": "UniFix API", "status": "ok", "database": database,
                        "engine": db.engine.dialect.name, "docs": "/api/docs/"})

    # ---- database setup ----
    from .seed import register_cli, seed_demo
    register_cli(app)
    if app.config["AUTO_SEED"]:
        with app.app_context():
            try:
                db.create_all()
                seed_demo()
            except Exception as exc:  # another gunicorn worker seeded at the same moment
                db.session.rollback()
                app.logger.warning("Start-up seed skipped: %s", exc.__class__.__name__)

    return app
