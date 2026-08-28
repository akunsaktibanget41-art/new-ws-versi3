"""Backend tests for Tasks list/label/archive/todo endpoints (iteration 2)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for pytest run from backend dir where only backend/.env is loaded
    from dotenv import load_dotenv
    load_dotenv("/app/frontend/.env")
    BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --------- Task Lists ---------
class TestTaskLists:
    def test_get_lists_auto_seeds(self, s):
        r = s.get(f"{API}/task_lists")
        assert r.status_code == 200
        lists = r.json()
        names = [l["nama"] for l in lists]
        for exp in ["Backlog", "Sedang Dikerjakan", "Review", "Selesai"]:
            assert exp in names, f"missing default list {exp}"
        selesai = next(l for l in lists if l["nama"] == "Selesai")
        assert selesai["is_done"] is True

    def test_create_update_delete_list(self, s):
        r = s.post(f"{API}/task_lists", json={"nama": "TEST_col", "warna": "#123456"})
        assert r.status_code == 200
        lid = r.json()["id"]
        assert r.json()["nama"] == "TEST_col"

        r2 = s.put(f"{API}/task_lists/{lid}", json={"nama": "TEST_col2", "warna": "#654321", "is_done": True})
        assert r2.status_code == 200
        assert r2.json()["nama"] == "TEST_col2"
        assert r2.json()["is_done"] is True

        # verify GET reflects
        got = s.get(f"{API}/task_lists").json()
        assert any(l["id"] == lid and l["nama"] == "TEST_col2" for l in got)

        # delete
        rd = s.delete(f"{API}/task_lists/{lid}")
        assert rd.status_code == 200
        got2 = s.get(f"{API}/task_lists").json()
        assert not any(l["id"] == lid for l in got2)


# --------- Task Labels ---------
class TestTaskLabels:
    def test_labels_crud(self, s):
        r = s.post(f"{API}/task_labels", json={"nama": "TEST_lbl", "warna": "#abcdef"})
        assert r.status_code == 200
        lid = r.json()["id"]

        r2 = s.put(f"{API}/task_labels/{lid}", json={"nama": "TEST_lbl2", "warna": "#111111"})
        assert r2.status_code == 200
        assert r2.json()["nama"] == "TEST_lbl2"

        got = s.get(f"{API}/task_labels").json()
        assert any(x["id"] == lid for x in got)

        rd = s.delete(f"{API}/task_labels/{lid}")
        assert rd.status_code == 200
        got2 = s.get(f"{API}/task_labels").json()
        assert not any(x["id"] == lid for x in got2)


# --------- Tasks with list_id / label_ids / archive ---------
class TestTasksNewFields:
    def test_create_task_with_list_and_labels(self, s):
        # get a list_id
        lists = s.get(f"{API}/task_lists").json()
        list_id = lists[0]["id"]
        # create label
        lb = s.post(f"{API}/task_labels", json={"nama": "TEST_L1", "warna": "#00ff00"}).json()
        label_id = lb["id"]

        payload = {
            "nama": "TEST_task_full",
            "kategori": "PROJECT",
            "list_id": list_id,
            "label_ids": [label_id],
        }
        r = s.post(f"{API}/tasks", json=payload)
        assert r.status_code == 200
        t = r.json()
        assert t["list_id"] == list_id
        assert label_id in t["label_ids"]
        tid = t["id"]

        # GET to verify persistence
        g = s.get(f"{API}/tasks/{tid}").json()
        assert g["list_id"] == list_id
        assert label_id in g["label_ids"]

        # filter by list_id
        by_list = s.get(f"{API}/tasks", params={"list_id": list_id}).json()
        assert any(x["id"] == tid for x in by_list)

        # filter by label_id
        by_label = s.get(f"{API}/tasks", params={"label_id": label_id}).json()
        assert any(x["id"] == tid for x in by_label)

        # search
        by_search = s.get(f"{API}/tasks", params={"search": "TEST_task_full"}).json()
        assert any(x["id"] == tid for x in by_search)

        # tipe PROJECT
        pr = s.get(f"{API}/tasks", params={"tipe": "PROJECT"}).json()
        assert any(x["id"] == tid for x in pr)

        # archive
        ar = s.post(f"{API}/tasks/{tid}/archive")
        assert ar.status_code == 200
        assert ar.json()["archived"] is True
        assert ar.json()["archived_at"]

        # default list hides archived
        default = s.get(f"{API}/tasks").json()
        assert not any(x["id"] == tid for x in default)
        # archived=true shows it
        arch = s.get(f"{API}/tasks", params={"archived": "true"}).json()
        assert any(x["id"] == tid for x in arch)

        # unarchive
        ua = s.post(f"{API}/tasks/{tid}/unarchive")
        assert ua.status_code == 200
        assert ua.json()["archived"] is False

        # label delete pulls from tasks
        s.delete(f"{API}/task_labels/{label_id}")
        after = s.get(f"{API}/tasks/{tid}").json()
        assert label_id not in (after.get("label_ids") or [])

        # cascade delete todo_entries
        te = s.post(f"{API}/todo/entries", json={"task_id": tid, "period": "2026-01-05", "checked": True})
        assert te.status_code == 200
        s.delete(f"{API}/tasks/{tid}")
        entries = s.get(f"{API}/todo/entries", params={"task_ids": tid}).json()
        assert not any(e["task_id"] == tid for e in entries)

    def test_tipe_rutin_filter(self, s):
        # Create a HARIAN task
        r = s.post(f"{API}/tasks", json={"nama": "TEST_harian_rutin", "kategori": "HARIAN"})
        tid = r.json()["id"]
        rutin = s.get(f"{API}/tasks", params={"tipe": "RUTIN"}).json()
        assert any(x["id"] == tid for x in rutin)
        pr = s.get(f"{API}/tasks", params={"tipe": "PROJECT"}).json()
        assert not any(x["id"] == tid for x in pr)
        s.delete(f"{API}/tasks/{tid}")


# --------- Todo Entries ---------
class TestTodoEntries:
    def test_upsert_and_filter(self, s):
        r = s.post(f"{API}/tasks", json={"nama": "TEST_todo_task", "kategori": "HARIAN"})
        tid = r.json()["id"]
        try:
            e1 = s.post(f"{API}/todo/entries", json={"task_id": tid, "period": "2026-01-10", "checked": True}).json()
            e2 = s.post(f"{API}/todo/entries", json={"task_id": tid, "period": "2026-01-10", "checked": False}).json()
            assert e1["id"] == e2["id"]  # upsert
            assert e2["checked"] is False

            # week + month formats
            s.post(f"{API}/todo/entries", json={"task_id": tid, "period": "2026-W02", "checked": True})
            s.post(f"{API}/todo/entries", json={"task_id": tid, "period": "2026-03", "checked": True})

            all_e = s.get(f"{API}/todo/entries", params={"task_ids": tid}).json()
            periods = {e["period"] for e in all_e}
            assert {"2026-01-10", "2026-W02", "2026-03"} <= periods

            # range filter
            ranged = s.get(f"{API}/todo/entries", params={"start": "2026-01-01", "end": "2026-01-31", "task_ids": tid}).json()
            assert any(e["period"] == "2026-01-10" for e in ranged)
        finally:
            s.delete(f"{API}/tasks/{tid}")
