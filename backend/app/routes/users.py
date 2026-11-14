"""User management (administrator only) and role lookup."""
from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from ..extensions import db
from ..models import ROLE_NAMES, Assignment, Role, ServiceRequest, User
from ..utils import APIError, audit, check_password_strength, get_json, paginate, roles_required, validate

bp = Blueprint("users", __name__, url_prefix="/api")


@bp.get("/roles")
def list_roles():
    return jsonify([r.to_dict() for r in Role.query.order_by(Role.id).all()])


@bp.get("/users")
@roles_required("admin")
def list_users():
    q = User.query.join(Role)
    if role := request.args.get("role"):
        q = q.filter(Role.name == role)
    if search := request.args.get("q", "").strip():
        like = f"%{search}%"
        q = q.filter(or_(User.full_name.ilike(like), User.email.ilike(like), User.department.ilike(like)))
    if (active := request.args.get("is_active")) in ("true", "false"):
        q = q.filter(User.is_active == (active == "true"))
    return jsonify(paginate(q.order_by(User.created_at.desc())))


@bp.post("/users")
@roles_required("admin")
def create_user():
    data = get_json()
    clean = validate(data, {
        "full_name": {"required": True, "min": 3, "max": 120},
        "email": {"required": True, "email": True, "max": 120},
        "password": {"required": True, "max": 128},
        "role": {"required": True, "choices": ROLE_NAMES},
        "phone": {"max": 30},
        "department": {"max": 120},
    })
    check_password_strength(clean["password"])
    email = clean["email"].lower()
    if User.query.filter_by(email=email).first():
        raise APIError("Validation failed", 409, {"email": "An account with this email already exists."})
    user = User(full_name=clean["full_name"], email=email, phone=clean.get("phone"),
                department=clean.get("department"),
                role=Role.query.filter_by(name=clean["role"]).first())
    user.set_password(clean["password"])
    db.session.add(user)
    db.session.flush()
    audit("user.create", "user", user.id, f"Created {email} as {clean['role']}")
    db.session.commit()
    return jsonify({"message": "User created.", "user": user.to_dict()}), 201


@bp.get("/users/<int:user_id>")
@roles_required("admin")
def get_user(user_id):
    return jsonify({"user": db.get_or_404(User, user_id).to_dict()})


@bp.patch("/users/<int:user_id>")
@roles_required("admin")
def update_user(user_id):
    from flask_jwt_extended import current_user
    user = db.get_or_404(User, user_id)
    clean = validate(get_json(), {
        "full_name": {"min": 3, "max": 120},
        "role": {"choices": ROLE_NAMES},
        "is_active": {"type": bool},
        "phone": {"max": 30},
        "department": {"max": 120},
    })
    if user.id == current_user.id and (clean.get("is_active") is False or clean.get("role", "admin") != "admin"):
        raise APIError("You cannot deactivate or demote your own account.", 400)
    changes = []
    for field in ("full_name", "phone", "department", "is_active"):
        if field in clean:
            setattr(user, field, clean[field])
            changes.append(f"{field}={clean[field]}")
    if "role" in clean:
        user.role = Role.query.filter_by(name=clean["role"]).first()
        changes.append(f"role={clean['role']}")
    audit("user.update", "user", user.id, ", ".join(changes))
    db.session.commit()
    return jsonify({"message": "User updated.", "user": user.to_dict()})


@bp.get("/officers")
@roles_required("admin")
def list_officers():
    """Active maintenance officers with their current open workload,
    used by the admin when assigning a request."""
    open_statuses = ["assigned", "in_progress", "on_hold"]
    workload = (
        db.session.query(Assignment.officer_id, func.count(Assignment.id))
        .join(ServiceRequest)
        .filter(Assignment.is_active.is_(True), ServiceRequest.status.in_(open_statuses))
        .group_by(Assignment.officer_id)
        .all()
    )
    counts = dict(workload)
    officers = User.query.join(Role).filter(Role.name == "officer", User.is_active.is_(True)) \
        .order_by(User.full_name).all()
    return jsonify([{**o.brief(), "department": o.department, "open_jobs": counts.get(o.id, 0)}
                    for o in officers])
