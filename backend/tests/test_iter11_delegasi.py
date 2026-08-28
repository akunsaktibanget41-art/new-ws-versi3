"""
Iterasi 11.1 - Workspace Per-Anggota tests:
- SPV can create divisi/anggota, anggota cannot (403)
- Anggota can create task; auto-set pemberi_id = self
- Delegasi: task appears for both pemberi and penerima; only penerima (or SPV) can update
- brief_link, hasil_link, hasil_catatan fields persist
- Rutin task scope: anggota sees only their divisi's rutin
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workspace-iterasi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def spv():
    return _login("admin@ruangsanad.id", "AdminSanad2025!")


@pytest.fixture(scope="module")
def budi():
    return _login("budi@test.id", "budi12345")


@pytest.fixture(scope="module")
def siti():
    return _login("siti@test.id", "siti12345")


@pytest.fixture(scope="module")
def anggota_ids(spv):
    r = spv.get(f"{API}/anggota", timeout=15)
    assert r.status_code == 200
    rows = r.json()
    by_name = {a["nama"].lower(): a["id"] for a in rows}
    # budi / siti fixtures exist in seed; but we look them up via /auth/me
    return rows, by_name


def _get_my_anggota_id(session):
    r = session.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 200
    return r.json().get("anggota_id")


class TestRBACDivisi:
    def test_anggota_cannot_create_divisi(self, budi):
        r = budi.post(f"{API}/divisi", json={"nama": "TEST_HackDiv"}, timeout=10)
        assert r.status_code == 403

    def test_anggota_cannot_create_anggota(self, budi):
        r = budi.post(f"{API}/anggota", json={"divisi_id": "x", "nama": "TEST_x"}, timeout=10)
        assert r.status_code == 403

    def test_spv_can_list_divisi(self, spv):
        r = spv.get(f"{API}/divisi", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestDelegasi:
    created_task_id = None

    def test_budi_creates_delegated_task_to_siti(self, budi, siti):
        siti_id = _get_my_anggota_id(siti)
        assert siti_id, "Siti must be linked to an anggota"
        payload = {
            "nama": "TEST_Delegasi Budi ke Siti",
            "kategori": "PROJECT",
            "penerima_tugas_id": siti_id,
            "brief_link": "https://example.com/brief",
        }
        r = budi.post(f"{API}/tasks", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["nama"] == payload["nama"]
        assert data["penerima_tugas_id"] == siti_id
        # pemberi_id auto-set to Budi's anggota_id
        budi_id = _get_my_anggota_id(budi)
        assert data["pemberi_id"] == budi_id
        assert data["brief_link"] == "https://example.com/brief"
        TestDelegasi.created_task_id = data["id"]

    def test_budi_sees_task_as_pemberi(self, budi):
        r = budi.get(f"{API}/tasks", timeout=15)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert TestDelegasi.created_task_id in ids

    def test_siti_sees_task_as_penerima(self, siti):
        r = siti.get(f"{API}/tasks", timeout=15)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert TestDelegasi.created_task_id in ids

    def test_budi_cannot_update_delegated_task(self, budi):
        tid = TestDelegasi.created_task_id
        r = budi.put(f"{API}/tasks/{tid}", json={"status": "SELESAI"}, timeout=10)
        assert r.status_code == 403, f"Expected 403 for pemberi read-only, got {r.status_code}: {r.text}"

    def test_siti_can_update_hasil(self, siti):
        tid = TestDelegasi.created_task_id
        payload = {
            "status": "DALAM_PROSES",
            "hasil_link": "https://drive.google.com/test",
            "hasil_catatan": "Progress 60%",
        }
        r = siti.put(f"{API}/tasks/{tid}", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "DALAM_PROSES"
        assert data["hasil_link"] == "https://drive.google.com/test"
        assert data["hasil_catatan"] == "Progress 60%"

    def test_budi_sees_hasil_from_siti(self, budi):
        tid = TestDelegasi.created_task_id
        r = budi.get(f"{API}/tasks", timeout=10)
        task = next((t for t in r.json() if t["id"] == tid), None)
        assert task is not None
        assert task["hasil_link"] == "https://drive.google.com/test"
        assert task["hasil_catatan"] == "Progress 60%"

    def test_cleanup(self, spv):
        if TestDelegasi.created_task_id:
            spv.delete(f"{API}/tasks/{TestDelegasi.created_task_id}", timeout=10)


class TestRutinScope:
    def test_budi_only_sees_own_divisi_rutin(self, budi):
        r = budi.get(f"{API}/tasks?tipe=RUTIN", timeout=15)
        assert r.status_code == 200
        # Get budi's divisi_id
        me = budi.get(f"{API}/auth/me").json()
        ang_id = me.get("anggota_id")
        if not ang_id:
            pytest.skip("Budi not linked")
        # get anggota → divisi_id
        a = budi.get(f"{API}/anggota").json()
        my_div = next((x["divisi_id"] for x in a if x["id"] == ang_id), None)
        for t in r.json():
            # Every rutin task either in own divisi, or delegated to/from me
            in_scope = (
                t.get("divisi_id") == my_div
                or t.get("penerima_tugas_id") == ang_id
                or t.get("pemberi_id") == ang_id
            )
            assert in_scope, f"Task {t['id']} out of scope"
