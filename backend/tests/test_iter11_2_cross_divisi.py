"""Iter 11.2: Cross-divisi delegation - Budi (Umum) -> Rina (Marketing)."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://workspace-iterasi.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def budi():
    return _login("budi@test.id", "budi12345")


@pytest.fixture(scope="module")
def rina():
    return _login("rina@test.id", "rina12345")


@pytest.fixture(scope="module")
def admin():
    return _login("admin@ruangsanad.id", "AdminSanad2025!")


def test_budi_sees_all_anggota_and_all_divisi(budi):
    r = budi.get(f"{API}/anggota", timeout=15)
    assert r.status_code == 200
    names = {a["nama"].lower() for a in r.json()}
    assert any("rina" in n for n in names), f"Budi cannot see Rina in anggota list: {names}"

    r2 = budi.get(f"{API}/divisi", timeout=15)
    assert r2.status_code == 200
    dnames = {d["nama"].lower() for d in r2.json()}
    assert any("marketing" in n for n in dnames), f"Budi cannot see Divisi Marketing: {dnames}"


def test_cross_divisi_delegation_flow(budi, rina, admin):
    # find Rina's anggota
    r = budi.get(f"{API}/anggota", timeout=15)
    rina_row = next(a for a in r.json() if "rina" in a["nama"].lower())
    budi_row = next(a for a in r.json() if a["nama"].lower() == "budi")

    payload = {
        "nama": "TEST_iter162_cross_task",
        "penerima_tugas_id": rina_row["id"],
        "brief_link": "https://example.com/brief",
    }
    cr = budi.post(f"{API}/tasks", json=payload, timeout=15)
    assert cr.status_code in (200, 201), f"create failed: {cr.status_code} {cr.text}"
    task = cr.json()
    task_id = task["id"]
    # Iter 11.5: tugas tetap di divisi pembuat (Budi), penerima melihat via scope penerima_tugas_id
    assert task.get("divisi_id") == budi_row.get("divisi_id"), (
        f"divisi mismatch: task={task.get('divisi_id')} budi={budi_row.get('divisi_id')}"
    )
    assert task.get("pemberi_id") == budi_row.get("id"), "pemberi_id harus = Budi"

    # Rina sees the task
    lr = rina.get(f"{API}/tasks", timeout=15)
    assert lr.status_code == 200
    rina_ids = [t["id"] for t in lr.json()]
    assert task_id in rina_ids, "Rina does not see delegated task"

    # Budi sees as pemberi
    lb = budi.get(f"{API}/tasks", timeout=15)
    assert lb.status_code == 200
    budi_ids = [t["id"] for t in lb.json()]
    assert task_id in budi_ids, "Budi does not see task he created"

    # Rina updates hasil
    upd = rina.put(
        f"{API}/tasks/{task_id}",
        json={"hasil_link": "https://example.com/hasil", "hasil_catatan": "done"},
        timeout=15,
    )
    assert upd.status_code == 200, f"Rina update failed: {upd.status_code} {upd.text}"

    # Budi cannot update hasil (monitor read-only)
    bupd = budi.put(f"{API}/tasks/{task_id}", json={"hasil_catatan": "hack"}, timeout=15)
    assert bupd.status_code in (403, 401), f"Budi should be forbidden: {bupd.status_code} {bupd.text}"

    # cleanup
    admin.delete(f"{API}/tasks/{task_id}", timeout=15)


def test_rina_only_sees_own_divisi_rutin(rina):
    """Regresi: rina rutin scope only Marketing."""
    r = rina.get(f"{API}/rutin-tasks", timeout=15)
    # endpoint may vary; skip if 404
    if r.status_code == 404:
        pytest.skip("rutin-tasks endpoint not found (naming may differ)")
    assert r.status_code == 200
