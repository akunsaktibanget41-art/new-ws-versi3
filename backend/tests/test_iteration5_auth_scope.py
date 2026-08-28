"""Iteration 5 tests: global auth middleware, role scoping, per-user amaliyah isolation, /api/search."""
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
def spv():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SPV_EMAIL, "password": SPV_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"SPV login failed: {r.text}"
    yield s
    s.post(f"{API}/auth/logout", timeout=10)


@pytest.fixture(scope="module")
def divisi_ids(spv):
    """Ensure we have at least 2 divisi; return list."""
    rows = spv.get(f"{API}/divisi", timeout=10).json()
    created = []
    while len(rows) + len(created) < 2:
        r = spv.post(f"{API}/divisi", json={"nama": f"TEST_div_{uuid.uuid4().hex[:6]}", "warna": "#3b82f6"}, timeout=10)
        assert r.status_code == 200
        created.append(r.json()["id"])
    rows = spv.get(f"{API}/divisi", timeout=10).json()
    ids = [d["id"] for d in rows]
    yield ids
    for cid in created:
        spv.delete(f"{API}/divisi/{cid}", timeout=10)


@pytest.fixture(scope="module")
def anggota_row(spv, divisi_ids):
    """Create a fresh anggota row in divisi_ids[0], cleanup after."""
    r = spv.post(f"{API}/anggota", json={
        "nama": f"TEST_ang_{uuid.uuid4().hex[:6]}",
        "divisi_id": divisi_ids[0],
        "warna": "#22c55e",
    }, timeout=10)
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    yield {"id": aid, "divisi_id": divisi_ids[0]}
    spv.delete(f"{API}/anggota/{aid}", timeout=10)


@pytest.fixture(scope="module")
def linked_anggota_session(spv, anggota_row):
    """Register a user, SPV approves + links to anggota_row, return authenticated session."""
    email = f"test_ang_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Password123!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "TEST_LinkedAng"}, timeout=10)
    assert r.status_code == 200
    # find user
    users = spv.get(f"{API}/auth/users?status=pending", timeout=10).json()
    uid = next(u["user_id"] for u in users if u["email"] == email)
    # approve + link
    r2 = spv.put(f"{API}/auth/users/{uid}", json={"status": "approved", "anggota_id": anggota_row["id"]}, timeout=10)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("anggota_id") == anggota_row["id"]
    # login
    s = requests.Session()
    r3 = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r3.status_code == 200
    yield {"session": s, "user_id": uid, "email": email, "anggota_id": anggota_row["id"], "divisi_id": anggota_row["divisi_id"]}
    s.post(f"{API}/auth/logout", timeout=10)
    spv.delete(f"{API}/auth/users/{uid}", timeout=10)


@pytest.fixture(scope="module")
def unlinked_anggota_session(spv):
    """Approved anggota WITHOUT anggota_id link."""
    email = f"test_unl_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Password123!"
    requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "TEST_Unlinked"}, timeout=10)
    users = spv.get(f"{API}/auth/users?status=pending", timeout=10).json()
    uid = next(u["user_id"] for u in users if u["email"] == email)
    spv.put(f"{API}/auth/users/{uid}", json={"status": "approved"}, timeout=10)
    s = requests.Session()
    r3 = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=10)
    assert r3.status_code == 200
    yield {"session": s, "user_id": uid}
    s.post(f"{API}/auth/logout", timeout=10)
    spv.delete(f"{API}/auth/users/{uid}", timeout=10)


# ---------- 1. AUTH MIDDLEWARE (401 without cookie) ----------
class TestAuthMiddleware:
    @pytest.mark.parametrize("path", [
        "/tasks", "/divisi", "/anggota", "/amaliyah/items", "/amaliyah/entries",
        "/task_lists", "/task_labels", "/raport/summary", "/raport/export.pdf",
        "/monitoring/workload", "/monitoring/deadline-radar", "/search?q=abc",
        "/todo/entries", "/kategori",
    ])
    def test_requires_auth(self, path):
        r = requests.get(f"{API}{path}", timeout=10)
        assert r.status_code == 401, f"{path} expected 401, got {r.status_code}"

    def test_public_paths_open(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 401  # 401 not blocked by middleware
        # register public
        r3 = requests.post(f"{API}/auth/register",
                           json={"email": f"tmp_{uuid.uuid4().hex[:6]}@ex.com", "password": "P@ss1234", "name": "X"},
                           timeout=10)
        assert r3.status_code == 200


# ---------- 2. SPV FULL ACCESS ----------
class TestSPVAccess:
    @pytest.mark.parametrize("path", [
        "/tasks", "/divisi", "/anggota", "/amaliyah/items", "/amaliyah/entries",
        "/task_lists", "/task_labels", "/raport/summary",
        "/monitoring/workload", "/monitoring/deadline-radar",
        "/monitoring/amaliyah-compliance?days=7",
        "/monitoring/stagnant-tasks?days=3",
        "/monitoring/division-progress",
        "/search?q=aa",
    ])
    def test_spv_200(self, spv, path):
        r = spv.get(f"{API}{path}", timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_spv_pdf_export(self, spv):
        r = spv.get(f"{API}/raport/export.pdf", timeout=30)
        assert r.status_code == 200
        assert r.content[:5] == b"%PDF-"


# ---------- 3. ANGGOTA SCOPING ----------
class TestAnggotaScoping:
    def test_linked_sees_only_own_divisi_tasks(self, spv, linked_anggota_session, divisi_ids):
        # SPV creates a task in linked divisi and another in a different divisi
        d_own = linked_anggota_session["divisi_id"]
        d_other = [d for d in divisi_ids if d != d_own][0]
        t1 = spv.post(f"{API}/tasks", json={"nama": f"TEST_own_{uuid.uuid4().hex[:6]}", "divisi_id": d_own}, timeout=10).json()
        t2 = spv.post(f"{API}/tasks", json={"nama": f"TEST_other_{uuid.uuid4().hex[:6]}", "divisi_id": d_other}, timeout=10).json()
        try:
            rows = linked_anggota_session["session"].get(f"{API}/tasks", timeout=10).json()
            ids = [t["id"] for t in rows]
            assert t1["id"] in ids
            assert t2["id"] not in ids
            for t in rows:
                assert t.get("divisi_id") == d_own
        finally:
            spv.delete(f"{API}/tasks/{t1['id']}", timeout=10)
            spv.delete(f"{API}/tasks/{t2['id']}", timeout=10)

    def test_linked_divisi_list_is_one(self, linked_anggota_session):
        rows = linked_anggota_session["session"].get(f"{API}/divisi", timeout=10).json()
        assert len(rows) == 1
        assert rows[0]["id"] == linked_anggota_session["divisi_id"]

    def test_linked_task_lists_scoped(self, linked_anggota_session):
        rows = linked_anggota_session["session"].get(f"{API}/task_lists", timeout=10).json()
        # every task_list should belong to linked divisi
        d_own = linked_anggota_session["divisi_id"]
        for tl in rows:
            assert tl.get("divisi_id") == d_own

    def test_unlinked_tasks_empty(self, unlinked_anggota_session):
        r = unlinked_anggota_session["session"].get(f"{API}/tasks", timeout=10)
        assert r.status_code == 200
        assert r.json() == []

    def test_unlinked_divisi_empty(self, unlinked_anggota_session):
        r = unlinked_anggota_session["session"].get(f"{API}/divisi", timeout=10)
        assert r.status_code == 200
        assert r.json() == []


# ---------- 4. AMALIYAH PER-USER ISOLATION ----------
class TestAmaliyahIsolation:
    def test_amaliyah_entries_isolated(self, spv, linked_anggota_session):
        # ensure an amaliyah item exists
        items = spv.get(f"{API}/amaliyah/items", timeout=10).json()
        assert items, "no amaliyah items available"
        item_id = items[0]["id"]
        # SPV upserts an entry
        r = spv.post(f"{API}/amaliyah/entries", json={
            "item_id": item_id, "tanggal": "2025-06-01", "nilai": 5, "catatan": "TEST_spv"
        }, timeout=10)
        assert r.status_code == 200
        # anggota should NOT see SPV's entry
        rows = linked_anggota_session["session"].get(f"{API}/amaliyah/entries", timeout=10).json()
        for e in rows:
            assert e.get("catatan") != "TEST_spv"
            assert e.get("user_id") == linked_anggota_session["user_id"]

    def test_amaliyah_post_attaches_user_id(self, linked_anggota_session):
        items = linked_anggota_session["session"].get(f"{API}/amaliyah/items", timeout=10).json()
        assert items
        r = linked_anggota_session["session"].post(f"{API}/amaliyah/entries", json={
            "item_id": items[0]["id"], "tanggal": "2025-06-02", "nilai": 1
        }, timeout=10)
        assert r.status_code == 200
        assert r.json().get("user_id") == linked_anggota_session["user_id"]


# ---------- 5. SPV-ONLY GUARDS (403 for anggota) ----------
class TestSPVOnlyGuards:
    def test_monitoring_403_for_anggota(self, linked_anggota_session):
        for path in ["/monitoring/workload", "/monitoring/deadline-radar",
                     "/monitoring/amaliyah-compliance?days=7"]:
            r = linked_anggota_session["session"].get(f"{API}{path}", timeout=10)
            assert r.status_code == 403, f"{path} anggota expected 403 got {r.status_code}"

    def test_users_list_403_for_anggota(self, linked_anggota_session):
        r = linked_anggota_session["session"].get(f"{API}/auth/users", timeout=10)
        assert r.status_code == 403

    def test_raport_pdf_403_for_anggota(self, linked_anggota_session):
        r = linked_anggota_session["session"].get(f"{API}/raport/export.pdf", timeout=15)
        assert r.status_code == 403

    def test_amaliyah_items_cud_403(self, linked_anggota_session):
        s = linked_anggota_session["session"]
        r = s.post(f"{API}/amaliyah/items", json={"nama": "TEST_x", "target_metrik": "1x"}, timeout=10)
        assert r.status_code == 403

    def test_divisi_cud_403(self, linked_anggota_session):
        s = linked_anggota_session["session"]
        r = s.post(f"{API}/divisi", json={"nama": "TEST_x"}, timeout=10)
        assert r.status_code == 403

    def test_anggota_cud_403(self, linked_anggota_session, divisi_ids):
        s = linked_anggota_session["session"]
        r = s.post(f"{API}/anggota", json={"nama": "TEST_x", "divisi_id": divisi_ids[0]}, timeout=10)
        assert r.status_code == 403

    def test_raport_note_put_403(self, linked_anggota_session):
        r = linked_anggota_session["session"].put(f"{API}/raport/note", json={"body": "x"}, timeout=10)
        assert r.status_code == 403


# ---------- 6. GLOBAL SEARCH ----------
class TestSearch:
    def test_search_short_query(self, spv):
        r = spv.get(f"{API}/search?q=a", timeout=10).json()
        assert r == {"tasks": [], "amaliyah": [], "anggota": [], "divisi": []}

    def test_search_spv_shape(self, spv):
        r = spv.get(f"{API}/search?q=te", timeout=10)
        assert r.status_code == 200
        body = r.json()
        for k in ("tasks", "amaliyah", "anggota", "divisi"):
            assert k in body and isinstance(body[k], list)

    def test_search_anggota_scoped(self, spv, linked_anggota_session, divisi_ids):
        # Create task in OTHER divisi with unique keyword
        d_other = [d for d in divisi_ids if d != linked_anggota_session["divisi_id"]][0]
        kw = f"srchkw{uuid.uuid4().hex[:6]}"
        t = spv.post(f"{API}/tasks", json={"nama": f"TEST_{kw}_other", "divisi_id": d_other}, timeout=10).json()
        try:
            r = linked_anggota_session["session"].get(f"{API}/search?q={kw}", timeout=10)
            assert r.status_code == 200
            tasks = r.json()["tasks"]
            assert all(t2["id"] != t["id"] for t2 in tasks), "anggota search leaked task from other divisi"
        finally:
            spv.delete(f"{API}/tasks/{t['id']}", timeout=10)


# ---------- 7. PUT users accepts anggota_id (covered by linked_anggota_session fixture) ----------
class TestUsersLink:
    def test_put_anggota_id_persists(self, spv, linked_anggota_session):
        # re-read
        r = spv.get(f"{API}/auth/users", timeout=10).json()
        u = next(u for u in r if u["user_id"] == linked_anggota_session["user_id"])
        assert u.get("anggota_id") == linked_anggota_session["anggota_id"]
