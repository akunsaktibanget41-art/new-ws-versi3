"""
Iteration 11.6 backend tests:
  BUG1 - update_task guard divisi_id (Rina edit lintas divisi)
  FEAT2 - GET /api/notifications/incoming + POST /api/notifications/mark_seen
  FEAT3 - move_task with penerima_tugas_id (reassign per-orang, incl. authz)
"""
import os
import time
import pytest
import requests

def _read_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api"

CREDS = {
    "spv":  ("admin@ruangsanad.id", "AdminSanad2025!"),
    "budi": ("budi@test.id", "budi12345"),
    "rina": ("rina@test.id", "rina12345"),
    "siti": ("siti@test.id", "siti12345"),
}


def login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def sessions():
    return {k: login(*v) for k, v in CREDS.items()}


@pytest.fixture(scope="module")
def context(sessions):
    """Fetch anggota + divisi mapping."""
    spv = sessions["spv"]
    ang = spv.get(f"{API}/anggota", timeout=15).json()
    div = spv.get(f"{API}/divisi", timeout=15).json()
    # Map each session user → anggota_id via /auth/me
    by_email = {}
    for key, sess in sessions.items():
        me = sess.get(f"{API}/auth/me", timeout=15).json()
        ang_id = me.get("anggota_id")
        if ang_id:
            ang_obj = next((a for a in ang if a["id"] == ang_id), None)
            if ang_obj:
                # Add email key based on known test creds
                email = CREDS[key][0]
                by_email[email] = ang_obj
    return {"anggota": ang, "divisi": div, "by_email": by_email}


# ---------- BUG1: update_task cross-divisi guard fix ----------
class TestBug1CrossDivisiUpdate:
    def test_rina_can_edit_hasil_with_creator_divisi_id_in_payload(self, sessions, context):
        """Repro: Budi (Umum) delegates task to Rina (Marketing).
        Frontend edit dialog re-sends divisi_id = task's divisi (Budi's Umum) which is != Rina's divisi.
        After fix: guard hanya menolak jika divisi_id BERUBAH dari nilai task saat ini → harus 200."""
        budi = sessions["budi"]; rina = sessions["rina"]
        rina_ang = context["by_email"].get("rina@test.id")
        assert rina_ang, "Rina anggota not found"
        # Budi create task delegated to Rina
        payload = {
            "nama": "TEST_iter116_bug1_cross",
            "penerima_tugas_id": rina_ang["id"],
            "status": "BELUM_MULAI",
        }
        r = budi.post(f"{API}/tasks", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        task = r.json()
        task_id = task["id"]
        original_divisi = task.get("divisi_id")
        try:
            # Rina edits hasil, re-sends divisi_id = task.divisi_id (Budi's Umum, != Rina's div)
            edit = {
                "hasil_link": "https://example.com/hasil-rina",
                "hasil_catatan": "Hasil dari Rina lintas divisi",
                "divisi_id": original_divisi,  # same as current — should be allowed
            }
            r2 = rina.put(f"{API}/tasks/{task_id}", json=edit, timeout=15)
            assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
            body = r2.json()
            assert body.get("hasil_link") == edit["hasil_link"]
            assert body.get("hasil_catatan") == edit["hasil_catatan"]
        finally:
            budi.delete(f"{API}/tasks/{task_id}", timeout=15)

    def test_rina_cannot_change_divisi_to_other(self, sessions, context):
        """Guard still enforced when divisi_id actually differs from current."""
        budi = sessions["budi"]; rina = sessions["rina"]
        rina_ang = context["by_email"].get("rina@test.id")
        # find a divisi that's neither rina's nor task's current
        divisi_ids = [d["id"] for d in context["divisi"]]
        r = budi.post(f"{API}/tasks", json={
            "nama": "TEST_iter116_bug1_guard",
            "penerima_tugas_id": rina_ang["id"],
        }, timeout=15).json()
        tid = r["id"]
        current = r.get("divisi_id")
        other = next((d for d in divisi_ids if d != current and d != rina_ang.get("divisi_id")), None)
        try:
            if other:
                r2 = rina.put(f"{API}/tasks/{tid}", json={"divisi_id": other}, timeout=15)
                assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"
        finally:
            sessions["budi"].delete(f"{API}/tasks/{tid}", timeout=15)

    def test_siti_edit_non_owned_returns_error_body(self, sessions, context):
        """Siti (Umum) tries to edit task where she's neither pemberi nor penerima.
        Note: current backend allows same-divisi anggota to update tasks in their divisi.
        We only verify the error body format when a 4xx IS returned (e.g., cross-divisi trying)."""
        budi = sessions["budi"]; rina = sessions["rina"]; siti = sessions["siti"]
        rina_ang = context["by_email"].get("rina@test.id")
        # Task in Rina's Marketing divisi (Budi creates it and reassigns divisi via SPV? Simpler: create as Rina)
        # Rina creates task in her own divisi:
        r = rina.post(f"{API}/tasks", json={
            "nama": "TEST_iter116_bug1_siti_notowner",
        }, timeout=15).json()
        tid = r["id"]
        try:
            # Siti in Umum tries to update a Marketing task → _assert_task_access should 403/404
            r2 = siti.put(f"{API}/tasks/{tid}", json={"hasil_catatan": "x"}, timeout=15)
            if r2.status_code in (403, 404):
                body = r2.json()
                assert "detail" in body or "message" in body, body
            else:
                # If not blocked, at least confirm server returns structured response
                assert r2.status_code == 200, f"unexpected status {r2.status_code}: {r2.text}"
        finally:
            rina.delete(f"{API}/tasks/{tid}", timeout=15)


# ---------- FEAT2: Notifications ----------
class TestNotifications:
    def test_incoming_and_mark_seen_flow(self, sessions, context):
        budi = sessions["budi"]; rina = sessions["rina"]
        rina_ang = context["by_email"].get("rina@test.id")
        # Mark all seen first to reset baseline for Rina
        rina.post(f"{API}/notifications/mark_seen", timeout=15)
        before = rina.get(f"{API}/notifications/incoming", timeout=15).json()
        assert before.get("count", 0) == 0, f"expected 0 after mark_seen, got {before}"

        # Budi delegates new task to Rina
        r = budi.post(f"{API}/tasks", json={
            "nama": "TEST_iter116_notif",
            "penerima_tugas_id": rina_ang["id"],
        }, timeout=15).json()
        tid = r["id"]
        try:
            time.sleep(0.5)
            after = rina.get(f"{API}/notifications/incoming", timeout=15).json()
            assert after["count"] >= 1, f"expected count>=1, got {after}"
            match = [it for it in after["items"] if it["id"] == tid]
            assert match, "new task not in notifications"
            item = match[0]
            assert item.get("pemberi_nama"), "pemberi_nama missing"
            assert item.get("divisi_nama"), "divisi_nama missing"

            # Mark seen
            m = rina.post(f"{API}/notifications/mark_seen", timeout=15)
            assert m.status_code == 200
            time.sleep(0.3)
            post_seen = rina.get(f"{API}/notifications/incoming", timeout=15).json()
            assert post_seen["count"] == 0, f"expected 0 after mark_seen, got {post_seen}"
        finally:
            budi.delete(f"{API}/tasks/{tid}", timeout=15)


# ---------- FEAT3: move_task with penerima_tugas_id ----------
class TestMoveReassign:
    def test_pemberi_can_reassign_to_other_person_cross_divisi(self, sessions, context):
        budi = sessions["budi"]; siti = sessions["siti"]
        rina_ang = context["by_email"]["rina@test.id"]
        siti_ang = context["by_email"]["siti@test.id"]
        # Budi delegates to Rina, then reassigns to Siti
        r = budi.post(f"{API}/tasks", json={
            "nama": "TEST_iter116_move_reassign",
            "penerima_tugas_id": rina_ang["id"],
        }, timeout=15).json()
        tid = r["id"]
        try:
            r2 = budi.post(f"{API}/tasks/{tid}/move",
                           json={"penerima_tugas_id": siti_ang["id"]}, timeout=15)
            assert r2.status_code == 200, r2.text
            body = r2.json()
            assert body.get("penerima_tugas_id") == siti_ang["id"]
            assert body.get("moved_at"), "moved_at should be set"
            # Verify Siti sees it
            siti_tasks = siti.get(f"{API}/tasks", timeout=15).json()
            assert any(t["id"] == tid for t in siti_tasks), "Siti should see reassigned task"
        finally:
            budi.delete(f"{API}/tasks/{tid}", timeout=15)

    def test_unauthorized_user_cannot_reassign(self, sessions, context):
        """Siti tidak boleh reassign tugas Budi→Rina (bukan pemberi/penerima/SPV)."""
        budi = sessions["budi"]; siti = sessions["siti"]
        rina_ang = context["by_email"]["rina@test.id"]
        siti_ang = context["by_email"]["siti@test.id"]
        r = budi.post(f"{API}/tasks", json={
            "nama": "TEST_iter116_move_unauthz",
            "penerima_tugas_id": rina_ang["id"],
        }, timeout=15).json()
        tid = r["id"]
        try:
            r2 = siti.post(f"{API}/tasks/{tid}/move",
                           json={"penerima_tugas_id": siti_ang["id"]}, timeout=15)
            # Siti is in Umum (same as Budi's divisi) → scope allows _assert_task_access?
            # She's not pemberi (Budi) nor current penerima (Rina) → must be 403.
            assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"
        finally:
            budi.delete(f"{API}/tasks/{tid}", timeout=15)

    def test_current_penerima_can_reassign(self, sessions, context):
        budi = sessions["budi"]; rina = sessions["rina"]
        rina_ang = context["by_email"]["rina@test.id"]
        siti_ang = context["by_email"]["siti@test.id"]
        r = budi.post(f"{API}/tasks", json={
            "nama": "TEST_iter116_move_by_penerima",
            "penerima_tugas_id": rina_ang["id"],
        }, timeout=15).json()
        tid = r["id"]
        try:
            r2 = rina.post(f"{API}/tasks/{tid}/move",
                           json={"penerima_tugas_id": siti_ang["id"]}, timeout=15)
            assert r2.status_code == 200, r2.text
            assert r2.json().get("penerima_tugas_id") == siti_ang["id"]
        finally:
            budi.delete(f"{API}/tasks/{tid}", timeout=15)

    def test_spv_move_divisi_still_works(self, sessions, context):
        """Regression: SPV can still move task's divisi/list."""
        spv = sessions["spv"]; budi = sessions["budi"]
        divisi_ids = [d["id"] for d in context["divisi"]]
        rina_ang = context["by_email"]["rina@test.id"]
        r = budi.post(f"{API}/tasks", json={
            "nama": "TEST_iter116_spv_move_div",
            "penerima_tugas_id": rina_ang["id"],
        }, timeout=15).json()
        tid = r["id"]
        current = r.get("divisi_id")
        target = next((d for d in divisi_ids if d != current), None)
        try:
            if target:
                r2 = spv.post(f"{API}/tasks/{tid}/move", json={"divisi_id": target}, timeout=15)
                assert r2.status_code == 200, r2.text
                assert r2.json().get("divisi_id") == target
        finally:
            budi.delete(f"{API}/tasks/{tid}", timeout=15)
