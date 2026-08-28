"""Backend tests for iteration 11.4 — Profile & Manual User Management."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workspace-iterasi.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@ruangsanad.id", "AdminSanad2025!")
BUDI = ("budi@test.id", "budi12345")


def login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return s, r


# -------- Profile self-service --------
class TestProfile:
    @pytest.fixture(scope="class")
    def temp_user(self):
        """Dedicated temp user — parallel (xdist) tests must not fight over Budi's password/sessions."""
        admin, r = login(*ADMIN)
        assert r.status_code == 200
        email = f"TEST_prof_{uuid.uuid4().hex[:8]}@test.id"
        password = "temp12345"
        cr = admin.post(f"{API}/auth/users", json={
            "name": "Temp Profile", "email": email, "password": password, "role": "anggota"
        }, timeout=15)
        assert cr.status_code == 200, cr.text
        uid = cr.json()["user_id"]
        yield email, password
        admin.delete(f"{API}/auth/users/{uid}", timeout=15)

    def test_budi_login(self):
        s, r = login(*BUDI)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_update_name(self, temp_user):
        email, password = temp_user
        s, r = login(email, password)
        assert r.status_code == 200
        r2 = s.put(f"{API}/auth/profile", json={"name": "Budi Santoso"}, timeout=15)
        assert r2.status_code == 200, r2.text
        me = s.get(f"{API}/auth/me").json()
        assert me["name"] == "Budi Santoso"
        # restore
        s.put(f"{API}/auth/profile", json={"name": "Temp Profile"})

    def test_change_password_and_restore(self, temp_user):
        email, password = temp_user
        s, r = login(email, password)
        assert r.status_code == 200
        # change password
        r2 = s.put(f"{API}/auth/profile", json={
            "current_password": password, "new_password": "temp54321"
        }, timeout=15)
        assert r2.status_code == 200, r2.text
        # old password fails
        _, rold = login(email, password)
        assert rold.status_code == 401
        # new works
        s2, rnew = login(email, "temp54321")
        assert rnew.status_code == 200
        # restore
        rr = s2.put(f"{API}/auth/profile", json={
            "current_password": "temp54321", "new_password": password
        })
        assert rr.status_code == 200

    def test_wrong_current_password(self, temp_user):
        email, password = temp_user
        s, r = login(email, password)
        r2 = s.put(f"{API}/auth/profile", json={
            "current_password": "wrongpass", "new_password": "anything123"
        })
        assert r2.status_code == 400
        assert "salah" in r2.text.lower()


# -------- Manual user creation & reset password --------
class TestUserMgmt:
    @pytest.fixture(scope="class")
    def spv(self):
        s, r = login(*ADMIN)
        assert r.status_code == 200, r.text
        return s

    def test_create_manual_user(self, spv):
        email = f"TEST_{uuid.uuid4().hex[:8]}@test.id"
        r = spv.post(f"{API}/auth/users", json={
            "name": "Test Manual", "email": email, "password": "test12345", "role": "anggota"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "approved"
        assert data["email"] == email.lower()
        # can login immediately
        _, rlogin = login(email, "test12345")
        assert rlogin.status_code == 200
        assert rlogin.json().get("ok") is True
        # cleanup
        uid = data["user_id"]
        spv.delete(f"{API}/auth/users/{uid}")

    def test_duplicate_email(self, spv):
        r = spv.post(f"{API}/auth/users", json={
            "name": "Dup", "email": BUDI[0], "password": "xxxxxx123", "role": "anggota"
        })
        assert r.status_code == 400
        assert "terdaftar" in r.text.lower()

    def test_reset_budi_password_and_restore(self, spv):
        # find budi id
        users = spv.get(f"{API}/auth/users").json()
        budi = next(u for u in users if u["email"] == BUDI[0])
        uid = budi["user_id"]
        r = spv.put(f"{API}/auth/users/{uid}/password", json={"new_password": "budi77777"})
        assert r.status_code == 200, r.text
        # old fails
        _, rold = login(BUDI[0], BUDI[1])
        assert rold.status_code == 401
        # new works
        _, rnew = login(BUDI[0], "budi77777")
        assert rnew.status_code == 200
        # restore
        r2 = spv.put(f"{API}/auth/users/{uid}/password", json={"new_password": BUDI[1]})
        assert r2.status_code == 200
        _, rrestored = login(*BUDI)
        assert rrestored.status_code == 200

    def test_anggota_cannot_create_user(self):
        s, _ = login(*BUDI)
        r = s.post(f"{API}/auth/users", json={
            "name": "X", "email": "x@test.id", "password": "xxxxxx123", "role": "anggota"
        })
        assert r.status_code == 403
