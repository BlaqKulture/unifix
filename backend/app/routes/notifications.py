"""In-app notifications and the audit trail."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import or_

from ..extensions import db
from ..models import AuditLog, Notification, User
from ..utils import APIError, paginate, roles_required

bp = Blueprint("notifications", __name__, url_prefix="/api")


@bp.get("/notifications")
@jwt_required()
def list_notifications():
    q = Notification.query.filter_by(user_id=current_user.id)
    if request.args.get("unread") == "true":
        q = q.filter_by(is_read=False)
    data = paginate(q.order_by(Notification.created_at.desc()))
    data["unread_count"] = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify(data)


@bp.post("/notifications/<int:nid>/read")
@jwt_required()
def mark_read(nid):
    n = db.session.get(Notification, nid)
    if not n or n.user_id != current_user.id:
        raise APIError("Notification not found.", 404)
    n.is_read = True
    db.session.commit()
    return jsonify({"message": "Marked as read."})


@bp.post("/notifications/read-all")
@jwt_required()
def mark_all_read():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read."})


@bp.get("/audit-logs")
@roles_required("admin")
def list_audit_logs():
    q = AuditLog.query.outerjoin(User)
    if action := request.args.get("action"):
        q = q.filter(AuditLog.action.ilike(f"{action}%"))
    if search := request.args.get("q", "").strip():
        like = f"%{search}%"
        q = q.filter(or_(AuditLog.details.ilike(like), User.email.ilike(like), User.full_name.ilike(like)))
    return jsonify(paginate(q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())))
