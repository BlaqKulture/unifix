"""Database models (relational schema).

Entities required by the brief: Users, Roles, Service Requests,
Request Categories, Assignments, Status Updates/Logs.
Extra entities supporting the advanced features: Attachments (evidence
photos), Notifications (in-app), AuditLog (activity trail) and
TokenBlocklist (logout / session revocation).

Relationships:
  Role 1──N User
  User 1──N ServiceRequest          (requester)
  Category 1──N ServiceRequest
  ServiceRequest 1──N StatusLog / Attachment / Assignment
  User N──M ServiceRequest via Assignment  (officers ↔ jobs, association object)
  User 1──N Notification, User 1──N AuditLog
"""
from datetime import datetime, timezone

from .extensions import bcrypt, db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# Status and priority vocabularies used across the app
STATUSES = ["pending", "assigned", "in_progress", "on_hold", "completed", "cancelled"]
PRIORITIES = ["low", "medium", "high", "urgent"]
ROLE_NAMES = ["student", "staff", "officer", "admin"]
REQUESTER_ROLES = {"student", "staff"}


class Role(db.Model):
    __tablename__ = "roles"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(30), unique=True, nullable=False)
    description = db.Column(db.String(200))

    users = db.relationship("User", back_populates="role")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "description": self.description}


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    phone = db.Column(db.String(30))
    department = db.Column(db.String(120))
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    role = db.relationship("Role", back_populates="users")
    requests = db.relationship(
        "ServiceRequest", back_populates="requester", foreign_keys="ServiceRequest.requester_id"
    )

    # Passwords are never stored in plain text: bcrypt hash with salt.
    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    @property
    def role_name(self):
        return self.role.name if self.role else None

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "department": self.department,
            "role": self.role_name,
            "is_active": self.is_active,
            "created_at": iso(self.created_at),
        }

    def brief(self):
        return {"id": self.id, "full_name": self.full_name, "email": self.email}


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    requests = db.relationship("ServiceRequest", back_populates="category")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
        }


class ServiceRequest(db.Model):
    __tablename__ = "service_requests"
    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(20), unique=True, index=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(150), nullable=False)
    priority = db.Column(db.String(10), default="medium", nullable=False)
    status = db.Column(db.String(20), default="pending", nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow, nullable=False)
    completed_at = db.Column(db.DateTime)

    category = db.relationship("Category", back_populates="requests")
    requester = db.relationship("User", back_populates="requests", foreign_keys=[requester_id])
    assignments = db.relationship(
        "Assignment", back_populates="request", cascade="all, delete-orphan",
        order_by="Assignment.assigned_at",
    )
    logs = db.relationship(
        "StatusLog", back_populates="request", cascade="all, delete-orphan",
        order_by="StatusLog.created_at",
    )
    attachments = db.relationship(
        "Attachment", back_populates="request", cascade="all, delete-orphan"
    )

    @property
    def active_assignment(self):
        for a in self.assignments:
            if a.is_active:
                return a
        return None

    def to_dict(self, detail=False):
        a = self.active_assignment
        data = {
            "id": self.id,
            "reference": self.reference,
            "title": self.title,
            "description": self.description,
            "location": self.location,
            "priority": self.priority,
            "status": self.status,
            "category": self.category.to_dict() if self.category else None,
            "requester": self.requester.brief() if self.requester else None,
            "assigned_officer": a.officer.brief() if a else None,
            "attachment_count": len(self.attachments),
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
            "completed_at": iso(self.completed_at),
        }
        if detail:
            data["logs"] = [log.to_dict() for log in self.logs]
            data["assignments"] = [x.to_dict() for x in self.assignments]
            data["attachments"] = [x.to_dict() for x in self.attachments]
        return data


class Assignment(db.Model):
    """Association object linking a request to a maintenance officer."""
    __tablename__ = "assignments"
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey("service_requests.id"), nullable=False)
    officer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    assigned_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    note = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    assigned_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    request = db.relationship("ServiceRequest", back_populates="assignments")
    officer = db.relationship("User", foreign_keys=[officer_id])
    assigned_by = db.relationship("User", foreign_keys=[assigned_by_id])

    def to_dict(self):
        return {
            "id": self.id,
            "officer": self.officer.brief() if self.officer else None,
            "assigned_by": self.assigned_by.brief() if self.assigned_by else None,
            "note": self.note,
            "is_active": self.is_active,
            "assigned_at": iso(self.assigned_at),
        }


class StatusLog(db.Model):
    __tablename__ = "status_logs"
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey("service_requests.id"), nullable=False)
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20), nullable=False)
    comment = db.Column(db.String(500))
    changed_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    request = db.relationship("ServiceRequest", back_populates="logs")
    changed_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "comment": self.comment,
            "changed_by": self.changed_by.brief() if self.changed_by else None,
            "created_at": iso(self.created_at),
        }


class Attachment(db.Model):
    """Evidence photo of a fault. Bytes are stored in the database so the
    app works on hosts without persistent disks (e.g. Render free tier)."""
    __tablename__ = "attachments"
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey("service_requests.id"), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    mimetype = db.Column(db.String(50), nullable=False)
    size = db.Column(db.Integer, nullable=False)
    data = db.Column(db.LargeBinary, nullable=False)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    request = db.relationship("ServiceRequest", back_populates="attachments")

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "mimetype": self.mimetype,
            "size": self.size,
            "url": f"/api/attachments/{self.id}",
            "created_at": iso(self.created_at),
        }


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    request_id = db.Column(db.Integer, db.ForeignKey("service_requests.id"))
    message = db.Column(db.String(300), nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "request_id": self.request_id,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": iso(self.created_at),
        }


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    action = db.Column(db.String(60), nullable=False, index=True)
    entity_type = db.Column(db.String(40))
    entity_id = db.Column(db.Integer)
    details = db.Column(db.String(500))
    ip_address = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.brief() if self.user else None,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "created_at": iso(self.created_at),
        }


class TokenBlocklist(db.Model):
    """JWT IDs revoked at logout, so a logged-out token cannot be reused."""
    __tablename__ = "token_blocklist"
    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


def iso(dt):
    return dt.isoformat() + "Z" if dt else None
