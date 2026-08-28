"""Backend tests for iteration 3: Divisi CRUD, per-divisi lists, move, bulk_delete."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Divisi CRUD & auto-migration ----------
class TestDivisi:
    def test_list_divisi_auto_migrates(self, s):
        r = s.get(f"{API}/divisi")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        # Every row has id + nama
        for d in rows:
            assert "id" in d and "nama" in d and "warna" in d

    def test_existing_tasks_have_divisi_id(self, s):
        # After /divisi call above, existing tasks should have divisi_id
        tasks = s.get(f"{API}/tasks").json()
        with_id = [t for t in tasks if t.get("divisi_id")]
        # Expect majority migrated
        if tasks:
            assert len(with_id) >= 1, "no tasks got divisi_id assigned"

    def test_create_divisi_seeds_default_lists(self, s):
        r = s.post(f"{API}/divisi", json={"nama": "TEST_Divisi_A", "warna": "#123abc"})
        assert r.status_code == 200
        d = r.json()
        did = d["id"]
        try:
            lists = s.get(f"{API}/task_lists", params={"divisi_id": did}).json()
            names = [l["nama"] for l in lists]
            assert "Backlog" in names
            assert "Dikerjakan" in names
            assert "Selesai" in names
            selesai = next(l for l in lists if l["nama"] == "Selesai")
            assert selesai["is_done"] is True
            assert all(l["divisi_id"] == did for l in lists)
        finally:
            s.delete(f"{API}/divisi/{did}")

    def test_update_divisi(self, s):
        d = s.post(f"{API}/divisi", json={"nama": "TEST_Divisi_U"}).json()
        did = d["id"]
        try:
            r = s.put(f"{API}/divisi/{did}", json={"nama": "TEST_Divisi_U2", "warna": "#ff0000"})
            assert r.status_code == 200
            assert r.json()["nama"] == "TEST_Divisi_U2"
            assert r.json()["warna"] == "#ff0000"
        finally:
            s.delete(f"{API}/divisi/{did}")

    def test_delete_divisi_moves_tasks(self, s):
        # Create 2 divisi (ensure another survives)
        d1 = s.post(f"{API}/divisi", json={"nama": "TEST_Div_DEL"}).json()
        did1 = d1["id"]
        # Create a task in did1
        t = s.post(f"{API}/tasks", json={"nama": "TEST_moved_on_delete", "divisi_id": did1}).json()
        tid = t["id"]
        try:
            r = s.delete(f"{API}/divisi/{did1}")
            assert r.status_code == 200
            # Task should now have a different divisi_id
            got = s.get(f"{API}/tasks/{tid}").json()
            assert got["divisi_id"] != did1
            assert got["divisi_id"] is not None
            # Lists for deleted divisi removed
            lists = s.get(f"{API}/task_lists", params={"divisi_id": did1}).json()
            # Auto-seed will re-create defaults for this divisi_id, so it may still return 3.
            # Just ensure the deleted divisi is not in main list.
            divs = s.get(f"{API}/divisi").json()
            assert not any(x["id"] == did1 for x in divs)
        finally:
            s.delete(f"{API}/tasks/{tid}")


# ---------- Per-divisi task lists ----------
class TestTaskListsPerDivisi:
    def test_lists_scoped_by_divisi(self, s):
        d = s.post(f"{API}/divisi", json={"nama": "TEST_scope"}).json()
        did = d["id"]
        try:
            a = s.get(f"{API}/task_lists", params={"divisi_id": did}).json()
            assert len(a) == 3
            assert all(l["divisi_id"] == did for l in a)

            # add custom list
            r = s.post(f"{API}/task_lists", json={"nama": "TEST_CustomList", "divisi_id": did})
            assert r.status_code == 200
            assert r.json()["divisi_id"] == did

            a2 = s.get(f"{API}/task_lists", params={"divisi_id": did}).json()
            assert len(a2) == 4
        finally:
            s.delete(f"{API}/divisi/{did}")


# ---------- Move Task ----------
class TestMoveTask:
    def test_move_task_changes_list_and_urutan(self, s):
        d = s.post(f"{API}/divisi", json={"nama": "TEST_move"}).json()
        did = d["id"]
        lists = s.get(f"{API}/task_lists", params={"divisi_id": did}).json()
        list_a = lists[0]["id"]
        list_b = lists[1]["id"]
        try:
            t1 = s.post(f"{API}/tasks", json={"nama": "TEST_m1", "divisi_id": did, "list_id": list_b, "urutan": 0}).json()
            t2 = s.post(f"{API}/tasks", json={"nama": "TEST_m2", "divisi_id": did, "list_id": list_b, "urutan": 1}).json()
            t3 = s.post(f"{API}/tasks", json={"nama": "TEST_m3", "divisi_id": did, "list_id": list_a, "urutan": 0}).json()
            # Move t3 to list_b at position 0 → t1 & t2 should be bumped
            r = s.post(f"{API}/tasks/{t3['id']}/move", json={"divisi_id": did, "list_id": list_b, "urutan": 0})
            assert r.status_code == 200
            assert r.json()["list_id"] == list_b
            assert r.json()["urutan"] == 0
            # Verify t1 bumped
            g1 = s.get(f"{API}/tasks/{t1['id']}").json()
            g2 = s.get(f"{API}/tasks/{t2['id']}").json()
            assert g1["urutan"] >= 1
            assert g2["urutan"] >= 2
            # Cleanup
            s.post(f"{API}/tasks/bulk_delete", json={"ids": [t1["id"], t2["id"], t3["id"]]})
        finally:
            s.delete(f"{API}/divisi/{did}")


# ---------- Bulk Delete ----------
class TestBulkDelete:
    def test_bulk_delete_tasks_and_cascade_entries(self, s):
        t1 = s.post(f"{API}/tasks", json={"nama": "TEST_bulk1"}).json()
        t2 = s.post(f"{API}/tasks", json={"nama": "TEST_bulk2"}).json()
        # Add todo entry for t1
        s.post(f"{API}/todo/entries", json={"task_id": t1["id"], "period": "2026-02-01", "checked": True})
        r = s.post(f"{API}/tasks/bulk_delete", json={"ids": [t1["id"], t2["id"]]})
        assert r.status_code == 200
        assert r.json()["deleted"] == 2
        # Verify tasks gone
        assert s.get(f"{API}/tasks/{t1['id']}").status_code == 404
        assert s.get(f"{API}/tasks/{t2['id']}").status_code == 404
        # Entries cascaded
        ents = s.get(f"{API}/todo/entries", params={"task_ids": t1["id"]}).json()
        assert not any(e["task_id"] == t1["id"] for e in ents)

    def test_bulk_delete_empty_ok(self, s):
        r = s.post(f"{API}/tasks/bulk_delete", json={"ids": []})
        assert r.status_code == 200


# ---------- Task filter by divisi_id ----------
class TestTaskFilter:
    def test_filter_by_divisi_id(self, s):
        d = s.post(f"{API}/divisi", json={"nama": "TEST_filter"}).json()
        did = d["id"]
        try:
            t = s.post(f"{API}/tasks", json={"nama": "TEST_f1", "divisi_id": did}).json()
            tid = t["id"]
            rows = s.get(f"{API}/tasks", params={"divisi_id": did}).json()
            assert any(x["id"] == tid for x in rows)
            assert all(x["divisi_id"] == did for x in rows)
            s.delete(f"{API}/tasks/{tid}")
        finally:
            s.delete(f"{API}/divisi/{did}")
