"""Service request CRUD, role scoping, search/filter/pagination and uploads."""
import io


def test_student_can_create_request(client, headers, category_id):
    res = client.post("/api/requests", headers=headers["student"], json={
        "title": "Socket sparking", "description": "The wall socket sparks when used.",
        "location": "Hall 3 Room B12", "category_id": category_id, "priority": "urgent"})
    assert res.status_code == 201
    r = res.json["request"]
    assert r["reference"].startswith("SR-")
    assert r["status"] == "pending"
    assert r["logs"][0]["new_status"] == "pending"


def test_create_request_validation(client, headers):
    res = client.post("/api/requests", headers=headers["student"], json={"title": "x"})
    assert res.status_code == 422
    assert {"title", "description", "location", "category_id"} <= set(res.json["details"])


def test_create_request_invalid_category(client, headers):
    res = client.post("/api/requests", headers=headers["student"], json={
        "title": "Broken desk", "description": "Desk leg is broken badly.",
        "location": "Lab 1", "category_id": 9999})
    assert res.status_code == 422 and "category_id" in res.json["details"]


def test_officer_and_admin_cannot_submit_requests(client, headers, category_id):
    body = {"title": "Broken desk", "description": "Desk leg is broken badly.",
            "location": "Lab 1", "category_id": category_id}
    assert client.post("/api/requests", json=body, headers=headers["officer"]).status_code == 403
    assert client.post("/api/requests", json=body, headers=headers["admin"]).status_code == 403


def test_requesters_only_see_their_own_requests(client, headers, make_request):
    mine = make_request("student")
    make_request("student2")
    listing = client.get("/api/requests", headers=headers["student"]).json
    assert listing["total"] == 1 and listing["items"][0]["id"] == mine["id"]
    # Another student cannot open it
    assert client.get(f"/api/requests/{mine['id']}", headers=headers["student2"]).status_code == 404
    # Admin sees everything
    assert client.get("/api/requests", headers=headers["admin"]).json["total"] == 2


def test_officer_sees_only_assigned_requests(client, headers, make_request, app):
    from tests.conftest import user_id
    r1 = make_request()
    make_request()
    client.post(f"/api/requests/{r1['id']}/assign", headers=headers["admin"],
                json={"officer_id": user_id(app, "officer@test.edu")})
    listing = client.get("/api/requests", headers=headers["officer"]).json
    assert [i["id"] for i in listing["items"]] == [r1["id"]]
    assert client.get("/api/requests", headers=headers["officer2"]).json["total"] == 0


def test_search_filter_and_pagination(client, headers, make_request):
    for i in range(12):
        make_request(title=f"Leaking pipe number {i}", priority="low" if i % 2 else "urgent")
    make_request(title="Projector not working", location="Lecture Theatre 2")
    h = headers["admin"]
    page1 = client.get("/api/requests?per_page=5&page=1", headers=h).json
    assert page1["total"] == 13 and page1["pages"] == 3 and len(page1["items"]) == 5
    page3 = client.get("/api/requests?per_page=5&page=3", headers=h).json
    assert len(page3["items"]) == 3
    assert client.get("/api/requests?q=projector", headers=h).json["total"] == 1
    assert client.get("/api/requests?q=theatre", headers=h).json["total"] == 1
    assert client.get("/api/requests?priority=urgent", headers=h).json["total"] == 6
    assert client.get("/api/requests?status=completed", headers=h).json["total"] == 0
    first = client.get("/api/requests?sort=priority", headers=h).json["items"][0]
    assert first["priority"] == "urgent"


def test_requester_can_edit_only_while_pending(client, headers, make_request, app):
    from tests.conftest import user_id
    r = make_request()
    ok = client.patch(f"/api/requests/{r['id']}", headers=headers["student"], json={"location": "Hall 2"})
    assert ok.status_code == 200 and ok.json["request"]["location"] == "Hall 2"
    client.post(f"/api/requests/{r['id']}/assign", headers=headers["admin"],
                json={"officer_id": user_id(app, "officer@test.edu")})
    late = client.patch(f"/api/requests/{r['id']}", headers=headers["student"], json={"location": "Hall 3"})
    assert late.status_code == 409


def test_requester_can_cancel_pending_request_with_reason(client, headers, make_request):
    r = make_request()
    no_reason = client.post(f"/api/requests/{r['id']}/status", headers=headers["student"], json={"status": "cancelled"})
    assert no_reason.status_code == 422
    res = client.post(f"/api/requests/{r['id']}/status", headers=headers["student"],
                      json={"status": "cancelled", "comment": "Fixed itself"})
    assert res.status_code == 200 and res.json["request"]["status"] == "cancelled"


def test_admin_can_delete_request(client, headers, make_request):
    r = make_request()
    assert client.delete(f"/api/requests/{r['id']}", headers=headers["student"]).status_code == 403
    assert client.delete(f"/api/requests/{r['id']}", headers=headers["admin"]).status_code == 200
    assert client.get(f"/api/requests/{r['id']}", headers=headers["admin"]).status_code == 404


PNG = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
       b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82")


def test_upload_and_download_evidence_photo(client, headers, make_request):
    r = make_request()
    res = client.post(f"/api/requests/{r['id']}/attachments", headers=headers["student"],
                      data={"files": (io.BytesIO(PNG), "leak.png", "image/png")},
                      content_type="multipart/form-data")
    assert res.status_code == 201
    att = res.json["attachments"][0]
    img = client.get(att["url"], headers=headers["student"])
    assert img.status_code == 200 and img.data == PNG and img.mimetype == "image/png"
    # Other requesters cannot fetch it
    assert client.get(att["url"], headers=headers["student2"]).status_code == 404


def test_upload_rejects_non_images(client, headers, make_request):
    r = make_request()
    res = client.post(f"/api/requests/{r['id']}/attachments", headers=headers["student"],
                      data={"files": (io.BytesIO(b"MZ..."), "virus.exe", "application/octet-stream")},
                      content_type="multipart/form-data")
    assert res.status_code == 422


def test_dashboard_stats_are_scoped(client, headers, make_request):
    make_request("student")
    make_request("student")
    make_request("staff")
    assert client.get("/api/requests/stats", headers=headers["student"]).json["total"] == 2
    stats = client.get("/api/requests/stats", headers=headers["admin"]).json
    assert stats["total"] == 3 and stats["by_status"]["pending"] == 3 and stats["open"] == 3
