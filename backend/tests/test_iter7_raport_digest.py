"""Iter7 backend tests: rebrand, digest, monitoring/user, raport summary/PDF/note, RBAC."""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sanad-webapp.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SPV_EMAIL = "akunsaktibanget06@gmail.com"
SPV_PASSWORD = "Qolbu2026!"

# Track created resources for cleanup
CREATED = {"divisi": [], "anggota": [], "tasks": [], "users": []}


@pytest.fixture(scope="module")
def spv_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SPV_EMAIL, "password": SPV_PASSWORD})
    assert r.status_code == 200, f"SPV login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("ok") is True
    assert data.get("status") == "approved"
    # session cookie should be set
    assert any(c.name == "session_token" for c in s.cookies), "session_token cookie not set"
    yield s
    # cleanup
    for tid in CREATED["tasks"]:
        try: s.delete(f"{API}/tasks/{tid}")
        except Exception: pass
    for aid in CREATED["anggota"]:
        try: s.delete(f"{API}/anggota/{aid}")
        except Exception: pass
    for did in CREATED["divisi"]:
        try: s.delete(f"{API}/divisi/{did}")
        except Exception: pass
    for uid in CREATED["users"]:
        try: s.delete(f"{API}/auth/users/{uid}")
        except Exception: pass


@pytest.fixture(scope="module")
def seed_data(spv_session):
    """Create itest_ divisi + anggota + overdue task."""
    s = spv_session
    suffix = uuid.uuid4().hex[:6]
    # divisi
    r = s.post(f"{API}/divisi", json={"nama": f"itest_div_{suffix}", "warna": "#059669", "urutan": 999})
    assert r.status_code in (200, 201), r.text
    div = r.json()
    CREATED["divisi"].append(div["id"])
    # anggota
    r = s.post(f"{API}/anggota", json={"nama": f"itest_ang_{suffix}", "divisi_id": div["id"], "urutan": 1})
    assert r.status_code in (200, 201), r.text
    ang = r.json()
    CREATED["anggota"].append(ang["id"])
    # overdue task (deadline yesterday)
    yday = (date.today() - timedelta(days=1)).isoformat()
    r = s.post(f"{API}/tasks", json={
        "nama": f"itest_task_{suffix}",
        "divisi_id": div["id"],
        "divisi": div["nama"],
        "penerima_tugas_id": ang["id"],
        "penerima_tugas": ang["nama"],
        "status": "BELUM_MULAI",
        "kategori": "HARIAN",
        "deadline": yday,
    })
    assert r.status_code in (200, 201), r.text
    task = r.json()
    CREATED["tasks"].append(task["id"])
    return {"divisi": div, "anggota": ang, "task": task, "yday": yday}


# ============ Rebrand ============
def test_root_rebrand():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "Workspace Ruang Sanad API"
    assert data.get("version") == "1.2"


# ============ SPV Login (covered in fixture but explicit test) ============
def test_spv_login_sets_cookie():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SPV_EMAIL, "password": SPV_PASSWORD})
    assert r.status_code == 200
    assert r.json().get("ok") is True
    assert any(c.name == "session_token" for c in s.cookies)


# ============ Dashboard Digest ============
def test_dashboard_digest_spv(spv_session, seed_data):
    r = spv_session.get(f"{API}/dashboard/digest")
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("overdue", "today", "upcoming", "stagnant", "counts"):
        assert k in data, f"missing key {k}"
    for k in ("overdue", "today", "upcoming", "stagnant"):
        assert isinstance(data["counts"][k], int)
        assert isinstance(data[k], list)
    # Our overdue task should show up
    task_id = seed_data["task"]["id"]
    assert any(t.get("id") == task_id for t in data["overdue"]), "seeded overdue task not in digest.overdue"
    # decoration keys
    for t in data["overdue"]:
        assert "penerima_nama" in t and "divisi_nama" in t


# ============ Monitoring User ============
def test_monitoring_user(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    r = spv_session.get(f"{API}/monitoring/user/{aid}?days=7")
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("anggota", "deadline", "workload", "stagnant", "amaliyah"):
        assert k in data, f"missing key {k}"
    assert data["anggota"]["id"] == aid
    for k in ("overdue", "today", "upcoming", "summary"):
        assert k in data["deadline"]
    # overdue task should appear
    task_id = seed_data["task"]["id"]
    assert any(t.get("id") == task_id for t in data["deadline"]["overdue"])
    assert data["deadline"]["summary"]["overdue"] >= 1
    # workload
    for k in ("aktif", "selesai", "proses", "kendala", "belum", "total", "pct"):
        assert k in data["workload"]


# ============ Raport Summary (per-anggota) ============
def test_raport_summary_per_anggota(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    r = spv_session.get(f"{API}/raport/summary?anggota_id={aid}&start=&end=")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "combined_score" in data
    assert "task" in data and "amaliyah" in data
    assert data["task"]["total"] >= 1  # at least the seeded one
    assert data["task"]["overdue"] >= 1
    assert "anggota" in data and data["anggota"]["id"] == aid
    assert "tasks_list" in data and isinstance(data["tasks_list"], list)
    # all tasks in list should belong to this anggota
    for t in data["tasks_list"]:
        assert t.get("penerima_tugas_id") == aid


def test_raport_summary_global(spv_session):
    r = spv_session.get(f"{API}/raport/summary")
    assert r.status_code == 200
    data = r.json()
    assert "combined_score" in data
    assert "task" in data and "amaliyah" in data


# ============ Raport PDF Export ============
def test_raport_pdf_per_anggota(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    ang_nama = seed_data["anggota"]["nama"]
    r = spv_session.get(f"{API}/raport/export.pdf?anggota_id={aid}&start=&end=")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert len(r.content) > 3000, f"PDF too small: {len(r.content)} bytes"
    assert r.content[:4] == b"%PDF"
    cd = r.headers.get("content-disposition", "")
    slug = ang_nama.lower().replace(" ", "-")
    assert slug in cd, f"filename should include slug '{slug}': {cd}"


def test_raport_pdf_tim(spv_session):
    r = spv_session.get(f"{API}/raport/export.pdf")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert len(r.content) > 3000
    assert r.content[:4] == b"%PDF"
    assert "tim" in r.headers.get("content-disposition", "")


# ============ Raport Note (per-anggota vs global) ============
def test_raport_note_per_anggota_isolated(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    # Set global first
    r = spv_session.put(f"{API}/raport/note", json={"catatan_spv": "global-note-itest", "rekomendasi": "NETRAL"})
    assert r.status_code == 200, r.text
    # Set per-anggota
    r = spv_session.put(f"{API}/raport/note?anggota_id={aid}", json={"catatan_spv": "ang-note-itest", "rekomendasi": "REWARD"})
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["id"] == f"anggota:{aid}"
    assert doc["catatan_spv"] == "ang-note-itest"
    # Verify per-anggota via summary
    r = spv_session.get(f"{API}/raport/summary?anggota_id={aid}")
    assert r.json()["spv_note"]["catatan_spv"] == "ang-note-itest"
    # Verify global still holds original
    r = spv_session.get(f"{API}/raport/summary")
    assert r.json()["spv_note"]["catatan_spv"] == "global-note-itest"


# ============ Task actions (SPV) ============
def test_task_actions_status_and_deadline(spv_session, seed_data):
    tid = seed_data["task"]["id"]
    # bump deadline +7
    new_dl = (date.today() + timedelta(days=7)).isoformat()
    r = spv_session.put(f"{API}/tasks/{tid}", json={"deadline": new_dl})
    assert r.status_code == 200, r.text
    assert r.json().get("deadline") == new_dl
    # mark SELESAI
    r = spv_session.put(f"{API}/tasks/{tid}", json={"status": "SELESAI"})
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "SELESAI"


# ============ RBAC: anggota gets 403 on SPV-only endpoints ============
@pytest.fixture(scope="module")
def anggota_session(spv_session):
    """Register + approve an anggota user, then log in."""
    suffix = uuid.uuid4().hex[:6]
    email = f"itest_ang_{suffix}@example.com"
    pw = "Testing123!"
    # Register (public)
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": f"itest_ang_{suffix}"})
    assert r.status_code == 200, r.text
    # Find user_id via SPV
    r = spv_session.get(f"{API}/auth/users?status=pending")
    assert r.status_code == 200
    target = next((u for u in r.json() if u["email"] == email), None)
    assert target, "just-registered user not found"
    uid = target["user_id"]
    CREATED["users"].append(uid)
    # Approve via SPV
    r = spv_session.put(f"{API}/auth/users/{uid}", json={"status": "approved"})
    assert r.status_code == 200, r.text
    # Login
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    return s


def test_anggota_forbidden_on_raport_pdf(anggota_session):
    r = anggota_session.get(f"{API}/raport/export.pdf")
    assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


def test_anggota_forbidden_on_raport_note(anggota_session):
    r = anggota_session.put(f"{API}/raport/note", json={"catatan_spv": "x", "rekomendasi": "NETRAL"})
    assert r.status_code == 403


def test_anggota_digest_empty(anggota_session):
    """Non-SPV without divisi link should get empty digest, not 500."""
    r = anggota_session.get(f"{API}/dashboard/digest")
    assert r.status_code == 200
    data = r.json()
    assert data["counts"]["overdue"] == 0
    assert data["overdue"] == []
