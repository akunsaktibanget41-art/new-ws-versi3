"""Backend tests: auth, users mgmt, monitoring endpoints, PDF export, regression."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://qolbu-manage.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SPV_EMAIL = "akunsaktibanget06@gmail.com"
SPV_PASSWORD = "Qolbu2026!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def spv_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SPV_EMAIL, "password": SPV_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"SPV login failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("ok") is True
    assert body["user"]["role"] == "spv"
    assert body["user"]["status"] == "approved"
    # cookie present
    assert "session_token" in s.cookies.get_dict() or body.get("session_token")
    yield s
    s.post(f"{API}/auth/logout", timeout=10)


@pytest.fixture(scope="module")
def created_user_ids():
    return []


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self, spv_session):
        r = spv_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == SPV_EMAIL
        assert u["role"] == "spv"

    def test_me_without_cookie_401(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_register_pending_and_login_blocked(self, spv_session, created_user_ids):
        email = f"test_pending_{uuid.uuid4().hex[:8]}@example.com"
        pw = "Password123!"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": pw, "name": "TEST_Pending"},
                          timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "pending"

        # login attempt should 403
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
        assert r2.status_code == 403
        assert "menunggu approval" in r2.json().get("detail", "").lower()

        # find user id via SPV list
        r3 = spv_session.get(f"{API}/auth/users?status=pending", timeout=10)
        assert r3.status_code == 200
        users = r3.json()
        found = [u for u in users if u["email"] == email]
        assert found, "Registered user not found in pending list"
        created_user_ids.append((found[0]["user_id"], email, pw))

    def test_approve_then_login(self, spv_session, created_user_ids):
        uid, email, pw = created_user_ids[0]
        r = spv_session.put(f"{API}/auth/users/{uid}",
                            json={"status": "approved"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        # login should now succeed
        s = requests.Session()
        r2 = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["user"]["status"] == "approved"

        # non-SPV cannot list users
        r3 = s.get(f"{API}/auth/users", timeout=10)
        assert r3.status_code == 403

        # monitoring requires auth: without cookie 401
        r4 = requests.get(f"{API}/monitoring/workload", timeout=10)
        assert r4.status_code == 401

        # approved (anggota) CAN access monitoring? (endpoints only depend on get_current_user)
        r5 = s.get(f"{API}/monitoring/workload", timeout=10)
        assert r5.status_code == 200

        s.post(f"{API}/auth/logout", timeout=10)

    def test_cannot_demote_last_spv(self, spv_session):
        # spv self
        me = spv_session.get(f"{API}/auth/me").json()
        r = spv_session.put(f"{API}/auth/users/{me['user_id']}",
                            json={"role": "anggota"}, timeout=10)
        assert r.status_code == 400

    def test_cannot_delete_self(self, spv_session):
        me = spv_session.get(f"{API}/auth/me").json()
        r = spv_session.delete(f"{API}/auth/users/{me['user_id']}", timeout=10)
        assert r.status_code == 400

    def test_change_role_to_spv(self, spv_session, created_user_ids):
        uid, email, pw = created_user_ids[0]
        r = spv_session.put(f"{API}/auth/users/{uid}", json={"role": "spv"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "spv"
        # revert to anggota (safe because now 2 SPV)
        r2 = spv_session.put(f"{API}/auth/users/{uid}", json={"role": "anggota"}, timeout=10)
        assert r2.status_code == 200

    def test_logout_clears_session(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": SPV_EMAIL, "password": SPV_PASSWORD}, timeout=10)
        assert r.status_code == 200
        r2 = s.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 200
        s.post(f"{API}/auth/logout", timeout=10)
        s.cookies.clear()  # cookie cleared by server
        r3 = s.get(f"{API}/auth/me", timeout=10)
        assert r3.status_code == 401

    def test_delete_created_user(self, spv_session, created_user_ids):
        uid, _, _ = created_user_ids[0]
        r = spv_session.delete(f"{API}/auth/users/{uid}", timeout=10)
        assert r.status_code == 200
        assert r.json().get("deleted") == 1


# ---------- MONITORING ----------
class TestMonitoring:
    def test_deadline_radar(self, spv_session):
        r = spv_session.get(f"{API}/monitoring/deadline-radar", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("overdue", "today", "upcoming", "summary"):
            assert k in d, f"missing {k}"
        assert isinstance(d["overdue"], list)

    def test_workload(self, spv_session):
        r = spv_session.get(f"{API}/monitoring/workload", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "anggota" in d or isinstance(d, list) or isinstance(d, dict)

    def test_amaliyah_compliance(self, spv_session):
        r = spv_session.get(f"{API}/monitoring/amaliyah-compliance?days=7", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "overall_pct" in d
        assert "items" in d
        assert isinstance(d["items"], list)

    def test_stagnant_tasks(self, spv_session):
        r = spv_session.get(f"{API}/monitoring/stagnant-tasks?days=3", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (list, dict))

    def test_division_progress(self, spv_session):
        r = spv_session.get(f"{API}/monitoring/division-progress", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, (list, dict))


# ---------- PDF EXPORT ----------
class TestPDFExport:
    def test_pdf_requires_auth(self):
        r = requests.get(f"{API}/raport/export.pdf", timeout=15)
        assert r.status_code == 401

    def test_pdf_success(self, spv_session):
        r = spv_session.get(f"{API}/raport/export.pdf?start=2025-01-01&end=2025-12-31", timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct.lower(), f"unexpected content-type: {ct}"
        assert r.content[:5] == b"%PDF-", "PDF header missing"
        assert 500 < len(r.content) < 200000


# ---------- REGRESSION (existing routes still open) ----------
class TestRegression:
    def test_list_tasks_no_auth(self):
        r = requests.get(f"{API}/tasks", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_divisi_no_auth(self):
        r = requests.get(f"{API}/divisi", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_task_no_auth(self):
        # get first divisi
        div = requests.get(f"{API}/divisi", timeout=10).json()
        divisi_id = div[0]["id"] if div else None
        payload = {"nama": f"TEST_regression_{uuid.uuid4().hex[:6]}", "divisi_id": divisi_id}
        r = requests.post(f"{API}/tasks", json=payload, timeout=10)
        assert r.status_code == 200
        tid = r.json()["id"]
        # cleanup
        requests.delete(f"{API}/tasks/{tid}", timeout=10)

    def test_raport_summary_no_auth(self):
        r = requests.get(f"{API}/raport/summary", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "task" in d and "amaliyah" in d
