"""Iteration 22 backend tests:
- create_task forces own workspace (divisi + penerima = creator's anggota)
- /me/scope for SPV and Head
- PUT /api/divisi/{id}/head set/unset + validation
- /api/notifications/feed (reminders, delegated, approvals)
- /api/tasks/{id}/activity + /comment (create/status/comment logging)
- monitoring head-scoping (deadline-radar 200, amaliyah-compliance 403)
"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

SPV = {"email": "akunsaktibanget06@gmail.com", "password": "Qolbu2026!"}
HEAD = {"email": "siti@test.com", "password": "Head2026!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed for {creds['email']}: {r.status_code} {r.text[:300]}")
    tok = r.json().get("session_token")
    assert tok
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def spv():
    return _login(SPV)


@pytest.fixture(scope="module")
def head():
    return _login(HEAD)


@pytest.fixture(scope="module")
def spv_scope(spv):
    r = spv.get(f"{API}/me/scope", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def created_task_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(spv, created_task_ids):
    yield
    for tid in created_task_ids:
        spv.delete(f"{API}/tasks/{tid}", timeout=30)


# ---------- /me/scope ----------
class TestScope:
    def test_spv_scope(self, spv_scope):
        assert spv_scope["is_spv"] is True
        assert spv_scope["can_monitor"] is True
        assert spv_scope["anggota_id"], "SPV must be linked to an anggota (Budi)"
        assert spv_scope["divisi_id"]

    def test_head_scope(self, head):
        r = head.get(f"{API}/me/scope", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_spv"] is False
        assert d["is_head"] is True
        assert d["head_divisi_id"]
        assert d["can_monitor"] is True
        assert d["head_divisi_nama"] == "Operasional"


# ---------- create_task self-assignment ----------
class TestCreateTaskSelfWorkspace:
    def test_create_forces_own_divisi_and_penerima(self, spv, spv_scope, created_task_ids):
        # try to create in another divisi with another penerima -> must be overridden
        divs = spv.get(f"{API}/divisi", timeout=30).json()
        other = next((d for d in divs if d["id"] != spv_scope["divisi_id"]), None)
        angs = spv.get(f"{API}/anggota", timeout=30).json()
        other_ang = next((a for a in angs if a["id"] != spv_scope["anggota_id"]), None)
        payload = {
            "nama": "TEST_ITER22_self_assign",
            "kategori": "PROJECT",
            "frekuensi": "SEKALI",
            "status": "BELUM_MULAI",
            "divisi_id": other["id"] if other else None,
            "penerima_tugas_id": other_ang["id"] if other_ang else None,
        }
        r = spv.post(f"{API}/tasks", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        t = r.json()
        created_task_ids.append(t["id"])
        assert t["divisi_id"] == spv_scope["divisi_id"], "divisi must be forced to creator's own"
        assert t["penerima_tugas_id"] == spv_scope["anggota_id"], "penerima must be creator"
        assert t["pemberi_id"] == spv_scope["anggota_id"]

        # verify persistence via GET
        g = spv.get(f"{API}/tasks/{t['id']}", timeout=30)
        assert g.status_code == 200
        gd = g.json()
        assert gd["divisi_id"] == spv_scope["divisi_id"]
        assert gd["penerima_tugas_id"] == spv_scope["anggota_id"]
        assert gd["list_id"], "list_id should fall back to own divisi's first list"

    def test_created_task_list_belongs_to_own_divisi(self, spv, spv_scope, created_task_ids):
        tid = created_task_ids[0]
        t = spv.get(f"{API}/tasks/{tid}", timeout=30).json()
        lists = spv.get(f"{API}/task_lists", params={"divisi_id": spv_scope["divisi_id"]}, timeout=30).json()
        assert t["list_id"] in [l["id"] for l in lists]

    def test_head_create_task_lands_in_own_divisi(self, head, created_task_ids, spv):
        hs = head.get(f"{API}/me/scope", timeout=30).json()
        r = head.post(f"{API}/tasks", json={"nama": "TEST_ITER22_head_task", "kategori": "PROJECT"}, timeout=30)
        assert r.status_code == 200, r.text
        t = r.json()
        created_task_ids.append(t["id"])
        assert t["divisi_id"] == hs["divisi_id"]
        assert t["penerima_tugas_id"] == hs["anggota_id"]


# ---------- move (reassignment) ----------
class TestMoveTask:
    def test_move_to_other_divisi_and_penerima(self, spv, spv_scope, created_task_ids):
        r = spv.post(f"{API}/tasks", json={"nama": "TEST_ITER22_move", "kategori": "PROJECT"}, timeout=30)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        created_task_ids.append(tid)
        divs = spv.get(f"{API}/divisi", timeout=30).json()
        other = next((d for d in divs if d["id"] != spv_scope["divisi_id"]), None)
        angs = spv.get(f"{API}/anggota", timeout=30).json()
        target_ang = next((a for a in angs if other and a.get("divisi_id") == other["id"]), None)
        if not other or not target_ang:
            pytest.skip("Need a second divisi with an anggota")
        m = spv.post(f"{API}/tasks/{tid}/move", json={"divisi_id": other["id"], "penerima_tugas_id": target_ang["id"]}, timeout=30)
        assert m.status_code == 200, m.text
        g = spv.get(f"{API}/tasks/{tid}", timeout=30).json()
        assert g["divisi_id"] == other["id"]
        assert g["penerima_tugas_id"] == target_ang["id"]

    def test_move_logs_activity(self, spv, created_task_ids):
        tid = created_task_ids[-1]
        acts = spv.get(f"{API}/tasks/{tid}/activity", timeout=30).json()
        kinds = [a["kind"] for a in acts]
        assert "create" in kinds
        assert "move" in kinds


# ---------- activity & comments ----------
class TestActivityComments:
    @pytest.fixture(scope="class")
    def act_task_id(self, spv, created_task_ids):
        r = spv.post(f"{API}/tasks", json={"nama": "TEST_ITER22_activity", "kategori": "PROJECT"}, timeout=30)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        created_task_ids.append(tid)
        return tid

    def test_create_activity_logged(self, spv, act_task_id):
        tid = act_task_id
        r = spv.get(f"{API}/tasks/{tid}/activity", timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        assert rows[0]["kind"] == "create"
        assert "_id" not in rows[0]
        assert rows[0]["actor_name"]

    def test_post_comment_appears(self, spv, act_task_id):
        tid = act_task_id
        c = spv.post(f"{API}/tasks/{tid}/comment", json={"text": "TEST_ITER22 komentar QA"}, timeout=30)
        assert c.status_code == 200, c.text
        rows = spv.get(f"{API}/tasks/{tid}/activity", timeout=30).json()
        comments = [r for r in rows if r["kind"] == "comment"]
        assert any(r["text"] == "TEST_ITER22 komentar QA" for r in comments)

    def test_status_change_logs_activity(self, spv, act_task_id):
        tid = act_task_id
        u = spv.put(f"{API}/tasks/{tid}", json={"status": "DALAM_PROSES"}, timeout=30)
        assert u.status_code == 200, u.text
        rows = spv.get(f"{API}/tasks/{tid}/activity", timeout=30).json()
        st = [r for r in rows if r["kind"] == "status"]
        assert st, "status change should log an activity entry"
        assert "DALAM_PROSES" in st[-1]["text"]

    def test_activity_404_unknown_task(self, spv):
        r = spv.get(f"{API}/tasks/nonexistent-id-xyz/activity", timeout=30)
        assert r.status_code == 404

    def test_activity_requires_auth(self):
        r = requests.get(f"{API}/tasks/anything/activity", timeout=30)
        assert r.status_code == 401


# ---------- notifications feed ----------
class TestNotificationFeed:
    def test_spv_feed_shape(self, spv):
        r = spv.get(f"{API}/notifications/feed", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("count", "delegated", "reminders", "approvals", "role"):
            assert k in d
        assert d["role"] == "spv"
        assert isinstance(d["count"], int)

    def test_overdue_task_appears_in_reminders(self, spv, created_task_ids):
        r = spv.post(f"{API}/tasks", json={"nama": "TEST_ITER22_overdue", "kategori": "PROJECT", "deadline": "2020-01-01"}, timeout=30)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        created_task_ids.append(tid)
        feed = spv.get(f"{API}/notifications/feed", timeout=30).json()
        item = next((x for x in feed["reminders"] if x["id"] == tid), None)
        assert item, "overdue task must appear in reminders"
        assert item["urgensi"] == "overdue"
        assert item["deadline"] == "2020-01-01"
        assert feed["count"] >= 1

    def test_head_feed_role(self, head):
        r = head.get(f"{API}/notifications/feed", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "head"
        assert d["approvals"] == 0

    def test_feed_requires_auth(self):
        r = requests.get(f"{API}/notifications/feed", timeout=30)
        assert r.status_code == 401


# ---------- head toggle ----------
class TestDivisiHead:
    def test_set_and_unset_head(self, spv, spv_scope):
        did = spv_scope["divisi_id"]
        orig = next(d for d in spv.get(f"{API}/divisi", timeout=30).json() if d["id"] == did)
        orig_head = orig.get("head_anggota_id")
        r = spv.put(f"{API}/divisi/{did}/head", json={"anggota_id": spv_scope["anggota_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["head_anggota_id"] == spv_scope["anggota_id"]
        got = next(d for d in spv.get(f"{API}/divisi", timeout=30).json() if d["id"] == did)
        assert got.get("head_anggota_id") == spv_scope["anggota_id"]
        # unset
        r2 = spv.put(f"{API}/divisi/{did}/head", json={"anggota_id": None}, timeout=30)
        assert r2.status_code == 200, r2.text
        got2 = next(d for d in spv.get(f"{API}/divisi", timeout=30).json() if d["id"] == did)
        assert got2.get("head_anggota_id") in (None, "")
        # restore
        spv.put(f"{API}/divisi/{did}/head", json={"anggota_id": orig_head}, timeout=30)

    def test_cross_divisi_head_rejected(self, spv, spv_scope):
        divs = spv.get(f"{API}/divisi", timeout=30).json()
        other = next((d for d in divs if d["id"] != spv_scope["divisi_id"]), None)
        if not other:
            pytest.skip("only one divisi")
        r = spv.put(f"{API}/divisi/{other['id']}/head", json={"anggota_id": spv_scope["anggota_id"]}, timeout=30)
        assert r.status_code == 400

    def test_head_endpoint_forbidden_for_non_spv(self, head, spv_scope):
        r = head.put(f"{API}/divisi/{spv_scope['divisi_id']}/head", json={"anggota_id": None}, timeout=30)
        assert r.status_code == 403

    def test_unknown_divisi_404(self, spv):
        r = spv.put(f"{API}/divisi/does-not-exist/head", json={"anggota_id": None}, timeout=30)
        assert r.status_code == 404


# ---------- monitoring scoping ----------
class TestMonitoringHeadScope:
    def test_head_deadline_radar_scoped(self, head):
        hs = head.get(f"{API}/me/scope", timeout=30).json()
        r = head.get(f"{API}/monitoring/deadline-radar", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "summary" in d
        for bucket in ("overdue", "today", "upcoming"):
            for t in d[bucket]:
                assert t["divisi_id"] == hs["head_divisi_id"], "head must only see own divisi tasks"

    def test_head_cannot_override_divisi_param(self, head, spv_scope):
        hs = head.get(f"{API}/me/scope", timeout=30).json()
        r = head.get(f"{API}/monitoring/deadline-radar", params={"divisi_id": spv_scope["divisi_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        for bucket in ("overdue", "today", "upcoming"):
            for t in r.json()[bucket]:
                assert t["divisi_id"] == hs["head_divisi_id"]

    def test_head_amaliyah_compliance_403(self, head):
        r = head.get(f"{API}/monitoring/amaliyah-compliance", timeout=30)
        assert r.status_code == 403

    def test_spv_amaliyah_compliance_200(self, spv):
        r = spv.get(f"{API}/monitoring/amaliyah-compliance", timeout=30)
        assert r.status_code == 200, r.text

    def test_head_is_read_only_on_other_members_task(self, spv, head, created_task_ids):
        """A head must NOT be able to mutate a task of another member in its own divisi."""
        hs = head.get(f"{API}/me/scope", timeout=30).json()
        t = spv.post(f"{API}/tasks", json={"nama": "TEST_ITER22_head_readonly", "kategori": "PROJECT"}, timeout=30).json()
        tid = t["id"]
        created_task_ids.append(tid)
        mv = spv.post(f"{API}/tasks/{tid}/move", json={"divisi_id": hs["head_divisi_id"]}, timeout=30)
        assert mv.status_code == 200, mv.text
        assert head.put(f"{API}/tasks/{tid}", json={"status": "SELESAI"}, timeout=30).status_code == 403
        assert head.delete(f"{API}/tasks/{tid}", timeout=30).status_code == 403
        assert head.post(f"{API}/tasks/{tid}/comment", json={"text": "x"}, timeout=30).status_code == 403
        assert head.post(f"{API}/tasks/{tid}/move", json={"divisi_id": hs["head_divisi_id"]}, timeout=30).status_code == 403
        # status unchanged
        assert spv.get(f"{API}/tasks/{tid}", timeout=30).json()["status"] == "BELUM_MULAI"

    @pytest.mark.parametrize("path", ["workload", "stagnation", "divisi-progress", "workload-heatmap", "per-anggota"])
    def test_head_other_monitoring_endpoints(self, head, path):
        r = head.get(f"{API}/monitoring/{path}", timeout=30)
        assert r.status_code in (200, 404), f"{path} -> {r.status_code} {r.text[:200]}"
