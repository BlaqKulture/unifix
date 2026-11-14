"""Authentication: register, login, logout, current user profile."""
from flask import Blueprint, jsonify
from flask_jwt_extended import create_access_token, current_user, get_jwt, jwt_required

from ..extensions import db
from ..models import Role, TokenBlocklist, User
from ..utils import APIError, audit, check_password_strength, get_json, validate

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _token_for(user):
    return create_access_token(identity=str(user.id), additional_claims={"role": user.role_name})


@bp.post("/register")
def register():
    """Self-registration is open to students and staff only.
    Officers and administrators are created by an administrator."""
    data = get_json()
    clean = validate(data, {
        "full_name": {"required": True, "min": 3, "max": 120},
        "email": {"required": True, "email": True, "max": 120},
        "password": {"required": True, "max": 128},
        "phone": {"max": 30},
        "department": {"max": 120},
        "role": {"choices": ["student", "staff"]},
    })
    check_password_strength(clean["password"])
    email = clean["email"].lower()
    if User.query.filter_by(email=email).first():
        raise APIError("Validation failed", 409, {"email": "An account with this email already exists."})

    role = Role.query.filter_by(name=clean.get("role", "student")).first()
    user = User(
        full_name=clean["full_name"], email=email, phone=clean.get("phone"),
        department=clean.get("department"), role=role,
    )
    user.set_password(clean["password"])
    db.session.add(user)
    db.session.flush()
    audit("user.register", "user", user.id, f"{email} registered as {role.name}", user=user)
    db.session.commit()
    return jsonify({"message": "Account created successfully.", "user": user.to_dict(),
                    "access_token": _token_for(user)}), 201


@bp.post("/login")
def login():
    data = get_json()
    clean = validate(data, {
        "email": {"required": True, "email": True},
        "password": {"required": True},
    })
    user = User.query.filter_by(email=clean["email"].lower()).first()
    if not user or not user.check_password(clean["password"]):
        audit("auth.login_failed", "user", user.id if user else None, clean["email"], user=None)
        db.session.commit()
        raise APIError("Invalid email or password.", 401)
    if not user.is_active:
        raise APIError("This account has been deactivated. Contact the administrator.", 403)
    audit("auth.login", "user", user.id, None, user=user)
    db.session.commit()
    return jsonify({"message": "Login successful.", "user": user.to_dict(),
                    "access_token": _token_for(user)})


@bp.post("/logout")
@jwt_required()
def logout():
    """Revoke the current token (server-side session invalidation)."""
    db.session.add(TokenBlocklist(jti=get_jwt()["jti"]))
    audit("auth.logout", "user", current_user.id)
    db.session.commit()
    return jsonify({"message": "Logged out."})


@bp.get("/me")
@jwt_required()
def me():
    return jsonify({"user": current_user.to_dict()})


@bp.put("/me")
@jwt_required()
def update_me():
    data = get_json()
    clean = validate(data, {
        "full_name": {"min": 3, "max": 120},
        "phone": {"max": 30},
        "department": {"max": 120},
        "current_password": {},
        "new_password": {"max": 128},
    })
    user = current_user
    for field in ("full_name", "phone", "department"):
        if field in clean:
            setattr(user, field, clean[field])
    if clean.get("new_password"):
        if not user.check_password(clean.get("current_password", "")):
            raise APIError("Validation failed", 422, {"current_password": "Current password is incorrect."})
        check_password_strength(clean["new_password"])
        user.set_password(clean["new_password"])
    audit("user.update_profile", "user", user.id)
    db.session.commit()
    return jsonify({"message": "Profile updated.", "user": user.to_dict()})
