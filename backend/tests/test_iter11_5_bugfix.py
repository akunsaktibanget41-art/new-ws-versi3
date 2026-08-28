"""Iter 11.5 bugfix tests:
BUG 1: delegasi tetap di divisi & list Backlog pembuat (default list pertama).
BUG 2: penerima update list_id → status auto-derive; pemberi melihat status baru.
BUG 3: SPV tertaut anggota → tugas yg dibuat SPV memiliki pemberi_id = anggota tertaut, muncul di workspace SPV.
"""
import os
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://workspace-iterasi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def budi():
    return _login("budi@test.id", "budi12345")


@pytest.fixture(scope="module")
def rina():
    return _login("rina@test.id", "rina12345")


@pytest.fixture(scope="module")
def siti():
    return _login("siti@test.id", "siti12345")


@pytest.fixture(scope="module")
def admin():
    return _login("admin@ruangsanad.id", "AdminSanad2025!")


@pytest.fixture(scope="module")
def anggota_index(budi):
    rows = budi.get(f"{API}/anggota", timeout=15).json()
    return {a["nama"].lower(): a for a in rows}


def _get_lists(session, divisi_id):
    r = session.get(f"{API}/task_lists", params={"divisi_id": divisi_id}, timeout=15)
    assert r.status_code == 200, f"list_lists: {r.status_code} {r.text}"
    return sorted(r.json(), key=lambda x: x.get("urutan", 99))


# ---------------- BUG 1 ----------------
def test_bug1_delegasi_default_backlog(budi, rina, anggota_index, admin):
    budi_ang = anggota_index["budi"]
    rina_ang = next(v for k, v in anggota_index.items() if "rina" in k)

    # ambil list divisi budi
    lists_budi = _get_lists(budi, budi_ang["divisi_id"])
    assert lists_budi, "Budi divisi has no task-lists"
    backlog = lists_budi[0]  # list pertama = Backlog

    # buat tugas TANPA list_id → backend/frontend default → sesuai model,
    # kita simulasi frontend yg kirim list_id backlog (form default)
    payload = {
        "nama": "TEST_iter115_bug1_backlog",
        "penerima_tugas_id": rina_ang["id"],
        "list_id": backlog["id"],
    }
    cr = budi.post(f"{API}/tasks", json=payload, timeout=15)
    assert cr.status_code in (200, 201), cr.text
    task = cr.json()
    tid = task["id"]

    # divisi tetap milik Budi, bukan Rina
    assert task["divisi_id"] == budi_ang["divisi_id"], "divisi harus tetap milik Budi"
    # list_id = Backlog (list pertama Budi)
    assert task["list_id"] == backlog["id"], f"list_id harus backlog Budi, got {task['list_id']}"
    # pemberi = Budi
    assert task["pemberi_id"] == budi_ang["id"]

    # Rina melihat tugas via scope penerima_tugas_id
    rina_ids = [t["id"] for t in rina.get(f"{API}/tasks", timeout=15).json()]
    assert tid in rina_ids

    admin.delete(f"{API}/tasks/{tid}", timeout=15)


# ---------------- BUG 2 ----------------
def test_bug2_status_sync_when_penerima_moves_list(budi, rina, anggota_index, admin):
    budi_ang = anggota_index["budi"]
    rina_ang = next(v for k, v in anggota_index.items() if "rina" in k)

    lists_budi = _get_lists(budi, budi_ang["divisi_id"])
    backlog = lists_budi[0]
    dikerjakan = next((l for l in lists_budi if not l.get("is_done") and l.get("urutan", 0) > 1), None)
    selesai = next((l for l in lists_budi if l.get("is_done")), None)
    assert dikerjakan and selesai, f"Divisi Budi butuh list Dikerjakan+Selesai: {lists_budi}"

    payload = {
        "nama": "TEST_iter115_bug2_status_sync",
        "penerima_tugas_id": rina_ang["id"],
        "list_id": backlog["id"],
    }
    cr = budi.post(f"{API}/tasks", json=payload, timeout=15)
    assert cr.status_code in (200, 201), cr.text
    tid = cr.json()["id"]
    assert cr.json().get("status") in (None, "BELUM_MULAI"), cr.json().get("status")

    # Rina memindahkan list_id → Dikerjakan (tanpa kirim status eksplisit)
    upd = rina.put(f"{API}/tasks/{tid}", json={"list_id": dikerjakan["id"]}, timeout=15)
    assert upd.status_code == 200, upd.text
    assert upd.json()["status"] == "DALAM_PROSES", upd.json()

    # Budi lihat status terbaru
    tasks_budi = {t["id"]: t for t in budi.get(f"{API}/tasks", timeout=15).json()}
    assert tasks_budi[tid]["status"] == "DALAM_PROSES"
    assert tasks_budi[tid]["list_id"] == dikerjakan["id"]

    # Rina → Selesai
    upd2 = rina.put(f"{API}/tasks/{tid}", json={"list_id": selesai["id"]}, timeout=15)
    assert upd2.status_code == 200
    assert upd2.json()["status"] == "SELESAI"

    tasks_budi2 = {t["id"]: t for t in budi.get(f"{API}/tasks", timeout=15).json()}
    assert tasks_budi2[tid]["status"] == "SELESAI"

    admin.delete(f"{API}/tasks/{tid}", timeout=15)


# ---------------- BUG 3 ----------------
def test_bug3_spv_linked_creates_task_visible_in_spv_workspace(admin, anggota_index):
    budi_ang = anggota_index["budi"]
    siti_ang = next(v for k, v in anggota_index.items() if "siti" in k)

    # 1) cari user admin
    users = admin.get(f"{API}/auth/users", timeout=15)
    assert users.status_code == 200, users.text
    admin_user = next(u for u in users.json() if u["email"] == "admin@ruangsanad.id")
    admin_uid = admin_user["user_id"]

    original_anggota_id = admin_user.get("anggota_id")

    # 2) link admin ke Budi
    lnk = admin.put(f"{API}/auth/users/{admin_uid}", json={"anggota_id": budi_ang["id"]}, timeout=15)
    assert lnk.status_code in (200, 204), f"link admin->budi failed: {lnk.status_code} {lnk.text}"

    try:
        # 3) admin buat tugas ke Siti (divisi Umum)
        lists_umum = _get_lists(admin, budi_ang["divisi_id"])
        backlog = lists_umum[0]
        payload = {
            "nama": "TEST_iter115_bug3_spv_linked",
            "penerima_tugas_id": siti_ang["id"],
            "divisi_id": budi_ang["divisi_id"],
            "list_id": backlog["id"],
        }
        cr = admin.post(f"{API}/tasks", json=payload, timeout=15)
        assert cr.status_code in (200, 201), cr.text
        task = cr.json()
        tid = task["id"]
        # pemberi_id = anggota tertaut SPV (Budi)
        assert task["pemberi_id"] == budi_ang["id"], f"pemberi_id harus Budi (anggota tertaut SPV), got {task.get('pemberi_id')}"
        assert task["divisi_id"] == budi_ang["divisi_id"]

        # 4) SPV melihat tugas di /tasks?divisi_id=umum
        r = admin.get(f"{API}/tasks", params={"divisi_id": budi_ang["divisi_id"]}, timeout=15)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert tid in ids, "SPV tidak melihat tugas yang ia buat di workspace divisi aktif"

        admin.delete(f"{API}/tasks/{tid}", timeout=15)
    finally:
        # 5) unlink admin -> original (biasanya None)
        payload_unlink = {"anggota_id": original_anggota_id}
        admin.put(f"{API}/auth/users/{admin_uid}", json=payload_unlink, timeout=15)


# ---------------- Regresi ----------------
def test_regresi_pemberi_readonly(budi, rina, anggota_index, admin):
    budi_ang = anggota_index["budi"]
    rina_ang = next(v for k, v in anggota_index.items() if "rina" in k)
    lists_budi = _get_lists(budi, budi_ang["divisi_id"])
    cr = budi.post(f"{API}/tasks", json={
        "nama": "TEST_iter115_reg_readonly",
        "penerima_tugas_id": rina_ang["id"],
        "list_id": lists_budi[0]["id"],
    }, timeout=15)
    tid = cr.json()["id"]
    bupd = budi.put(f"{API}/tasks/{tid}", json={"hasil_catatan": "hack"}, timeout=15)
    assert bupd.status_code in (401, 403)
    admin.delete(f"{API}/tasks/{tid}", timeout=15)
