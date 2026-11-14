"""Shared pytest fixtures: a fresh in-memory database per test,
one user per role, and helpers to log in and create requests."""
import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import Category, Role, User
from app.seed import seed_base

PASSWORD = "Password123"


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        seed_base()
        roles = {r.name: r for r in Role.query.all()}
        for email, name, role in [
            ("admin@test.edu", "Admin User", "admin"),
            ("officer@test.edu", "Officer One", "officer"),
            ("officer2@test.edu", "Officer Two", "officer"),
            ("student@test.edu", "Student One", "student"),
            ("student2@test.edu", "Student Two", "student"),
            ("staff@test.edu", "Staff One", "staff"),
        ]:
            u = User(email=email, full_name=name, role=roles[role])
            u.set_password(PASSWORD)
            db.session.add(u)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def login(client, email):
    res = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200, res.json
    return {"Authorization": f"Bearer {res.json['access_token']}"}


@pytest.fixture
def headers(client):
    """headers['admin'], headers['officer'], ... : auth headers per role."""
    return {
        "admin": login(client, "admin@test.edu"),
        "officer": login(client, "officer@test.edu"),
        "officer2": login(client, "officer2@test.edu"),
        "student": login(client, "student@test.edu"),
        "student2": login(client, "student2@test.edu"),
        "staff": login(client, "staff@test.edu"),
    }


@pytest.fixture
def category_id(app):
    with app.app_context():
        return Category.query.filter_by(name="Plumbing").first().id


def user_id(app, email):
    with app.app_context():
        return User.query.filter_by(email=email).first().id


@pytest.fixture
def make_request(client, headers, category_id):
    def _make(who="student", **overrides):
        body = {"title": "Leaking pipe in washroom", "description": "Water leaking under the sink for days.",
                "location": "Hall 1, Room 12", "category_id": category_id, "priority": "high"}
        body.update(overrides)
        res = client.post("/api/requests", json=body, headers=headers[who])
        assert res.status_code == 201, res.json
        return res.json["request"]
    return _make
