"""Iter8 backend tests: rebrand to 'Workspace Ruang Sanad' + PDF logo embed + regressions."""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sanad-webapp.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SPV_EMAIL = "akunsaktibanget06@gmail.com"
SPV_PASSWORD = "Qolbu2026!"

CREATED = {"divisi": [], "anggota": [], "tasks": [], "users": []}


@pytest.fixture(scope="module")
def spv_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SPV_EMAIL, "password": SPV_PASSWORD})
    assert r.status_code == 200, f"SPV login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("ok") is True
    assert any(c.name == "session_token" for c in s.cookies)
    yield s
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
    s = spv_session
    suffix = uuid.uuid4().hex[:6]
    r = s.post(f"{API}/divisi", json={"nama": f"itest_div8_{suffix}", "warna": "#0ea5e9", "urutan": 998})
    assert r.status_code in (200, 201), r.text
    div = r.json(); CREATED["divisi"].append(div["id"])
    r = s.post(f"{API}/anggota", json={"nama": f"itest_ang8_{suffix}", "divisi_id": div["id"], "urutan": 1})
    assert r.status_code in (200, 201), r.text
    ang = r.json(); CREATED["anggota"].append(ang["id"])
    yday = (date.today() - timedelta(days=1)).isoformat()
    r = s.post(f"{API}/tasks", json={
        "nama": f"itest_task8_{suffix}", "divisi_id": div["id"], "divisi": div["nama"],
        "penerima_tugas_id": ang["id"], "penerima_tugas": ang["nama"],
        "status": "BELUM_MULAI", "kategori": "HARIAN", "deadline": yday,
    })
    assert r.status_code in (200, 201), r.text
    task = r.json(); CREATED["tasks"].append(task["id"])
    return {"divisi": div, "anggota": ang, "task": task}


# ---- Rebrand ----
def test_root_rebrand_workspace_ruang_sanad():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "Workspace Ruang Sanad API", f"got: {data}"
    assert data.get("version") == "1.2", f"got: {data}"


# ---- Logo asset present ----
def test_logo_asset_exists():
    p = "/app/backend/assets/ruang_sanad_logo.png"
    assert os.path.exists(p), f"logo missing at {p}"
    assert os.path.getsize(p) > 50_000, "logo file too small; PNG likely corrupted"


# ---- PDF: tim ----
def test_pdf_tim_has_embedded_logo(spv_session):
    r = spv_session.get(f"{API}/raport/export.pdf")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content[:4] == b"%PDF"
    size = len(r.content)
    # With embedded PNG logo (~245KB), PDF should be well above 100KB
    assert size > 100_000, f"PDF too small ({size} bytes) — logo likely NOT embedded"
    cd = r.headers.get("content-disposition", "")
    assert "raport-ruang-sanad-tim-" in cd, f"filename should contain 'raport-ruang-sanad-tim-': {cd}"


# ---- PDF: per-anggota ----
def test_pdf_per_anggota_has_embedded_logo_and_slug(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    ang_nama = seed_data["anggota"]["nama"]
    r = spv_session.get(f"{API}/raport/export.pdf?anggota_id={aid}")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/pdf")
    size = len(r.content)
    assert size > 100_000, f"PDF too small ({size} bytes) — logo not embedded"
    cd = r.headers.get("content-disposition", "")
    slug = ang_nama.lower().replace(" ", "-")
    assert "raport-ruang-sanad-" in cd, f"filename prefix wrong: {cd}"
    assert slug in cd, f"filename should include anggota slug '{slug}': {cd}"


# ---- PDF: non-SPV forbidden ----
@pytest.fixture(scope="module")
def anggota_session(spv_session):
    suffix = uuid.uuid4().hex[:6]
    email = f"itest_ang8_{suffix}@example.com"
    pw = "Testing123!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": f"itest_ang8_{suffix}"})
    assert r.status_code == 200, r.text
    r = spv_session.get(f"{API}/auth/users?status=pending")
    assert r.status_code == 200
    target = next((u for u in r.json() if u["email"] == email), None)
    assert target
    uid = target["user_id"]; CREATED["users"].append(uid)
    r = spv_session.put(f"{API}/auth/users/{uid}", json={"status": "approved"})
    assert r.status_code == 200
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    return s


def test_pdf_forbidden_non_spv(anggota_session):
    r = anggota_session.get(f"{API}/raport/export.pdf")
    assert r.status_code == 403, f"expected 403, got {r.status_code}"


# ---- Regressions ----
def test_reg_raport_summary_per_anggota(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    r = spv_session.get(f"{API}/raport/summary?anggota_id={aid}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["anggota"]["id"] == aid
    assert isinstance(data.get("tasks_list"), list)
    assert "combined_score" in data
    assert data["task"]["total"] >= 1


def test_reg_dashboard_digest(spv_session, seed_data):
    r = spv_session.get(f"{API}/dashboard/digest")
    assert r.status_code == 200
    data = r.json()
    for k in ("overdue", "today", "upcoming", "stagnant", "counts"):
        assert k in data
    tid = seed_data["task"]["id"]
    assert any(t.get("id") == tid for t in data["overdue"])


def test_reg_monitoring_user(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    r = spv_session.get(f"{API}/monitoring/user/{aid}?days=7")
    assert r.status_code == 200
    data = r.json()
    for k in ("anggota", "deadline", "workload", "stagnant", "amaliyah"):
        assert k in data


def test_reg_raport_note_global_and_per_anggota(spv_session, seed_data):
    aid = seed_data["anggota"]["id"]
    r = spv_session.put(f"{API}/raport/note", json={"catatan_spv": "iter8-global", "rekomendasi": "NETRAL"})
    assert r.status_code == 200
    r = spv_session.put(f"{API}/raport/note?anggota_id={aid}", json={"catatan_spv": "iter8-ang", "rekomendasi": "REWARD"})
    assert r.status_code == 200
    assert r.json()["catatan_spv"] == "iter8-ang"
    r = spv_session.get(f"{API}/raport/summary?anggota_id={aid}")
    assert r.json()["spv_note"]["catatan_spv"] == "iter8-ang"
    r = spv_session.get(f"{API}/raport/summary")
    assert r.json()["spv_note"]["catatan_spv"] == "iter8-global"


def test_reg_tasks_crud(spv_session, seed_data):
    tid = seed_data["task"]["id"]
    new_dl = (date.today() + timedelta(days=3)).isoformat()
    r = spv_session.put(f"{API}/tasks/{tid}", json={"deadline": new_dl})
    assert r.status_code == 200
    assert r.json().get("deadline") == new_dl
    r = spv_session.put(f"{API}/tasks/{tid}", json={"status": "SELESAI"})
    assert r.status_code == 200
    assert r.json().get("status") == "SELESAI"


# ---- PDF content sniff: look for 'Workspace Ruang Sanad' string in raw bytes ----
def test_pdf_contains_workspace_ruang_sanad_string(spv_session):
    r = spv_session.get(f"{API}/raport/export.pdf")
    assert r.status_code == 200
    # PDF text may be encoded but reportlab typically writes strings in Tj ops as-is (with parens/hex).
    # Check for either literal or byte-encoded form.
    raw = r.content
    found = (b"Workspace Ruang Sanad" in raw) or (b"Ruang Sanad" in raw)
    assert found, "PDF does not contain expected brand string 'Workspace Ruang Sanad' or 'Ruang Sanad'"
