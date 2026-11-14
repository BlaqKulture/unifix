"""Service requests: CRUD, search/filter/pagination, assignment,
status workflow, evidence photo uploads and dashboard statistics."""
from datetime import datetime

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import case, func, or_

from ..extensions import db
from ..models import (PRIORITIES, REQUESTER_ROLES, STATUSES, Assignment, Attachment, Category,
                      Role, ServiceRequest, StatusLog, User, utcnow)
from ..utils import APIError, audit, get_json, notify, paginate, roles_required, validate

bp = Blueprint("requests", __name__, url_prefix="/api")

# Which status changes each role may make (the request workflow).
OFFICER_TRANSITIONS = {
    "assigned": {"in_progress"},
    "in_progress": {"on_hold", "completed"},
    "on_hold": {"in_progress"},
}
NEEDS_OFFICER = {"in_progress", "on_hold", "completed"}
NEEDS_COMMENT = {"on_hold", "cancelled"}
OPEN_STATUSES = ["pending", "assigned", "in_progress", "on_hold"]
MAX_ATTACHMENTS = 5


def label(status):
    return status.replace("_", " ").title()


# ---------- access helpers ----------

def scoped_query():
    """Return the request query limited to what the current user may see."""
    q = ServiceRequest.query
    role = current_user.role_name
    if role in REQUESTER_ROLES:
        q = q.filter(ServiceRequest.requester_id == current_user.id)
    elif role == "officer":
        q = q.join(Assignment).filter(Assignment.officer_id == current_user.id,
                                      Assignment.is_active.is_(True))
    return q


def can_view(sr):
    role = current_user.role_name
    if role == "admin":
        return True
    if role in REQUESTER_ROLES:
        return sr.requester_id == current_user.id
    return any(a.officer_id == current_user.id for a in sr.assignments)


def get_visible_or_404(req_id):
    sr = db.session.get(ServiceRequest, req_id)
    if not sr or not can_view(sr):
        raise APIError("Service request not found.", 404)
    return sr


def apply_filters(q):
    """Search, filter and sort from query-string parameters."""
    args = request.args
    if search := args.get("q", "").strip():
        like = f"%{search}%"
        q = q.filter(or_(ServiceRequest.title.ilike(like), ServiceRequest.description.ilike(like),
                         ServiceRequest.reference.ilike(like), ServiceRequest.location.ilike(like)))
    if status := args.get("status"):
        wanted = [s for s in status.split(",") if s in STATUSES]
        if wanted:
            q = q.filter(ServiceRequest.status.in_(wanted))
    if (priority := args.get("priority")) in PRIORITIES:
        q = q.filter(ServiceRequest.priority == priority)
    if (cat := args.get("category_id", "")).isdigit():
        q = q.filter(ServiceRequest.category_id == int(cat))
    if (officer := args.get("officer_id", "")).isdigit() and current_user.role_name == "admin":
        q = q.filter(ServiceRequest.assignments.any(
            (Assignment.officer_id == int(officer)) & Assignment.is_active.is_(True)))
    for param, op in (("date_from", "ge"), ("date_to", "le")):
        if value := args.get(param):
            try:
                day = datetime.fromisoformat(value)
            except ValueError:
                raise APIError(f"{param} must be a date like 2026-11-13", 400)
            if op == "ge":
                q = q.filter(ServiceRequest.created_at >= day)
            else:
                q = q.filter(ServiceRequest.created_at < day.replace(hour=23, minute=59, second=59))
    sort = args.get("sort", "newest")
    if sort == "oldest":
        q = q.order_by(ServiceRequest.created_at.asc())
    elif sort == "priority":
        rank = case({"urgent": 0, "high": 1, "medium": 2, "low": 3}, value=ServiceRequest.priority)
        q = q.order_by(rank, ServiceRequest.created_at.desc())
    else:
        q = q.order_by(ServiceRequest.created_at.desc())
    return q


# ---------- CRUD ----------

@bp.post("/requests")
@roles_required("student", "staff")
def create_request():
    clean = validate(get_json(), {
        "title": {"required": True, "min": 5, "max": 150},
        "description": {"required": True, "min": 10, "max": 2000},
        "location": {"required": True, "min": 2, "max": 150},
        "category_id": {"required": True, "type": int},
        "priority": {"choices": PRIORITIES},
    })
    cat = db.session.get(Category, clean["category_id"])
    if not cat or not cat.is_active:
        raise APIError("Validation failed", 422, {"category_id": "Choose a valid category."})
    sr = ServiceRequest(title=clean["title"], description=clean["description"],
                        location=clean["location"], priority=clean.get("priority", "medium"),
                        category=cat, requester_id=current_user.id, status="pending")
    db.session.add(sr)
    db.session.flush()
    sr.reference = f"SR-{utcnow().year}-{sr.id:05d}"
    db.session.add(StatusLog(request=sr, old_status=None, new_status="pending",
                             comment="Request submitted", changed_by_id=current_user.id))
    # Tell every administrator a new request is waiting for assignment.
    admins = User.query.join(Role).filter(Role.name == "admin", User.is_active.is_(True)).all()
    for admin in admins:
        notify(admin.id, f"New request {sr.reference}: {sr.title}", sr.id)
    audit("request.create", "service_request", sr.id, f"{sr.reference} {sr.title}")
    db.session.commit()
    return jsonify({"message": f"Request {sr.reference} submitted successfully.",
                    "request": sr.to_dict(detail=True)}), 201


@bp.get("/requests")
@jwt_required()
def list_requests():
    q = apply_filters(scoped_query())
    return jsonify(paginate(q))


@bp.get("/requests/stats")
@jwt_required()
def request_stats():
    """Counts per status for the current user's dashboard."""
    base = scoped_query().with_entities(ServiceRequest.id).subquery()
    rows = (db.session.query(ServiceRequest.status, func.count(ServiceRequest.id))
            .filter(ServiceRequest.id.in_(db.select(base.c.id)))
            .group_by(ServiceRequest.status).all())
    by_status = {s: 0 for s in STATUSES}
    by_status.update(dict(rows))
    return jsonify({
        "total": sum(by_status.values()),
        "open": sum(by_status[s] for s in OPEN_STATUSES),
        "by_status": by_status,
    })


@bp.get("/requests/<int:req_id>")
@jwt_required()
def get_request(req_id):
    return jsonify({"request": get_visible_or_404(req_id).to_dict(detail=True)})


@bp.patch("/requests/<int:req_id>")
@jwt_required()
def update_request(req_id):
    sr = get_visible_or_404(req_id)
    role = current_user.role_name
    if role in REQUESTER_ROLES:
        if sr.status != "pending":
            raise APIError("You can only edit a request while it is still pending.", 409)
    elif role != "admin":
        raise APIError("You do not have permission to edit request details.", 403)
    clean = validate(get_json(), {
        "title": {"min": 5, "max": 150},
        "description": {"min": 10, "max": 2000},
        "location": {"min": 2, "max": 150},
        "category_id": {"type": int},
        "priority": {"choices": PRIORITIES},
    })
    if "category_id" in clean:
        cat = db.session.get(Category, clean["category_id"])
        if not cat or not cat.is_active:
            raise APIError("Validation failed", 422, {"category_id": "Choose a valid category."})
    for k, v in clean.items():
        setattr(sr, k, v)
    audit("request.update", "service_request", sr.id, ", ".join(clean.keys()))
    db.session.commit()
    return jsonify({"message": "Request updated.", "request": sr.to_dict(detail=True)})


@bp.delete("/requests/<int:req_id>")
@roles_required("admin")
def delete_request(req_id):
    sr = db.get_or_404(ServiceRequest, req_id)
    ref = sr.reference
    audit("request.delete", "service_request", sr.id, ref)
    db.session.delete(sr)
    db.session.commit()
    return jsonify({"message": f"Request {ref} deleted."})


# ---------- workflow ----------

@bp.post("/requests/<int:req_id>/assign")
@roles_required("admin")
def assign_request(req_id):
    sr = db.get_or_404(ServiceRequest, req_id)
    clean = validate(get_json(), {
        "officer_id": {"required": True, "type": int},
        "note": {"max": 255},
    })
    if sr.status in ("completed", "cancelled"):
        raise APIError(f"A {sr.status} request cannot be assigned.", 409)
    officer = db.session.get(User, clean["officer_id"])
    if not officer or officer.role_name != "officer" or not officer.is_active:
        raise APIError("Validation failed", 422, {"officer_id": "Choose an active maintenance officer."})
    current = sr.active_assignment
    if current and current.officer_id == officer.id:
        raise APIError("This request is already assigned to that officer.", 409)
    if current:
        current.is_active = False
        notify(current.officer_id, f"{sr.reference} has been reassigned to another officer.", sr.id)
    db.session.add(Assignment(request=sr, officer_id=officer.id, assigned_by_id=current_user.id,
                              note=clean.get("note")))
    old = sr.status
    sr.status = "assigned"
    comment = f"Assigned to {officer.full_name}" + (f": {clean['note']}" if clean.get("note") else "")
    db.session.add(StatusLog(request=sr, old_status=old, new_status="assigned",
                             comment=comment, changed_by_id=current_user.id))
    notify(officer.id, f"You have been assigned {sr.reference}: {sr.title} ({sr.location})", sr.id)
    notify(sr.requester_id, f"Your request {sr.reference} has been assigned to {officer.full_name}.", sr.id)
    audit("request.assign", "service_request", sr.id, f"{sr.reference} -> {officer.email}")
    db.session.commit()
    return jsonify({"message": f"Request assigned to {officer.full_name}.",
                    "request": sr.to_dict(detail=True)})


@bp.post("/requests/<int:req_id>/status")
@jwt_required()
def change_status(req_id):
    sr = get_visible_or_404(req_id)
    clean = validate(get_json(), {
        "status": {"required": True, "choices": STATUSES},
        "comment": {"max": 500},
    })
    new, old, role = clean["status"], sr.status, current_user.role_name
    comment = clean.get("comment")

    if new == old:
        raise APIError(f"Request is already {label(old)}.", 409)
    if old in ("completed", "cancelled") and role != "admin":
        raise APIError(f"A {old} request can no longer be changed.", 409)

    if role in REQUESTER_ROLES:
        if not (old == "pending" and new == "cancelled"):
            raise APIError("You can only cancel your request while it is pending.", 403)
    elif role == "officer":
        active = sr.active_assignment
        if not active or active.officer_id != current_user.id:
            raise APIError("This request is not assigned to you.", 403)
        if new not in OFFICER_TRANSITIONS.get(old, set()):
            raise APIError(f"Cannot move a request from {label(old)} to {label(new)}.", 409)
    elif role == "admin":
        if new == "assigned":
            raise APIError("Use the assign action to assign an officer.", 400)
        if new == "pending":
            # Re-opening: release any officer so it can be re-assigned.
            for a in sr.assignments:
                a.is_active = False
    if new in NEEDS_OFFICER and not sr.active_assignment:
        raise APIError("Assign an officer before changing to this status.", 409)
    if new in NEEDS_COMMENT and not comment:
        raise APIError("Validation failed", 422, {"comment": "Please give a reason for this change."})

    sr.status = new
    sr.completed_at = utcnow() if new == "completed" else None
    db.session.add(StatusLog(request=sr, old_status=old, new_status=new,
                             comment=comment, changed_by_id=current_user.id))
    msg = f"{sr.reference} is now {label(new)}" + (f": {comment}" if comment else "")
    if sr.requester_id != current_user.id:
        notify(sr.requester_id, msg, sr.id)
    if new == "completed":
        for admin in User.query.join(Role).filter(Role.name == "admin").all():
            if admin.id != current_user.id:
                notify(admin.id, f"{sr.reference} was completed by {current_user.full_name}.", sr.id)
    if role != "officer" and sr.active_assignment:
        notify(sr.active_assignment.officer_id, msg, sr.id)
    audit("request.status", "service_request", sr.id, f"{old} -> {new}")
    db.session.commit()
    return jsonify({"message": f"Status updated to {label(new)}.", "request": sr.to_dict(detail=True)})


# ---------- evidence photos ----------

@bp.post("/requests/<int:req_id>/attachments")
@jwt_required()
def upload_attachments(req_id):
    from flask import current_app
    sr = get_visible_or_404(req_id)
    if sr.status in ("completed", "cancelled") and current_user.role_name != "admin":
        raise APIError("Photos cannot be added to a closed request.", 409)
    files = request.files.getlist("files")
    if not files or all(not f.filename for f in files):
        raise APIError("Validation failed", 422, {"files": "Choose at least one image to upload."})
    if len(sr.attachments) + len(files) > MAX_ATTACHMENTS:
        raise APIError("Validation failed", 422,
                       {"files": f"A request can have at most {MAX_ATTACHMENTS} photos."})
    allowed = current_app.config["ALLOWED_IMAGE_TYPES"]
    limit = current_app.config["MAX_UPLOAD_BYTES"]
    saved = []
    for f in files:
        data = f.read()
        if f.mimetype not in allowed:
            raise APIError("Validation failed", 422, {"files": f"{f.filename}: only JPG, PNG, WEBP or GIF images."})
        if len(data) > limit:
            raise APIError("Validation failed", 422, {"files": f"{f.filename}: images must be under 3 MB."})
        att = Attachment(request=sr, filename=f.filename[:200], mimetype=f.mimetype,
                         size=len(data), data=data, uploaded_by_id=current_user.id)
        db.session.add(att)
        saved.append(att)
    db.session.flush()
    audit("attachment.upload", "service_request", sr.id, f"{len(saved)} file(s)")
    db.session.commit()
    return jsonify({"message": f"{len(saved)} photo(s) uploaded.",
                    "attachments": [a.to_dict() for a in saved]}), 201


@bp.get("/attachments/<int:att_id>")
@jwt_required()
def get_attachment(att_id):
    att = db.session.get(Attachment, att_id)
    if not att or not can_view(att.request):
        raise APIError("File not found.", 404)
    return Response(att.data, mimetype=att.mimetype,
                    headers={"Content-Disposition": f'inline; filename="{att.filename}"',
                             "Cache-Control": "private, max-age=3600"})
