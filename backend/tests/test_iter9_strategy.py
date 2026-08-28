"""Iter9 backend tests: Strategy & Execution (BSC, OKR, KPI, Action Plan, Linimasa).

Coverage:
- Periods CRUD + activation + cascade delete
- BSC CRUD
- OKR CRUD + Key Results + RBAC
- KPI CRUD + formula + RBAC
- Projects CRUD + link/unlink tasks + summary derivation
- Dashboard aggregation
- Auth (401) and non-SPV (403) enforcement
- Regression: iter7/iter8 endpoints still work + rebrand
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sanad-webapp.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SPV_EMAIL = "akunsaktibanget06@gmail.com"
SPV_PASSWORD = "Qolbu2026!"

CREATED = {
    "periods": [], "bsc": [], "okr": [], "kr": [], "kpi": [], "projects": [],
    "divisi": [], "anggota": [], "tasks": [], "users": [],
}


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def spv():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SPV_EMAIL, "password": SPV_PASSWORD})
    assert r.status_code == 200, f"SPV login failed: {r.status_code} {r.text}"
    yield s
    # cleanup - reverse order
    for pid in CREATED["projects"]:
        try: s.delete(f"{API}/strategy/projects/{pid}")
        except Exception: pass
    for kid in CREATED["kpi"]:
        try: s.delete(f"{API}/strategy/kpi/{kid}")
        except Exception: pass
    for oid in CREATED["okr"]:
        try: s.delete(f"{API}/strategy/okr/{oid}")
        except Exception: pass
    for bid in CREATED["bsc"]:
        try: s.delete(f"{API}/strategy/bsc/{bid}")
        except Exception: pass
    for pid in CREATED["periods"]:
        try: s.delete(f"{API}/strategy/periods/{pid}")
        except Exception: pass
    for tid in CREATED["tasks"]:
        try: s.delete(f"{API}/tasks/{tid}")
        except Exception: pass
    for aid in CREATED["anggota"]:
        try: s.delete(f"{API}/anggota/{aid}")
        except Exception: pass
    for did in CREATED["divisi"]:
        try: s.delete(f"{API}/divisi/{did}")
        except Exception: pass
    for uid in CREATED["users"]:
        try: s.delete(f"{API}/auth/users/{uid}")
        except Exception: pass


@pytest.fixture(scope="module")
def seed(spv):
    suf = uuid.uuid4().hex[:6]
    r = spv.post(f"{API}/divisi", json={"nama": f"itest_div9_{suf}", "warna": "#22c55e", "urutan": 997})
    assert r.status_code in (200, 201), r.text
    div = r.json(); CREATED["divisi"].append(div["id"])
    r = spv.post(f"{API}/anggota", json={"nama": f"itest_ang9_{suf}", "divisi_id": div["id"], "urutan": 1})
    assert r.status_code in (200, 201), r.text
    ang = r.json(); CREATED["anggota"].append(ang["id"])
    yday = (date.today() - timedelta(days=1)).isoformat()
    tmr = (date.today() + timedelta(days=7)).isoformat()
    r = spv.post(f"{API}/tasks", json={
        "nama": f"itest_task9a_{suf}", "divisi_id": div["id"], "divisi": div["nama"],
        "penerima_tugas_id": ang["id"], "penerima_tugas": ang["nama"],
        "status": "BELUM_MULAI", "kategori": "HARIAN", "deadline": yday,
    })
    assert r.status_code in (200, 201); task1 = r.json(); CREATED["tasks"].append(task1["id"])
    r = spv.post(f"{API}/tasks", json={
        "nama": f"itest_task9b_{suf}", "divisi_id": div["id"], "divisi": div["nama"],
        "penerima_tugas_id": ang["id"], "penerima_tugas": ang["nama"],
        "status": "SELESAI", "kategori": "HARIAN", "deadline": tmr,
    })
    assert r.status_code in (200, 201); task2 = r.json(); CREATED["tasks"].append(task2["id"])
    return {"divisi": div, "anggota": ang, "task_overdue": task1, "task_done": task2, "suf": suf}


@pytest.fixture(scope="module")
def anggota_session(spv, seed):
    """Create a non-SPV user linked to itest anggota for RBAC tests."""
    suf = seed["suf"]
    email = f"itest_ang9_{suf}@example.com"
    pw = "Testing123!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": f"itest_ang9_{suf}"})
    assert r.status_code == 200, r.text
    r = spv.get(f"{API}/auth/users?status=pending")
    assert r.status_code == 200
    target = next((u for u in r.json() if u["email"] == email), None)
    assert target, "user not found in pending list"
    uid = target["user_id"]; CREATED["users"].append(uid)
    # approve and link to anggota
    r = spv.put(f"{API}/auth/users/{uid}", json={"status": "approved", "anggota_id": seed["anggota"]["id"]})
    assert r.status_code == 200, r.text
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def period(spv, seed):
    suf = seed["suf"]
    r = spv.post(f"{API}/strategy/periods", json={
        "nama": f"itest_Q1_{suf}", "start": "2026-01-01", "end": "2026-03-31",
        "siklus_bulan": 3, "active": False,
    })
    assert r.status_code in (200, 201), r.text
    p = r.json(); CREATED["periods"].append(p["id"])
    assert p["nama"].startswith("itest_Q1_")
    assert p.get("active") is False
    return p


# ---------------- Rebrand regression ----------------
def test_rebrand_api_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    d = r.json()
    assert d.get("message") == "Workspace Ruang Sanad API"
    assert d.get("version") == "1.2"


# ---------------- Auth enforcement ----------------
def test_strategy_requires_auth():
    # anonymous
    r = requests.get(f"{API}/strategy/periods")
    assert r.status_code == 401, f"expected 401 got {r.status_code}"


# ---------------- PERIODS ----------------
def test_period_created(period):
    assert period["id"]


def test_period_list_and_get_active(spv, period):
    r = spv.get(f"{API}/strategy/periods")
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert period["id"] in ids


def test_period_activate_flips_flag(spv, period):
    # capture current active (if any)
    r = spv.get(f"{API}/strategy/periods/active")
    assert r.status_code == 200
    prev = r.json()
    # activate our new period
    r = spv.post(f"{API}/strategy/periods/{period['id']}/activate")
    assert r.status_code == 200
    r = spv.get(f"{API}/strategy/periods/active")
    assert r.status_code == 200
    cur = r.json()
    assert cur and cur["id"] == period["id"]
    # If previous existed and different, must now be inactive
    if prev and prev["id"] != period["id"]:
        r = spv.get(f"{API}/strategy/periods")
        prev_row = next((x for x in r.json() if x["id"] == prev["id"]), None)
        assert prev_row is not None
        assert prev_row.get("active") is False, "previously active period should be inactive now"


def test_period_update(spv, period):
    r = spv.put(f"{API}/strategy/periods/{period['id']}", json={"nama": period["nama"] + "_upd"})
    assert r.status_code == 200
    assert r.json()["nama"].endswith("_upd")


# ---------------- BSC ----------------
def test_bsc_crud(spv, period):
    r = spv.post(f"{API}/strategy/bsc", json={
        "period_id": period["id"], "aspek": "FINANCIAL",
        "nama": "itest_bsc_fin", "target": "100jt", "urutan": 1,
    })
    assert r.status_code in (200, 201), r.text
    b1 = r.json(); CREATED["bsc"].append(b1["id"])
    r = spv.post(f"{API}/strategy/bsc", json={
        "period_id": period["id"], "aspek": "LEARNING",
        "nama": "itest_bsc_learn", "target": "5 pelatihan", "urutan": 2,
    })
    assert r.status_code in (200, 201); b2 = r.json(); CREATED["bsc"].append(b2["id"])
    # list sorted by aspek then urutan (CUSTOMER > FINANCIAL > INTERNAL > LEARNING alphabetically)
    r = spv.get(f"{API}/strategy/bsc?period_id={period['id']}")
    assert r.status_code == 200
    rows = r.json()
    aspeks = [x["aspek"] for x in rows if x["id"] in (b1["id"], b2["id"])]
    assert aspeks == sorted(aspeks)
    # update
    r = spv.put(f"{API}/strategy/bsc/{b1['id']}", json={"achieved": "80jt"})
    assert r.status_code == 200
    assert r.json()["achieved"] == "80jt"


# ---------------- OKR ----------------
@pytest.fixture(scope="module")
def okr(spv, period, seed):
    r = spv.post(f"{API}/strategy/okr", json={
        "period_id": period["id"], "level": "DIVISI", "divisi_id": seed["divisi"]["id"],
        "owner_id": seed["anggota"]["id"], "supporter_ids": [],
        "objective": "itest_obj_1", "urutan": 1,
    })
    assert r.status_code in (200, 201), r.text
    o = r.json(); CREATED["okr"].append(o["id"])
    return o


def test_okr_created_no_owner(spv, period):
    # anggota tanpa OKR — owner nullable
    r = spv.post(f"{API}/strategy/okr", json={
        "period_id": period["id"], "level": "DIVISI",
        "objective": "itest_no_owner", "urutan": 5,
    })
    assert r.status_code in (200, 201), r.text
    o = r.json(); CREATED["okr"].append(o["id"])
    assert o.get("owner_id") in (None, "")


def test_okr_list_decorated(spv, period, okr, seed):
    r = spv.get(f"{API}/strategy/okr?period_id={period['id']}")
    assert r.status_code == 200
    rows = r.json()
    target = next((x for x in rows if x["id"] == okr["id"]), None)
    assert target is not None
    assert "key_results" in target
    assert "progress" in target
    assert target.get("owner") and target["owner"]["id"] == seed["anggota"]["id"]
    assert target.get("divisi") and target["divisi"]["id"] == seed["divisi"]["id"]


def test_okr_filter_by_anggota(spv, period, okr, seed):
    r = spv.get(f"{API}/strategy/okr?period_id={period['id']}&anggota_id={seed['anggota']['id']}")
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert okr["id"] in ids


def test_okr_keyresult_and_progress(spv, okr):
    # add KR: target=100, actual=50 → progress 50%
    r = spv.post(f"{API}/strategy/okr/{okr['id']}/keyresults", json={
        "nama": "kr_a", "target": "100", "actual": "50", "urutan": 1,
    })
    assert r.status_code in (200, 201), r.text
    kr = r.json(); CREATED["kr"].append(kr["id"])
    # list okr → check progress = 50
    r = spv.get(f"{API}/strategy/okr?period_id={okr['period_id']}")
    o = next(x for x in r.json() if x["id"] == okr["id"])
    assert o["progress"] == 50.0, f"expected 50.0 got {o['progress']}"
    # update actual to 80
    r = spv.put(f"{API}/strategy/okr/{okr['id']}/keyresults/{kr['id']}", json={"actual": "80"})
    assert r.status_code == 200
    r = spv.get(f"{API}/strategy/okr?period_id={okr['period_id']}")
    o = next(x for x in r.json() if x["id"] == okr["id"])
    assert o["progress"] == 80.0


def test_okr_my_endpoint(anggota_session, period, okr, seed):
    # anggota_session is linked to seed anggota which is OKR owner
    r = anggota_session.get(f"{API}/strategy/okr/my?period_id={period['id']}")
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert okr["id"] in ids


def test_okr_kr_rbac_non_owner(spv, period, anggota_session, seed):
    # create another OKR owned by a different (fake) anggota — not the anggota_session user
    r = spv.post(f"{API}/strategy/okr", json={
        "period_id": period["id"], "level": "DIVISI",
        "owner_id": "fake-anggota-id-xyz",
        "objective": "itest_rbac_okr", "urutan": 9,
    })
    assert r.status_code in (200, 201)
    o = r.json(); CREATED["okr"].append(o["id"])
    # anggota (not owner/supporter) tries to add KR → 403
    r = anggota_session.post(f"{API}/strategy/okr/{o['id']}/keyresults", json={
        "nama": "unauthorized_kr", "target": "10", "actual": "0",
    })
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"


# ---------------- KPI ----------------
@pytest.fixture(scope="module")
def kpi(spv, period, seed):
    r = spv.post(f"{API}/strategy/kpi", json={
        "period_id": period["id"], "anggota_id": seed["anggota"]["id"],
        "indikator": "itest_kpi_max", "polaritas": "MAX",
        "bobot": 20, "target": 100, "aktual": 80, "urutan": 1,
    })
    assert r.status_code in (200, 201), r.text
    k = r.json(); CREATED["kpi"].append(k["id"])
    return k


def test_kpi_formula_max(spv, period, kpi):
    # MAX: aktual=80, target=100 → achievement=80% → weighted = 80/100 * 20 = 16
    r = spv.get(f"{API}/strategy/kpi?period_id={period['id']}")
    assert r.status_code == 200
    data = r.json()
    item = next(x for x in data["items"] if x["id"] == kpi["id"])
    assert item["weighted_score"] == 16.0, f"got {item['weighted_score']}"
    assert item["status"] == "ON_TRACK"


def test_kpi_formula_min(spv, period, seed):
    # MIN: target=10, aktual=8 → (10/8)*100 = 125% → weighted = 1.25 * 10 = 12.5
    r = spv.post(f"{API}/strategy/kpi", json={
        "period_id": period["id"], "anggota_id": seed["anggota"]["id"],
        "indikator": "itest_kpi_min", "polaritas": "MIN",
        "bobot": 10, "target": 10, "aktual": 8, "urutan": 2,
    })
    assert r.status_code in (200, 201), r.text
    k = r.json(); CREATED["kpi"].append(k["id"])
    r = spv.get(f"{API}/strategy/kpi?period_id={period['id']}")
    item = next(x for x in r.json()["items"] if x["id"] == k["id"])
    assert item["weighted_score"] == 12.5
    assert item["status"] == "EXCELLENT"


def test_kpi_rbac_anggota_can_update_aktual(anggota_session, kpi):
    r = anggota_session.put(f"{API}/strategy/kpi/{kpi['id']}", json={"aktual": 90})
    assert r.status_code == 200, r.text


def test_kpi_rbac_anggota_cannot_update_bobot(anggota_session, kpi):
    r = anggota_session.put(f"{API}/strategy/kpi/{kpi['id']}", json={"bobot": 50})
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"


def test_kpi_rbac_anggota_cannot_update_bobot_null(anggota_session, kpi):
    # Iter10 fix: guard uses exclude_unset — sending bobot=null must still be forbidden
    r = anggota_session.put(f"{API}/strategy/kpi/{kpi['id']}", json={"aktual": 85, "bobot": None})
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"



def test_kpi_rbac_others_kpi_forbidden(spv, period, anggota_session, seed):
    # create a KPI for a DIFFERENT anggota
    suf = uuid.uuid4().hex[:6]
    r = spv.post(f"{API}/anggota", json={"nama": f"itest_other_{suf}", "divisi_id": seed["divisi"]["id"], "urutan": 2})
    assert r.status_code in (200, 201); other = r.json(); CREATED["anggota"].append(other["id"])
    r = spv.post(f"{API}/strategy/kpi", json={
        "period_id": period["id"], "anggota_id": other["id"],
        "indikator": "itest_other_kpi", "polaritas": "MAX",
        "bobot": 5, "target": 10, "aktual": 5, "urutan": 3,
    })
    assert r.status_code in (200, 201); k = r.json(); CREATED["kpi"].append(k["id"])
    r = anggota_session.put(f"{API}/strategy/kpi/{k['id']}", json={"aktual": 99})
    assert r.status_code == 403


def test_kpi_non_spv_cannot_create(anggota_session, period, seed):
    r = anggota_session.post(f"{API}/strategy/kpi", json={
        "period_id": period["id"], "anggota_id": seed["anggota"]["id"],
        "indikator": "hack", "polaritas": "MAX", "bobot": 1, "target": 1, "aktual": 1,
    })
    assert r.status_code == 403


# ---------------- PROJECTS ----------------
@pytest.fixture(scope="module")
def project(spv, period, seed):
    r = spv.post(f"{API}/strategy/projects", json={
        "period_id": period["id"], "nama": "itest_proj_1",
        "outcome": "hasil", "omtm": "metric", "anggaran": 1000000,
        "divisi_id": seed["divisi"]["id"], "owner_id": seed["anggota"]["id"],
        "tim_ids": [seed["anggota"]["id"]], "task_ids": [],
    })
    assert r.status_code in (200, 201), r.text
    p = r.json(); CREATED["projects"].append(p["id"])
    return p


def test_project_link_tasks_and_summary(spv, project, seed):
    tids = [seed["task_overdue"]["id"], seed["task_done"]["id"]]
    r = spv.post(f"{API}/strategy/projects/{project['id']}/link-tasks", json={"task_ids": tids})
    assert r.status_code == 200, r.text
    # idempotent: link again
    r = spv.post(f"{API}/strategy/projects/{project['id']}/link-tasks", json={"task_ids": tids})
    assert r.status_code == 200
    linked = r.json().get("task_ids") or []
    assert sorted(linked) == sorted(tids), f"expected unique {tids}, got {linked}"
    # list projects → summary
    r = spv.get(f"{API}/strategy/projects?period_id={project['period_id']}")
    assert r.status_code == 200
    p = next(x for x in r.json() if x["id"] == project["id"])
    s = p["summary"]
    assert s["total"] == 2
    assert s["selesai"] == 1
    assert s["overdue"] == 1, f"expected 1 overdue, got {s}"
    assert s["status"] == "TERLAMBAT"
    assert p.get("end_effective") is not None  # derived from tasks


def test_project_unlink_task(spv, project, seed):
    r = spv.post(f"{API}/strategy/projects/{project['id']}/unlink-task",
                 json={"task_ids": [seed["task_overdue"]["id"]]})
    assert r.status_code == 200
    remaining = r.json().get("task_ids") or []
    assert seed["task_overdue"]["id"] not in remaining
    assert seed["task_done"]["id"] in remaining


def test_project_non_spv_forbidden(anggota_session, period):
    r = anggota_session.post(f"{API}/strategy/projects", json={
        "period_id": period["id"], "nama": "hack_proj",
    })
    assert r.status_code == 403


# ---------------- DASHBOARD ----------------
def test_dashboard_aggregates(spv, period, kpi, okr, project):
    r = spv.get(f"{API}/strategy/dashboard?period_id={period['id']}")
    assert r.status_code == 200
    d = r.json()
    for k in ("bsc_count", "okr_count", "okr_avg_progress", "kpi_count",
              "kpi_total_bobot", "kpi_final_score", "project_count",
              "project_selesai", "project_terlambat"):
        assert k in d, f"missing key {k}"
    assert d["bsc_count"] >= 2
    assert d["okr_count"] >= 2
    assert d["kpi_count"] >= 2
    assert d["project_count"] >= 1
    assert d["kpi_total_bobot"] >= 30  # 20 + 10 + 5


# ---------------- Cascade delete on period ----------------
def test_period_delete_cascades(spv, seed):
    # create disposable period + child artifacts
    suf = uuid.uuid4().hex[:6]
    r = spv.post(f"{API}/strategy/periods", json={
        "nama": f"itest_cascade_{suf}", "start": "2026-04-01", "end": "2026-06-30",
        "siklus_bulan": 3, "active": False,
    })
    assert r.status_code in (200, 201)
    p = r.json()
    r = spv.post(f"{API}/strategy/bsc", json={"period_id": p["id"], "aspek": "CUSTOMER", "nama": "casc_bsc"})
    assert r.status_code in (200, 201)
    r = spv.post(f"{API}/strategy/okr", json={"period_id": p["id"], "level": "COMPANY", "objective": "casc"})
    assert r.status_code in (200, 201); ocasc = r.json()
    r = spv.post(f"{API}/strategy/okr/{ocasc['id']}/keyresults", json={"nama": "kr_casc", "target": "10", "actual": "0"})
    assert r.status_code in (200, 201)
    r = spv.post(f"{API}/strategy/kpi", json={
        "period_id": p["id"], "anggota_id": seed["anggota"]["id"],
        "indikator": "casc_kpi", "polaritas": "MAX", "bobot": 1, "target": 1, "aktual": 1,
    })
    assert r.status_code in (200, 201)
    # delete period
    r = spv.delete(f"{API}/strategy/periods/{p['id']}")
    assert r.status_code == 200
    # confirm children gone
    r = spv.get(f"{API}/strategy/bsc?period_id={p['id']}")
    assert r.status_code == 200 and r.json() == []
    r = spv.get(f"{API}/strategy/okr?period_id={p['id']}")
    assert r.status_code == 200 and r.json() == []
    r = spv.get(f"{API}/strategy/kpi?period_id={p['id']}")
    assert r.status_code == 200 and r.json()["items"] == []


# ---------------- Regression: iter7/8 endpoints ----------------
def test_reg_dashboard_digest(spv):
    r = spv.get(f"{API}/dashboard/digest")
    assert r.status_code == 200
    for k in ("overdue", "today", "upcoming", "stagnant", "counts"):
        assert k in r.json()


def test_reg_monitoring_user(spv, seed):
    r = spv.get(f"{API}/monitoring/user/{seed['anggota']['id']}?days=7")
    assert r.status_code == 200
    for k in ("anggota", "deadline", "workload", "stagnant", "amaliyah"):
        assert k in r.json()


def test_reg_raport_summary(spv, seed):
    r = spv.get(f"{API}/raport/summary?anggota_id={seed['anggota']['id']}")
    assert r.status_code == 200
    assert r.json()["anggota"]["id"] == seed["anggota"]["id"]


def test_reg_raport_pdf(spv):
    r = spv.get(f"{API}/raport/export.pdf")
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"
