"""Authentication, password security and session management."""
from app.extensions import db
from app.models import User


def test_register_success_returns_token(client):
    res = client.post("/api/auth/register", json={
        "full_name": "New Student", "email": "NEW@test.edu", "password": "Secret123", "role": "student"})
    assert res.status_code == 201
    assert res.json["user"]["email"] == "new@test.edu"  # normalised to lower case
    assert res.json["user"]["role"] == "student"
    assert res.json["access_token"]


def test_password_is_hashed_not_stored_in_plain_text(client, app):
    client.post("/api/auth/register", json={
        "full_name": "Hash Check", "email": "hash@test.edu", "password": "Secret123"})
    with app.app_context():
        user = User.query.filter_by(email="hash@test.edu").first()
        assert user.password_hash != "Secret123"
        assert user.password_hash.startswith("$2")  # bcrypt
        assert user.check_password("Secret123")


def test_register_duplicate_email_rejected(client):
    res = client.post("/api/auth/register", json={
        "full_name": "Dup User", "email": "student@test.edu", "password": "Secret123"})
    assert res.status_code == 409
    assert "email" in res.json["details"]


def test_register_validation_errors(client):
    res = client.post("/api/auth/register", json={"full_name": "A", "email": "not-an-email", "password": "short"})
    assert res.status_code == 422
    assert set(res.json["details"]) >= {"full_name", "email"}


def test_register_weak_password_rejected(client):
    res = client.post("/api/auth/register", json={
        "full_name": "Weak Pass", "email": "weak@test.edu", "password": "abcdefgh"})
    assert res.status_code == 422
    assert "password" in res.json["details"]


def test_cannot_self_register_as_admin(client):
    res = client.post("/api/auth/register", json={
        "full_name": "Sneaky", "email": "sneaky@test.edu", "password": "Secret123", "role": "admin"})
    assert res.status_code == 422


def test_login_success_and_wrong_password(client):
    ok = client.post("/api/auth/login", json={"email": "admin@test.edu", "password": "Password123"})
    assert ok.status_code == 200 and ok.json["user"]["role"] == "admin"
    bad = client.post("/api/auth/login", json={"email": "admin@test.edu", "password": "wrong-pass1"})
    assert bad.status_code == 401


def test_deactivated_user_cannot_login(client, app):
    with app.app_context():
        u = User.query.filter_by(email="student2@test.edu").first()
        u.is_active = False
        db.session.commit()
    res = client.post("/api/auth/login", json={"email": "student2@test.edu", "password": "Password123"})
    assert res.status_code == 403


def test_protected_route_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/requests").status_code == 401


def test_me_returns_current_user(client, headers):
    res = client.get("/api/auth/me", headers=headers["staff"])
    assert res.json["user"]["email"] == "staff@test.edu"


def test_logout_revokes_token(client, headers):
    h = headers["student"]
    assert client.post("/api/auth/logout", headers=h).status_code == 200
    res = client.get("/api/auth/me", headers=h)
    assert res.status_code == 401
    assert "logged out" in res.json["error"].lower()


def test_change_password_requires_current_password(client, headers):
    h = headers["student"]
    bad = client.put("/api/auth/me", json={"current_password": "nope", "new_password": "NewPass123"}, headers=h)
    assert bad.status_code == 422
    ok = client.put("/api/auth/me", json={"current_password": "Password123", "new_password": "NewPass123"}, headers=h)
    assert ok.status_code == 200
    relog = client.post("/api/auth/login", json={"email": "student@test.edu", "password": "NewPass123"})
    assert relog.status_code == 200
