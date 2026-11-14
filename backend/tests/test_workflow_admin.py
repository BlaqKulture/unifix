"""Assignment and status workflow, notifications, admin management,
reports/exports and audit trail."""
from tests.conftest import user_id


def assign(client, headers, req_id, app, email="officer@test.edu"):
    return client.post(f"/api/requests/{req_id}/assign", headers=headers["admin"],
                       json={"officer_id": user_id(app, email), "note": "Urgent please"})


def status(client, h, req_id, new, comment=None):
    body = {"status": new}
    if comment:
        body["comment"] = comment
    return client.post(f"/api/requests/{req_id}/status", headers=h, json=body)


# ---------- assignment & workflow ----------

def test_admin_assigns_request_and_users_are_notified(client, headers, make_request, app):
    r = make_request()
    res = assign(client, headers, r["id"], app)
    assert res.status_code == 200
    assert res.json["request"]["status"] == "assigned"
    assert res.json["request"]["assigned_officer"]["email"] == "officer@test.edu"
    officer_notes = client.get("/api/notifications", headers=headers["officer"]).json
    student_notes = client.get("/api/notifications", headers=headers["student"]).json
    assert officer_notes["unread_count"] == 1 and "assigned" in officer_notes["items"][0]["message"]
    assert student_notes["unread_count"] == 1


def test_only_admin_can_assign(client, headers, make_request, app):
    r = make_request()
    res = client.post(f"/api/requests/{r['id']}/assign", headers=headers["officer"],
                      json={"officer_id": user_id(app, "officer@test.edu")})
    assert res.status_code == 403


def test_cannot_assign_to_non_officer(client, headers, make_request, app):
    r = make_request()
    res = assign(client, headers, r["id"], app, email="student2@test.edu")
    assert res.status_code == 422


def test_full_officer_workflow_to_completion(client, headers, make_request, app):
    r = make_request()
    assign(client, headers, r["id"], app)
    h = headers["officer"]
    assert status(client, h, r["id"], "in_progress").status_code == 200
    assert status(client, h, r["id"], "on_hold").status_code == 422  # needs a reason
    assert status(client, h, r["id"], "on_hold", "Waiting for parts").status_code == 200
    assert status(client, h, r["id"], "in_progress").status_code == 200
    done = status(client, h, r["id"], "completed", "Pipe replaced")
    assert done.status_code == 200
    req = done.json["request"]
    assert req["status"] == "completed" and req["completed_at"]
    assert [log["new_status"] for log in req["logs"]] == [
        "pending", "assigned", "in_progress", "on_hold", "in_progress", "completed"]
    # Closed requests cannot be changed by officers any more
    assert status(client, h, r["id"], "in_progress").status_code == 409


def test_officer_cannot_skip_workflow_steps(client, headers, make_request, app):
    r = make_request()
    assign(client, headers, r["id"], app)
    res = status(client, headers["officer"], r["id"], "completed")
    assert res.status_code == 409


def test_other_officer_cannot_update_request(client, headers, make_request, app):
    r = make_request()
    assign(client, headers, r["id"], app)
    res = status(client, headers["officer2"], r["id"], "in_progress")
    assert res.status_code == 404  # not even visible to them


def test_reassignment_moves_job_to_new_officer(client, headers, make_request, app):
    r = make_request()
    assign(client, headers, r["id"], app)
    res = assign(client, headers, r["id"], app, email="officer2@test.edu")
    assert res.status_code == 200
    assert res.json["request"]["assigned_officer"]["email"] == "officer2@test.edu"
    assert client.get("/api/requests", headers=headers["officer"]).json["total"] == 0
    assert client.get("/api/requests", headers=headers["officer2"]).json["total"] == 1


def test_student_cannot_change_status_of_assigned_request(client, headers, make_request, app):
    r = make_request()
    assign(client, headers, r["id"], app)
    assert status(client, headers["student"], r["id"], "completed").status_code == 403


def test_notifications_mark_read(client, headers, make_request, app):
    r = make_request()
    assign(client, headers, r["id"], app)
    h = headers["officer"]
    note_id = client.get("/api/notifications", headers=h).json["items"][0]["id"]
    assert client.post(f"/api/notifications/{note_id}/read", headers=h).status_code == 200
    assert client.get("/api/notifications", headers=h).json["unread_count"] == 0
    # Cannot read someone else's notification
    assert client.post(f"/api/notifications/{note_id}/read", headers=headers["student"]).status_code == 404


# ---------- admin: users & categories ----------

def test_non_admin_cannot_manage_users(client, headers):
    assert client.get("/api/users", headers=headers["student"]).status_code == 403
    assert client.get("/api/users", headers=headers["officer"]).status_code == 403


def test_admin_creates_officer_and_lists_users(client, headers):
    res = client.post("/api/users", headers=headers["admin"], json={
        "full_name": "New Officer", "email": "newofficer@test.edu", "password": "Officer123", "role": "officer"})
    assert res.status_code == 201
    officers = client.get("/api/users?role=officer", headers=headers["admin"]).json
    assert officers["total"] == 3
    found = client.get("/api/users?q=newofficer", headers=headers["admin"]).json
    assert found["items"][0]["role"] == "officer"


def test_admin_deactivates_user(client, headers, app):
    uid = user_id(app, "student2@test.edu")
    res = client.patch(f"/api/users/{uid}", headers=headers["admin"], json={"is_active": False})
    assert res.status_code == 200 and res.json["user"]["is_active"] is False
    login = client.post("/api/auth/login", json={"email": "student2@test.edu", "password": "Password123"})
    assert login.status_code == 403


def test_admin_cannot_deactivate_self(client, headers, app):
    uid = user_id(app, "admin@test.edu")
    res = client.patch(f"/api/users/{uid}", headers=headers["admin"], json={"is_active": False})
    assert res.status_code == 400


def test_category_management(client, headers, make_request):
    h = headers["admin"]
    created = client.post("/api/categories", headers=h, json={"name": "Gardening", "description": "Lawns"})
    assert created.status_code == 201
    cid = created.json["category"]["id"]
    assert client.post("/api/categories", headers=h, json={"name": "gardening"}).status_code == 409
    assert client.patch(f"/api/categories/{cid}", headers=h, json={"is_active": False}).status_code == 200
    names = [c["name"] for c in client.get("/api/categories", headers=headers["student"]).json]
    assert "Gardening" not in names
    assert client.delete(f"/api/categories/{cid}", headers=h).status_code == 200
    # A category in use cannot be deleted
    used = make_request()["category"]["id"]
    assert client.delete(f"/api/categories/{used}", headers=h).status_code == 409


# ---------- reports, exports, audit ----------

def test_report_summary(client, headers, make_request, app):
    r = make_request()
    make_request(priority="low")
    assign(client, headers, r["id"], app)
    s = client.get("/api/reports/summary", headers=headers["admin"]).json
    assert s["total"] == 2
    assert s["by_status"]["assigned"] == 1 and s["by_status"]["pending"] == 1
    assert any(p["assigned"] == 1 for p in s["officer_performance"])
    assert client.get("/api/reports/summary", headers=headers["student"]).status_code == 403


def test_export_csv_and_pdf(client, headers, make_request):
    make_request(title="Broken window latch")
    csv_res = client.get("/api/reports/export?format=csv", headers=headers["admin"])
    assert csv_res.status_code == 200 and csv_res.mimetype == "text/csv"
    assert b"Broken window latch" in csv_res.data
    pdf_res = client.get("/api/reports/export?format=pdf", headers=headers["admin"])
    assert pdf_res.status_code == 200 and pdf_res.data[:4] == b"%PDF"
    assert client.get("/api/reports/export?format=xml", headers=headers["admin"]).status_code == 400


def test_audit_trail_records_actions(client, headers, make_request, app):
    r = make_request()
    assign(client, headers, r["id"], app)
    logs = client.get("/api/audit-logs?per_page=50", headers=headers["admin"]).json["items"]
    actions = {entry["action"] for entry in logs}
    assert {"auth.login", "request.create", "request.assign"} <= actions
    assert client.get("/api/audit-logs", headers=headers["officer"]).status_code == 403


def test_health_and_docs(client):
    health = client.get("/api/health").json
    assert health["status"] == "ok" and health["database"] == "connected"
    assert client.get("/api/openapi.json").status_code == 200
    assert client.get("/api/docs/").status_code == 200


def test_unknown_route_returns_json_404(client):
    res = client.get("/api/does-not-exist")
    assert res.status_code == 404 and res.json["error"]
