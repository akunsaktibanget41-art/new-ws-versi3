"""Iteration 21 — Strategi & Eksekusi v2: BSC goals, OKR owner_jabatan, KR polaritas/baseline,
Initiatives, Evaluasi recap + PDF, Monitoring workload heatmap."""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("no credentials file")
    c = p.read_text()
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Email(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not e or not pw:
        pytest.skip("credentials unparsable")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def client(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200 or not r.json().get("ok"):
        pytest.fail(f"login failed {r.status_code} {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
    return s


@pytest.fixture(scope="session")
def period(client):
    r = client.get(f"{API}/strategy/periods", timeout=30)
    assert r.status_code == 200, r.text[:300]
    rows = r.json()
    assert rows, "no strategy periods seeded"
    target = next((p for p in rows if p.get("nama") == "Q1 2026"), rows[0])
    return target


# ============ BSC GOALS ============
class TestBscGoals:
    def test_list_bsc(self, client, period):
        r = client.get(f"{API}/strategy/bsc", params={"period_id": period["id"]}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        rows = r.json()
        assert isinstance(rows, list)
        for g in rows:
            assert "_id" not in g
            assert "judul" in g
            assert isinstance(g.get("indikators", []), list)

    def test_crud_goal_with_indicators(self, client, period):
        # CREATE
        payload = {
            "period_id": period["id"], "aspek": "LEARNING", "judul": "TEST_Sasaran Belajar",
            "indikators": [{"nama": "TEST_Ind1", "target": "10", "realisasi": "4"}],
            "urutan": 99,
        }
        r = client.post(f"{API}/strategy/bsc", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        g = r.json()
        gid = g["id"]
        assert g["judul"] == "TEST_Sasaran Belajar"
        assert g["aspek"] == "LEARNING"
        assert len(g["indikators"]) == 1 and g["indikators"][0]["id"]
        try:
            # GET verify persistence
            rows = client.get(f"{API}/strategy/bsc", params={"period_id": period["id"]}, timeout=30).json()
            found = next(x for x in rows if x["id"] == gid)
            assert found["indikators"][0]["nama"] == "TEST_Ind1"
            assert found["indikators"][0]["realisasi"] == "4"

            # UPDATE judul + add indicator (inline autosave style)
            upd = {"judul": "TEST_Sasaran Edit", "indikators": found["indikators"] + [
                {"nama": "TEST_Ind2", "target": "20", "realisasi": "20"}]}
            r2 = client.put(f"{API}/strategy/bsc/{gid}", json=upd, timeout=30)
            assert r2.status_code == 200, r2.text[:300]
            assert r2.json()["judul"] == "TEST_Sasaran Edit"
            assert len(r2.json()["indikators"]) == 2
            assert all(i["id"] for i in r2.json()["indikators"])

            rows = client.get(f"{API}/strategy/bsc", params={"period_id": period["id"]}, timeout=30).json()
            found = next(x for x in rows if x["id"] == gid)
            assert found["judul"] == "TEST_Sasaran Edit"
            assert len(found["indikators"]) == 2

            # DELETE an indicator (via PUT with reduced list)
            r3 = client.put(f"{API}/strategy/bsc/{gid}", json={"indikators": [found["indikators"][0]]}, timeout=30)
            assert r3.status_code == 200
            assert len(r3.json()["indikators"]) == 1
        finally:
            d = client.delete(f"{API}/strategy/bsc/{gid}", timeout=30)
            assert d.status_code == 200 and d.json()["deleted"] == 1
        rows = client.get(f"{API}/strategy/bsc", params={"period_id": period["id"]}, timeout=30).json()
        assert gid not in [x["id"] for x in rows]

    def test_update_nonexistent_goal_404(self, client):
        r = client.put(f"{API}/strategy/bsc/does-not-exist", json={"judul": "x"}, timeout=30)
        assert r.status_code == 404, r.status_code


# ============ OKR: owner_jabatan, level, decoration ============
class TestOkr:
    def test_list_okr_decoration(self, client, period):
        r = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        rows = r.json()
        assert isinstance(rows, list) and rows, "expected demo OKRs"
        for o in rows:
            assert "_id" not in o
            assert isinstance(o["progress"], (int, float))
            assert o["label"] in ("OFF_TRACK", "NEED_IMPROVEMENT", "ON_TRACK")
            assert isinstance(o["initiatives"], list)
            assert isinstance(o["key_results"], list)
            assert "owner_jabatan" in o
            for kr in o["key_results"]:
                assert "pct" in kr

    def test_label_thresholds_consistent(self, client, period):
        rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
        for o in rows:
            p = o["progress"]
            expected = "OFF_TRACK" if p < 51 else ("NEED_IMPROVEMENT" if p <= 70 else "ON_TRACK")
            assert o["label"] == expected, f"{p} -> {o['label']}"

    def test_okr_owner_jabatan_persist(self, client, period):
        ang = client.get(f"{API}/anggota", timeout=30).json()
        div = client.get(f"{API}/divisi", timeout=30).json()
        assert ang and div, "need anggota+divisi seeded"
        payload = {
            "period_id": period["id"], "level": "DIVISI", "divisi_id": div[0]["id"],
            "owner_id": ang[0]["id"], "owner_jabatan": "TEST_Kepala Divisi Marketing",
            "objective": "TEST_Objective Owner Jabatan",
        }
        r = client.post(f"{API}/strategy/okr", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        oid = r.json()["id"]
        try:
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            o = next(x for x in rows if x["id"] == oid)
            assert o["owner_jabatan"] == "TEST_Kepala Divisi Marketing"
            assert o["owner"] and o["owner"]["id"] == ang[0]["id"]
            assert o["divisi"] and o["divisi"]["id"] == div[0]["id"]

            # update jabatan
            r2 = client.put(f"{API}/strategy/okr/{oid}", json={"owner_jabatan": "TEST_Manajer"}, timeout=30)
            assert r2.status_code == 200 and r2.json()["owner_jabatan"] == "TEST_Manajer"
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            assert next(x for x in rows if x["id"] == oid)["owner_jabatan"] == "TEST_Manajer"
        finally:
            client.delete(f"{API}/strategy/okr/{oid}", timeout=30)

    @pytest.mark.parametrize("baseline,target,actual,pol,expected", [
        ("1000", "5000", "3200", "MAX", 55.0),
        ("", "100", "40", "MAX", 40.0),
        ("", "10", "20", "MIN", 50.0),
        ("100", "50", "75", "MIN", 50.0),
        ("", "0", "0", "MAX", None),
    ])
    def test_kr_pct_computation(self, client, period, baseline, target, actual, pol, expected):
        ok = client.post(f"{API}/strategy/okr", json={
            "period_id": period["id"], "level": "COMPANY", "objective": "TEST_KR calc"}, timeout=30)
        assert ok.status_code == 200
        oid = ok.json()["id"]
        try:
            r = client.post(f"{API}/strategy/okr/{oid}/keyresults", json={
                "nama": "TEST_KR", "polaritas": pol, "baseline": baseline,
                "target": target, "actual": actual}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            o = next(x for x in rows if x["id"] == oid)
            assert o["key_results"][0]["pct"] == expected, o["key_results"][0]
        finally:
            client.delete(f"{API}/strategy/okr/{oid}", timeout=30)

    def test_kr_update_recompute(self, client, period):
        oid = client.post(f"{API}/strategy/okr", json={
            "period_id": period["id"], "level": "COMPANY", "objective": "TEST_KR upd"}, timeout=30).json()["id"]
        try:
            kid = client.post(f"{API}/strategy/okr/{oid}/keyresults", json={
                "nama": "TEST_KR", "polaritas": "MAX", "target": "100", "actual": "50"}, timeout=30).json()["id"]
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            assert next(x for x in rows if x["id"] == oid)["progress"] == 50.0
            r = client.put(f"{API}/strategy/okr/{oid}/keyresults/{kid}",
                           json={"actual": "80", "polaritas": "MAX", "baseline": ""}, timeout=30)
            assert r.status_code == 200
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            o = next(x for x in rows if x["id"] == oid)
            assert o["progress"] == 80.0
            assert o["label"] == "ON_TRACK"
        finally:
            client.delete(f"{API}/strategy/okr/{oid}", timeout=30)


# ============ INITIATIVES ============
class TestInitiatives:
    def test_initiative_lifecycle(self, client, period):
        ang = client.get(f"{API}/anggota", timeout=30).json()
        oid = client.post(f"{API}/strategy/okr", json={
            "period_id": period["id"], "level": "COMPANY", "objective": "TEST_Init OKR"}, timeout=30).json()["id"]
        try:
            kid = client.post(f"{API}/strategy/okr/{oid}/keyresults", json={
                "nama": "TEST_KR init", "target": "10", "actual": "5"}, timeout=30).json()["id"]
            r = client.post(f"{API}/strategy/okr/{oid}/initiatives", json={
                "nama": "TEST_Inisiatif A", "kr_id": kid,
                "pic_id": ang[0]["id"] if ang else None, "deadline": "2026-03-31"}, timeout=30)
            assert r.status_code == 200, r.text[:300]
            it = r.json()
            iid = it["id"]
            assert it["status"] == "BELUM"

            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            o = next(x for x in rows if x["id"] == oid)
            assert len(o["initiatives"]) == 1
            init = o["initiatives"][0]
            assert init["nama"] == "TEST_Inisiatif A"
            assert init["kr_id"] == kid
            assert init["deadline"] == "2026-03-31"
            if ang:
                assert init["pic"] and init["pic"]["id"] == ang[0]["id"]

            # toggle status
            r2 = client.put(f"{API}/strategy/okr/{oid}/initiatives/{iid}", json={"status": "SELESAI"}, timeout=30)
            assert r2.status_code == 200 and r2.json()["status"] == "SELESAI"
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            assert next(x for x in rows if x["id"] == oid)["initiatives"][0]["status"] == "SELESAI"

            # deleting KR should detach initiative
            client.delete(f"{API}/strategy/okr/{oid}/keyresults/{kid}", timeout=30)
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            assert next(x for x in rows if x["id"] == oid)["initiatives"][0]["kr_id"] is None

            # delete
            d = client.delete(f"{API}/strategy/okr/{oid}/initiatives/{iid}", timeout=30)
            assert d.status_code == 200 and d.json()["deleted"] == 1
            rows = client.get(f"{API}/strategy/okr", params={"period_id": period["id"]}, timeout=30).json()
            assert next(x for x in rows if x["id"] == oid)["initiatives"] == []
        finally:
            client.delete(f"{API}/strategy/okr/{oid}", timeout=30)

    def test_initiative_bad_okr_404(self, client):
        r = client.post(f"{API}/strategy/okr/nope/initiatives", json={"nama": "x"}, timeout=30)
        assert r.status_code == 404


# ============ EVALUASI ============
class TestEvaluasi:
    def test_evaluation_recap_shape(self, client, period):
        r = client.get(f"{API}/strategy/evaluation", params={"period_id": period["id"]}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("note", "period", "vision", "bsc_goals", "okr_list", "okr_by_divisi",
                  "okr_stats", "overall_okr", "kpi_ranking", "kpi_final_score", "projects"):
            assert k in d, f"missing {k}"
        assert d["overall_okr"]["label"] in ("OFF_TRACK", "NEED_IMPROVEMENT", "ON_TRACK")
        assert d["okr_stats"]["total"] == len(d["okr_list"])
        # overall matches average of okr_list progress
        if d["okr_list"]:
            avg = round(sum(o["progress"] for o in d["okr_list"]) / len(d["okr_list"]), 1)
            assert abs(d["overall_okr"]["avg"] - avg) < 0.11
        for grp in d["okr_by_divisi"]:
            assert grp["label"] in ("OFF_TRACK", "NEED_IMPROVEMENT", "ON_TRACK")

    def test_save_notes_persist(self, client, period):
        orig = client.get(f"{API}/strategy/evaluation", params={"period_id": period["id"]}, timeout=60).json()["note"]
        payload = {
            "summary": "TEST_ringkasan evaluasi", "kesimpulan": "REWARD",
            "highlights": ["TEST_h1"], "improvements": ["TEST_i1"], "next_focus": ["TEST_f1"],
        }
        r = client.put(f"{API}/strategy/evaluation", params={"period_id": period["id"]}, json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        got = client.get(f"{API}/strategy/evaluation", params={"period_id": period["id"]}, timeout=60).json()["note"]
        assert got["summary"] == "TEST_ringkasan evaluasi"
        assert got["kesimpulan"] == "REWARD"
        assert got["highlights"] == ["TEST_h1"]
        # restore
        client.put(f"{API}/strategy/evaluation", params={"period_id": period["id"]}, json={
            "summary": orig.get("summary", ""), "kesimpulan": orig.get("kesimpulan", "NETRAL"),
            "highlights": orig.get("highlights", []), "improvements": orig.get("improvements", []),
            "next_focus": orig.get("next_focus", [])}, timeout=30)

    def test_evaluasi_pdf(self, client, period):
        r = client.get(f"{API}/strategy/evaluasi.pdf", params={"period_id": period["id"]}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 1000

    def test_evaluasi_pdf_bad_period_404(self, client):
        r = client.get(f"{API}/strategy/evaluasi.pdf", params={"period_id": "nope"}, timeout=60)
        assert r.status_code == 404

    def test_evaluation_requires_auth(self, period):
        r = requests.get(f"{API}/strategy/evaluation", params={"period_id": period["id"]}, timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ============ MONITORING HEATMAP ============
class TestHeatmap:
    def test_workload_heatmap(self, client):
        r = client.get(f"{API}/monitoring/workload-heatmap", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["statuses"] == ["BELUM_MULAI", "DALAM_PROSES", "TERKENDALA", "SELESAI", "OVERDUE"]
        assert isinstance(d["divisi"], list)
        assert isinstance(d["max"], int) and d["max"] >= 1
        for row in d["divisi"]:
            assert "_id" not in row
            assert "nama" in row and "cells" in row
            for s in d["statuses"]:
                assert isinstance(row["cells"][s], int)
            assert row["total"] >= 0
        for s in d["statuses"]:
            assert d["totals"][s] == sum(r_["cells"][s] for r_ in d["divisi"])
        assert d["totals"]["total"] == sum(r_["total"] for r_ in d["divisi"])

    def test_heatmap_requires_auth(self):
        r = requests.get(f"{API}/monitoring/workload-heatmap", timeout=30)
        assert r.status_code in (401, 403)
