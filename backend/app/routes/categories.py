"""Request categories (electricity, plumbing, furniture ...)."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Category, ServiceRequest
from ..utils import APIError, audit, get_json, roles_required, validate

bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@bp.get("")
@jwt_required()
def list_categories():
    q = Category.query
    if request.args.get("include_inactive") != "true":
        q = q.filter_by(is_active=True)
    return jsonify([c.to_dict() for c in q.order_by(Category.name).all()])


@bp.post("")
@roles_required("admin")
def create_category():
    clean = validate(get_json(), {
        "name": {"required": True, "min": 2, "max": 80},
        "description": {"max": 255},
    })
    if Category.query.filter(Category.name.ilike(clean["name"])).first():
        raise APIError("Validation failed", 409, {"name": "A category with this name already exists."})
    cat = Category(**clean)
    db.session.add(cat)
    db.session.flush()
    audit("category.create", "category", cat.id, cat.name)
    db.session.commit()
    return jsonify({"message": "Category created.", "category": cat.to_dict()}), 201


@bp.patch("/<int:cat_id>")
@roles_required("admin")
def update_category(cat_id):
    cat = db.get_or_404(Category, cat_id)
    clean = validate(get_json(), {
        "name": {"min": 2, "max": 80},
        "description": {"max": 255},
        "is_active": {"type": bool},
    })
    for k, v in clean.items():
        setattr(cat, k, v)
    audit("category.update", "category", cat.id, str(clean))
    db.session.commit()
    return jsonify({"message": "Category updated.", "category": cat.to_dict()})


@bp.delete("/<int:cat_id>")
@roles_required("admin")
def delete_category(cat_id):
    cat = db.get_or_404(Category, cat_id)
    if ServiceRequest.query.filter_by(category_id=cat.id).first():
        raise APIError("This category has requests. Deactivate it instead of deleting.", 409)
    audit("category.delete", "category", cat.id, cat.name)
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"message": "Category deleted."})
