"""Iter 11.5 bug fix tests: default Backlog, status sync, SPV linked-anggota delegasi."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workspace-iterasi.preview.emergentagent.com").rstrip("/")


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def budi():
    return _login("budi@test.id", "budi12345")


@pytest.fixture(scope="module")
def rina():
    return _login("rina@test.id", "rina12345")


@pytest.fixture(scope="module")
def spv():
    return _login("admin@ruangsanad.id", "AdminSanad2025!")


def _get_me(s):
    r = s.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    return r.json()


def _get_lists(s, divisi_id):
    r = s.get(f"{BASE_URL}/api/task_lists", params={"divisi_id": divisi_id})
    assert r.status_code == 200, f"list fetch {r.status_code}: {r.text}"
    return r.json()


def _get_anggota(s):
    r = s.get(f"{BASE_URL}/api/anggota")
    assert r.status_code == 200
    return r.json()


def _resolve_divisi(s, anggota_id):
    if not anggota_id:
        return None
    r = s.get(f"{BASE_URL}/api/anggota/{anggota_id}")
    if r.status_code == 200:
        return r.json().get("divisi_id")
    return None


def test_bug1_delegasi_stays_in_pemberi_backlog(budi, rina):
    """Bug 1: Budi delegates cross-divisi to Rina → task stays in Budi's divisi + Backlog list."""
    me_budi = _get_me(budi)
    me_rina = _get_me(rina)
    budi_ang = me_budi.get("anggota_id")
    budi_div = _resolve_divisi(budi, budi_ang)
    rina_ang = me_rina.get("anggota_id")
    rina_div = _resolve_divisi(rina, rina_ang)
    assert budi_div != rina_div, "Budi & Rina should be in different divisi"

    budi_lists = sorted(_get_lists(budi, budi_div), key=lambda x: x.get("urutan", 99))
    backlog = budi_lists[0]  # first list = Backlog

    payload = {
        "nama": "TEST_iter11_5_delegasi",
        "kategori": "PROJECT",
        "divisi_id": budi_div,
        "list_id": backlog["id"],
        "penerima_tugas_id": rina_ang,
        "status": "BELUM_MULAI",
    }
    r = budi.post(f"{BASE_URL}/api/tasks", json=payload)
    assert r.status_code == 200, r.text
    task = r.json()
    task_id = task["id"]

    # Verify task remains in Budi's divisi & Backlog list
    assert task["divisi_id"] == budi_div, "Task divisi must stay with pemberi (Budi)"
    assert task["list_id"] == backlog["id"], "Task must stay in Backlog list of pemberi"
    assert task["pemberi_id"] == budi_ang
    assert task["penerima_tugas_id"] == rina_ang

    # cleanup at end via return
    return task_id


def test_bug2_status_sync_via_list_change(budi, rina):
    """Bug 2: Rina moves list_id to Dikerjakan list of her divisi → status auto-derives; visible to Budi."""
    me_budi = _get_me(budi)
    me_rina = _get_me(rina)
    budi_div = _resolve_divisi(budi, me_budi.get("anggota_id"))
    rina_div = _resolve_divisi(rina, me_rina.get("anggota_id"))

    budi_lists = sorted(_get_lists(budi, budi_div), key=lambda x: x.get("urutan", 99))
    backlog = budi_lists[0]

    # Create fresh task
    r = budi.post(f"{BASE_URL}/api/tasks", json={
        "nama": "TEST_iter11_5_statussync",
        "kategori": "PROJECT",
        "divisi_id": budi_div,
        "list_id": backlog["id"],
        "penerima_tugas_id": me_rina["anggota_id"],
        "status": "BELUM_MULAI",
    })
    assert r.status_code == 200, r.text
    task_id = r.json()["id"]

    # Rina updates list_id to a mid list in her divisi
    rina_lists = sorted(_get_lists(rina, rina_div), key=lambda x: x.get("urutan", 99))
    mid = next((l for l in rina_lists if not l.get("is_done") and l != rina_lists[0]), None)
    assert mid, "Rina divisi should have a mid list (Dikerjakan)"

    r2 = rina.put(f"{BASE_URL}/api/tasks/{task_id}", json={"list_id": mid["id"]})
    assert r2.status_code == 200, r2.text
    updated = r2.json()
    assert updated["status"] == "DALAM_PROSES", f"expected DALAM_PROSES got {updated['status']}"

    # Budi sees the new status
    r3 = budi.get(f"{BASE_URL}/api/tasks/{task_id}")
    assert r3.status_code == 200
    assert r3.json()["status"] == "DALAM_PROSES"

    # Rina moves to done list
    done = next((l for l in rina_lists if l.get("is_done")), None)
    assert done, "Rina divisi should have a done list"
    r4 = rina.put(f"{BASE_URL}/api/tasks/{task_id}", json={"list_id": done["id"]})
    assert r4.status_code == 200
    assert r4.json()["status"] == "SELESAI"

    # Budi sees SELESAI
    r5 = budi.get(f"{BASE_URL}/api/tasks/{task_id}")
    assert r5.json()["status"] == "SELESAI"

    # cleanup
    budi.delete(f"{BASE_URL}/api/tasks/{task_id}")


def test_bug3_spv_linked_anggota_creates_delegasi(spv, rina):
    """Bug 3: SPV linked to Budi anggota creates task → pemberi_id = Budi anggota_id (visible in SPV workspace)."""
    me_spv = _get_me(spv)
    me_rina = _get_me(rina)

    # If SPV not linked, link to Budi
    if not me_spv.get("anggota_id"):
        # Find Budi anggota_id via users list
        r_users = spv.get(f"{BASE_URL}/api/auth/users")
        assert r_users.status_code == 200
        # Find any user with email budi@test.id to get anggota_id
        budi_user = next((u for u in r_users.json() if u.get("email") == "budi@test.id"), None)
        assert budi_user and budi_user.get("anggota_id"), "Budi user must be linked to anggota"
        budi_ang_id = budi_user["anggota_id"]
        # Link SPV to Budi anggota
        r_link = spv.put(f"{BASE_URL}/api/auth/users/{me_spv['id']}/anggota", json={"anggota_id": budi_ang_id})
        # Endpoint may vary — try alternative
        if r_link.status_code == 404:
            r_link = spv.put(f"{BASE_URL}/api/auth/users/{me_spv['id']}", json={"anggota_id": budi_ang_id})
        assert r_link.status_code in (200, 204), f"failed link SPV to anggota: {r_link.status_code} {r_link.text}"
        me_spv = _get_me(spv)

    spv_ang = me_spv.get("anggota_id")
    if not spv_ang:
        pytest.skip("SPV cannot be linked to anggota; skipping bug3 assertion")

    # SPV creates a task assigned to Rina
    # Use SPV's currently viewable divisi_id — pick from divisi list
    r_div = spv.get(f"{BASE_URL}/api/divisi")
    assert r_div.status_code == 200
    divisi = r_div.json()[0]
    lists = sorted(_get_lists(spv, divisi["id"]), key=lambda x: x.get("urutan", 99))
    backlog = lists[0]

    payload = {
        "nama": "TEST_iter11_5_spv_delegasi",
        "kategori": "PROJECT",
        "divisi_id": divisi["id"],
        "list_id": backlog["id"],
        "penerima_tugas_id": me_rina["anggota_id"],
        "status": "BELUM_MULAI",
    }
    r = spv.post(f"{BASE_URL}/api/tasks", json=payload)
    assert r.status_code == 200, r.text
    task = r.json()
    assert task["pemberi_id"] == spv_ang, f"pemberi_id should be SPV's anggota_id, got {task['pemberi_id']}"

    # Verify SPV can list it
    r_list = spv.get(f"{BASE_URL}/api/tasks", params={"divisi_id": divisi["id"]})
    assert r_list.status_code == 200
    ids = [t["id"] for t in r_list.json()]
    assert task["id"] in ids, "SPV should see task in its own workspace"

    # cleanup
    spv.delete(f"{BASE_URL}/api/tasks/{task['id']}")


def test_cleanup_delegasi_task(budi):
    """Cleanup TEST_ tasks created."""
    r = budi.get(f"{BASE_URL}/api/tasks")
    if r.status_code == 200:
        for t in r.json():
            if t.get("nama", "").startswith("TEST_iter11_5"):
                budi.delete(f"{BASE_URL}/api/tasks/{t['id']}")
