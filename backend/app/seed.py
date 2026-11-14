"""Starter data: roles, categories, demo accounts and sample requests.

Runs automatically on start-up when the database is empty (AUTO_SEED=true),
or manually with:  flask --app wsgi seed
"""
import random
from datetime import timedelta

from .extensions import db
from .models import (Assignment, AuditLog, Category, Notification, Role, ServiceRequest,
                     StatusLog, User, utcnow)

ROLES = [
    ("student", "Student who can submit and track service requests"),
    ("staff", "Staff member who can submit and track service requests"),
    ("officer", "Maintenance officer who handles assigned requests"),
    ("admin", "Administrator who manages users, assigns tasks and views reports"),
]

CATEGORIES = [
    ("Electricity", "Faulty sockets, lighting, power outages, wiring"),
    ("Plumbing", "Leaking pipes, blocked drains, toilets, water supply"),
    ("Furniture", "Damaged chairs, desks, beds, wardrobes, doors"),
    ("Internet & Network", "Wi-Fi outages, slow internet, LAN ports"),
    ("Classroom Equipment", "Projectors, speakers, smart boards, air conditioners"),
    ("Hostel Maintenance", "General repairs in student hostels"),
    ("Cleaning & Sanitation", "Waste, pest control, washrooms"),
    ("Security & Safety", "Broken locks, fire equipment, CCTV"),
]

# email, name, role, password, department
DEMO_USERS = [
    ("admin@unifix.edu.ng", "Grace Adebayo", "admin", "Admin1234", "Works & Services"),
    ("officer1@unifix.edu.ng", "Musa Ibrahim", "officer", "Officer1234", "Electrical Unit"),
    ("officer2@unifix.edu.ng", "Chinedu Okafor", "officer", "Officer1234", "Plumbing Unit"),
    ("officer3@unifix.edu.ng", "Aisha Bello", "officer", "Officer1234", "ICT Unit"),
    ("student@unifix.edu.ng", "Tunde Bakare", "student", "Student1234", "Computer Science"),
    ("student2@unifix.edu.ng", "Ngozi Eze", "student", "Student1234", "Mass Communication"),
    ("staff@unifix.edu.ng", "Dr. Femi Oladipo", "staff", "Staff1234", "Faculty of Science"),
]

# title, description, location, category, priority, requester email, status, officer email, days ago
SAMPLE_REQUESTS = [
    ("Socket sparking in room B12", "The wall socket near the reading table sparks whenever a plug is inserted. It is dangerous.", "Hall 3, Room B12", "Electricity", "urgent", "student@unifix.edu.ng", "completed", "officer1@unifix.edu.ng", 12),
    ("Leaking pipe under washroom sink", "Water has been leaking continuously under the sink, the floor is always wet.", "Hall 1, 2nd floor washroom", "Plumbing", "high", "student2@unifix.edu.ng", "in_progress", "officer2@unifix.edu.ng", 4),
    ("Projector not displaying in LT2", "The projector powers on but shows no signal from the HDMI cable.", "Lecture Theatre 2", "Classroom Equipment", "high", "staff@unifix.edu.ng", "assigned", "officer3@unifix.edu.ng", 2),
    ("No Wi-Fi in the library annex", "Wi-Fi network is visible but connection fails for all students since Monday.", "Library Annex", "Internet & Network", "medium", "student@unifix.edu.ng", "pending", None, 1),
    ("Broken chair in Lab 4", "Three chairs have broken legs and are unsafe to sit on.", "Computer Lab 4", "Furniture", "low", "staff@unifix.edu.ng", "completed", "officer1@unifix.edu.ng", 9),
    ("Bathroom door lock broken", "The door cannot be locked from inside.", "Hall 3, Block C bathroom", "Security & Safety", "medium", "student2@unifix.edu.ng", "on_hold", "officer1@unifix.edu.ng", 6),
    ("Air conditioner leaking water", "The AC in the staff room drips water onto the desks.", "Science Faculty staff room", "Classroom Equipment", "medium", "staff@unifix.edu.ng", "completed", "officer2@unifix.edu.ng", 11),
    ("Blocked drain behind hostel", "Drain is blocked and producing a bad smell.", "Hall 2, rear", "Cleaning & Sanitation", "high", "student@unifix.edu.ng", "pending", None, 0),
    ("Flickering lights in corridor", "Fluorescent tubes flicker all night.", "Admin Block, ground floor", "Electricity", "low", "staff@unifix.edu.ng", "cancelled", None, 8),
    ("Wardrobe hinge broken", "Wardrobe door fell off its hinge.", "Hall 1, Room A07", "Hostel Maintenance", "low", "student2@unifix.edu.ng", "assigned", "officer2@unifix.edu.ng", 3),
    ("Slow internet in staff offices", "Internet is extremely slow in the department offices.", "Faculty of Science offices", "Internet & Network", "medium", "staff@unifix.edu.ng", "completed", "officer3@unifix.edu.ng", 7),
    ("Water tap not running", "No water from the tap on the 3rd floor.", "Hall 3, 3rd floor", "Plumbing", "urgent", "student@unifix.edu.ng", "in_progress", "officer2@unifix.edu.ng", 1),
]


def seed_base():
    """Roles and categories: needed for the app to work at all."""
    for name, desc in ROLES:
        if not Role.query.filter_by(name=name).first():
            db.session.add(Role(name=name, description=desc))
    for name, desc in CATEGORIES:
        if not Category.query.filter_by(name=name).first():
            db.session.add(Category(name=name, description=desc))
    db.session.commit()


def seed_demo():
    """Demo accounts for each role plus realistic sample requests."""
    seed_base()
    roles = {r.name: r for r in Role.query.all()}
    users = {}
    for email, name, role, pwd, dept in DEMO_USERS:
        u = User.query.filter_by(email=email).first()
        if not u:
            u = User(email=email, full_name=name, role=roles[role], department=dept,
                     phone="0803" + str(random.randint(1000000, 9999999)))
            u.set_password(pwd)
            db.session.add(u)
        users[email] = u
    db.session.flush()

    if ServiceRequest.query.first():
        db.session.commit()
        return
    admin = users["admin@unifix.edu.ng"]
    cats = {c.name: c for c in Category.query.all()}
    now = utcnow()
    for i, (title, desc, loc, cat, prio, req_email, status, off_email, days) in enumerate(SAMPLE_REQUESTS):
        created = now - timedelta(days=days, hours=random.randint(1, 8))
        requester = users[req_email]
        sr = ServiceRequest(title=title, description=desc, location=loc, category=cats[cat],
                            priority=prio, requester=requester, status="pending",
                            created_at=created, updated_at=created)
        db.session.add(sr)
        db.session.flush()
        sr.reference = f"SR-{created.year}-{sr.id:05d}"
        t = created
        db.session.add(StatusLog(request=sr, new_status="pending", comment="Request submitted",
                                 changed_by_id=requester.id, created_at=t))
        db.session.add(AuditLog(user_id=requester.id, action="request.create", entity_type="service_request",
                                entity_id=sr.id, details=f"{sr.reference} {title}", created_at=t, ip_address="127.0.0.1"))
        if status == "cancelled":
            t += timedelta(hours=2)
            db.session.add(StatusLog(request=sr, old_status="pending", new_status="cancelled",
                                     comment="Fixed by electrician on duty, no longer needed",
                                     changed_by_id=requester.id, created_at=t))
            sr.status = "cancelled"
        if off_email:
            officer = users[off_email]
            t += timedelta(hours=random.randint(1, 5))
            db.session.add(Assignment(request=sr, officer=officer, assigned_by=admin, assigned_at=t,
                                      note="Please attend to this promptly"))
            db.session.add(StatusLog(request=sr, old_status="pending", new_status="assigned",
                                     comment=f"Assigned to {officer.full_name}", changed_by_id=admin.id, created_at=t))
            db.session.add(Notification(user_id=officer.id, request_id=sr.id, created_at=t,
                                        message=f"You have been assigned {sr.reference}: {title} ({loc})"))
            sr.status = "assigned"
            flow = {"assigned": [], "in_progress": ["in_progress"], "on_hold": ["in_progress", "on_hold"],
                    "completed": ["in_progress", "completed"]}[status]
            prev = "assigned"
            for step in flow:
                t += timedelta(hours=random.randint(2, 20))
                comment = {"in_progress": "Inspection started on site",
                           "on_hold": "Waiting for replacement lock to be purchased",
                           "completed": "Fault fixed and tested"}[step]
                db.session.add(StatusLog(request=sr, old_status=prev, new_status=step, comment=comment,
                                         changed_by_id=officer.id, created_at=t))
                prev = step
            sr.status = status
            if status == "completed":
                sr.completed_at = t
            db.session.add(Notification(user_id=requester.id, request_id=sr.id, created_at=t,
                                        message=f"{sr.reference} is now {status.replace('_', ' ').title()}"))
        sr.updated_at = t
    db.session.commit()


def register_cli(app):
    @app.cli.command("seed")
    def seed_command():
        """Create tables and load demo data."""
        db.create_all()
        seed_demo()
        print("Database seeded.")
