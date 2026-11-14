"""Administrator reports: summary statistics and CSV / PDF export."""
import csv
import io
from datetime import timedelta

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import current_user
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func

from ..extensions import db
from ..models import PRIORITIES, STATUSES, Assignment, Category, Role, ServiceRequest, User, utcnow
from ..utils import APIError, audit, roles_required
from .requests import apply_filters

bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _hours(start, end):
    return (end - start).total_seconds() / 3600


@bp.get("/summary")
@roles_required("admin")
def summary():
    status_rows = dict(db.session.query(ServiceRequest.status, func.count()).group_by(ServiceRequest.status).all())
    priority_rows = dict(db.session.query(ServiceRequest.priority, func.count()).group_by(ServiceRequest.priority).all())
    cat_rows = (db.session.query(Category.name, func.count(ServiceRequest.id))
                .outerjoin(ServiceRequest).group_by(Category.name).order_by(Category.name).all())

    completed = ServiceRequest.query.filter(ServiceRequest.completed_at.isnot(None)).all()
    avg_resolution = (round(sum(_hours(r.created_at, r.completed_at) for r in completed) / len(completed), 1)
                      if completed else None)

    # Officer performance
    officers = User.query.join(Role).filter(Role.name == "officer").order_by(User.full_name).all()
    perf = []
    for o in officers:
        jobs = (ServiceRequest.query.join(Assignment)
                .filter(Assignment.officer_id == o.id, Assignment.is_active.is_(True)).all())
        done = [j for j in jobs if j.status == "completed"]
        perf.append({
            "officer": o.brief(),
            "assigned": len(jobs),
            "open": len([j for j in jobs if j.status in ("assigned", "in_progress", "on_hold")]),
            "completed": len(done),
            "avg_hours_to_complete": (round(sum(_hours(j.created_at, j.completed_at) for j in done) / len(done), 1)
                                      if done else None),
        })

    # Requests received per day, last 14 days
    since = (utcnow() - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)
    recent = ServiceRequest.query.filter(ServiceRequest.created_at >= since).all()
    per_day = {(since + timedelta(days=i)).date().isoformat(): 0 for i in range(14)}
    for r in recent:
        key = r.created_at.date().isoformat()
        if key in per_day:
            per_day[key] += 1

    return jsonify({
        "total": sum(status_rows.values()),
        "by_status": {s: status_rows.get(s, 0) for s in STATUSES},
        "by_priority": {p: priority_rows.get(p, 0) for p in PRIORITIES},
        "by_category": [{"category": n, "count": c} for n, c in cat_rows],
        "avg_resolution_hours": avg_resolution,
        "officer_performance": perf,
        "per_day": [{"date": d, "count": c} for d, c in per_day.items()],
        "users": {"total": User.query.count(),
                  "by_role": dict(db.session.query(Role.name, func.count(User.id))
                                  .outerjoin(User).group_by(Role.name).all())},
    })


COLUMNS = ["Reference", "Title", "Category", "Location", "Priority", "Status",
           "Requester", "Assigned officer", "Created", "Completed"]


def _rows():
    q = apply_filters(ServiceRequest.query)
    out = []
    for r in q.limit(5000).all():
        a = r.active_assignment
        out.append([
            r.reference, r.title, r.category.name if r.category else "", r.location,
            r.priority.title(), r.status.replace("_", " ").title(),
            r.requester.full_name if r.requester else "", a.officer.full_name if a else "",
            r.created_at.strftime("%Y-%m-%d %H:%M"),
            r.completed_at.strftime("%Y-%m-%d %H:%M") if r.completed_at else "",
        ])
    return out


@bp.get("/export")
@roles_required("admin")
def export():
    fmt = request.args.get("format", "csv").lower()
    rows = _rows()
    stamp = utcnow().strftime("%Y%m%d-%H%M")
    audit("report.export", "service_request", None, f"{fmt.upper()} export, {len(rows)} rows")
    db.session.commit()

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(COLUMNS)
        writer.writerows(rows)
        return Response(buf.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="service-requests-{stamp}.csv"'})

    if fmt == "pdf":
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=1.2 * cm, rightMargin=1.2 * cm,
                                topMargin=1.2 * cm, bottomMargin=1.2 * cm,
                                title="Service Requests Report")
        styles = getSampleStyleSheet()
        small = styles["BodyText"].clone("small", fontSize=7.5, leading=9)
        story = [
            Paragraph("UniFix — Campus Maintenance Service Requests Report", styles["Title"]),
            Paragraph(f"Generated {utcnow().strftime('%d %b %Y %H:%M')} UTC by {current_user.full_name} "
                      f"· {len(rows)} request(s)", styles["Normal"]),
            Spacer(1, 10),
        ]
        data = [COLUMNS] + [[Paragraph(str(c), small) for c in row] for row in rows]
        widths = [2.6, 5, 2.6, 3.2, 1.6, 2, 3, 3, 2.6, 2.6]
        table = Table(data, colWidths=[w * cm for w in widths], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(table)
        doc.build(story)
        return Response(buf.getvalue(), mimetype="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="service-requests-{stamp}.pdf"'})

    raise APIError("format must be csv or pdf", 400)
