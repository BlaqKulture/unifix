"""Shared helpers: error type, input validation, role-based access control,
audit logging, notifications and pagination."""
import re
from functools import wraps

from flask import request
from flask_jwt_extended import current_user, verify_jwt_in_request

from .extensions import db
from .models import AuditLog, Notification

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")


class APIError(Exception):
    """Raised anywhere in a route; turned into a JSON error response."""

    def __init__(self, message, status=400, details=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details or {}


# ---------- validation ----------

def get_json():
    data = request.get_json(silent=True)
    if data is None or not isinstance(data, dict):
        raise APIError("Request body must be a JSON object", 400)
    return data


def validate(data, rules):
    """Validate a dict against simple rules.

    rules = {field: {"required": bool, "type": str|int|bool, "min": n, "max": n,
                     "choices": [...], "email": bool}}
    Returns a cleaned dict; raises APIError(422) listing every invalid field.
    """
    errors, clean = {}, {}
    for field, rule in rules.items():
        value = data.get(field)
        if isinstance(value, str):
            value = value.strip()
        if value in (None, ""):
            if rule.get("required"):
                errors[field] = "This field is required."
            continue
        typ = rule.get("type", str)
        if typ is int:
            try:
                value = int(value)
            except (TypeError, ValueError):
                errors[field] = "Must be a whole number."
                continue
        elif typ is bool:
            if not isinstance(value, bool):
                errors[field] = "Must be true or false."
                continue
        elif typ is str and not isinstance(value, str):
            errors[field] = "Must be text."
            continue
        if typ is str:
            if "min" in rule and len(value) < rule["min"]:
                errors[field] = f"Must be at least {rule['min']} characters."
                continue
            if "max" in rule and len(value) > rule["max"]:
                errors[field] = f"Must be at most {rule['max']} characters."
                continue
        if rule.get("email") and not EMAIL_RE.match(value):
            errors[field] = "Enter a valid email address."
            continue
        if "choices" in rule and value not in rule["choices"]:
            errors[field] = f"Must be one of: {', '.join(map(str, rule['choices']))}."
            continue
        clean[field] = value
    if errors:
        raise APIError("Validation failed", 422, errors)
    return clean


def check_password_strength(password):
    if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise APIError(
            "Validation failed", 422,
            {"password": "Password must be at least 8 characters and contain letters and numbers."},
        )


# ---------- role-based access control ----------

def roles_required(*roles):
    """Decorator: require a valid JWT and one of the given roles."""

    def wrapper(fn):
        @wraps(fn)
        def decorated(*args, **kwargs):
            verify_jwt_in_request()
            if current_user.role_name not in roles:
                raise APIError("You do not have permission to perform this action.", 403)
            return fn(*args, **kwargs)

        return decorated

    return wrapper


# ---------- audit trail & notifications ----------

def audit(action, entity_type=None, entity_id=None, details=None, user=None):
    """Record who did what. Committed together with the caller's transaction."""
    if user is None:
        try:
            user = current_user
        except Exception:  # no JWT in context (e.g. failed login)
            user = None
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    db.session.add(AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=(details or "")[:500],
        ip_address=ip.split(",")[0].strip()[:64],
    ))


def notify(user_id, message, request_id=None):
    db.session.add(Notification(user_id=user_id, message=message[:300], request_id=request_id))


# ---------- pagination ----------

def paginate(query, serializer=lambda x: x.to_dict()):
    try:
        page = max(int(request.args.get("page", 1)), 1)
        per_page = min(max(int(request.args.get("per_page", 10)), 1), 100)
    except ValueError:
        raise APIError("page and per_page must be numbers", 400)
    result = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [serializer(item) for item in result.items],
        "page": result.page,
        "per_page": result.per_page,
        "total": result.total,
        "pages": result.pages,
    }
