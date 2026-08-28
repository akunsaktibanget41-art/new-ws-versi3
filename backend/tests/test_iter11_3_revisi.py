"""Backend tests for iterasi 11.3 REVISI feature (session-cookie based auth)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workspace-iterasi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "spv": ("admin@ruangsanad.id", "AdminSanad2025!"),
    "budi": ("budi@test.id", "budi12345"),
    "rina": ("rina@test.id", "rina12345"),
    "siti": ("siti@test.id", "siti12345"),
}


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def sess():
    return {k: _login(*v) for k, v in CREDS.items()}


def _find_task(s, title_contains):
    r = s.get(f"{API}/tasks", timeout=30)
    assert r.status_code == 200, r.text
    for t in r.json():
        if title_contains.lower() in (t.get("nama") or "").lower():
            return t
    return None


def test_budi_can_request_revisi(sess):
    task = _find_task(sess["budi"], "Konten IG lintas divisi")
    assert task, "fixture task not found"
    before = task.get("revisi_count") or 0
    r = sess["budi"].post(f"{API}/tasks/{task['id']}/revisi",
                          json={"catatan": "Tolong perbaiki caption paragraf 2 (pytest)"}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "REVISI"
    assert d["revisi_catatan"] == "Tolong perbaiki caption paragraf 2 (pytest)"
    assert d["revisi_count"] == before + 1
    assert d.get("revisi_at")


def test_rina_sees_revisi(sess):
    task = _find_task(sess["rina"], "Konten IG lintas divisi")
    assert task
    assert task["status"] == "REVISI"
    assert "paragraf 2" in (task.get("revisi_catatan") or "")


def test_siti_non_pemberi_forbidden(sess):
    task = _find_task(sess["budi"], "Konten IG lintas divisi")
    r = sess["siti"].post(f"{API}/tasks/{task['id']}/revisi",
                          json={"catatan": "blocked"}, timeout=30)
    assert r.status_code == 403


def test_penerima_forbidden(sess):
    task = _find_task(sess["rina"], "Konten IG lintas divisi")
    r = sess["rina"].post(f"{API}/tasks/{task['id']}/revisi",
                          json={"catatan": "try"}, timeout=30)
    assert r.status_code == 403


def test_spv_can_revisi(sess):
    task = _find_task(sess["spv"], "Konten IG lintas divisi")
    assert task
    r = sess["spv"].post(f"{API}/tasks/{task['id']}/revisi",
                         json={"catatan": "SPV minta revisi (pytest)"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "REVISI"


def test_rina_updates_status_back(sess):
    task = _find_task(sess["rina"], "Konten IG lintas divisi")
    r = sess["rina"].put(f"{API}/tasks/{task['id']}",
                         json={"status": "SELESAI", "link_hasil": "https://example.com/v3"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "SELESAI"


def test_empty_catatan_rejected(sess):
    task = _find_task(sess["budi"], "Konten IG lintas divisi")
    r = sess["budi"].post(f"{API}/tasks/{task['id']}/revisi",
                          json={"catatan": ""}, timeout=30)
    assert r.status_code in (400, 422)
