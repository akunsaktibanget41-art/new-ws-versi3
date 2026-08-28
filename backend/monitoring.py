"""SPV/Head Monitoring endpoints: deadline radar, workload, compliance, stagnation, division progress."""
from datetime import datetime, timezone, timedelta, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase


def build_monitoring_router(db: AsyncIOMotorDatabase, get_current_user, user_scope) -> APIRouter:
    router = APIRouter(prefix="/monitoring", tags=["monitoring"])

    def _today():
        return date.today().isoformat()

    def _days_from_today(n):
        return (date.today() + timedelta(days=n)).isoformat()

    async def _guard(user, divisi_id=None):
        """SPV → full access. Head → restricted to own divisi. Else → 403."""
        scope = await user_scope(user)
        if scope["is_spv"]:
            return {"is_spv": True, "divisi": divisi_id}
        if scope.get("head_divisi_id"):
            return {"is_spv": False, "divisi": scope["head_divisi_id"]}
        raise HTTPException(403, "Hanya SPV atau Head Divisi yang bisa mengakses monitoring.")

    @router.get("/deadline-radar")
    async def deadline_radar(divisi_id: Optional[str] = None, user: dict = Depends(get_current_user)):
        g = await _guard(user, divisi_id)
        if not g["is_spv"]:
            divisi_id = g["divisi"]
        base = {"archived": {"$ne": True}, "status": {"$ne": "SELESAI"}}
        if divisi_id:
            base["divisi_id"] = divisi_id
        today = _today()
        d3 = _days_from_today(3)

        overdue = await db.tasks.find({**base, "deadline": {"$lt": today, "$ne": None}}, {"_id": 0}).sort("deadline", 1).to_list(500)
        today_tasks = await db.tasks.find({**base, "deadline": today}, {"_id": 0}).to_list(500)
        upcoming = await db.tasks.find({**base, "deadline": {"$gt": today, "$lte": d3}}, {"_id": 0}).sort("deadline", 1).to_list(500)

        anggota = await db.anggota.find({}, {"_id": 0}).to_list(500)
        anggota_map = {a["id"]: a["nama"] for a in anggota}
        divisi = await db.divisi.find({}, {"_id": 0}).to_list(200)
        divisi_map = {d["id"]: d["nama"] for d in divisi}

        def _decorate(rows):
            return [{
                **r,
                "penerima_nama": anggota_map.get(r.get("penerima_tugas_id"), r.get("penerima_tugas") or "-"),
                "divisi_nama": divisi_map.get(r.get("divisi_id"), "-"),
            } for r in rows]

        return {
            "overdue": _decorate(overdue),
            "today": _decorate(today_tasks),
            "upcoming": _decorate(upcoming),
            "summary": {
                "overdue": len(overdue),
                "today": len(today_tasks),
                "upcoming": len(upcoming),
            },
        }

    @router.get("/workload")
    async def workload(divisi_id: Optional[str] = None, user: dict = Depends(get_current_user)):
        g = await _guard(user, divisi_id)
        if not g["is_spv"]:
            divisi_id = g["divisi"]
        anggota_q = {}
        if divisi_id:
            anggota_q["divisi_id"] = divisi_id
        anggota = await db.anggota.find(anggota_q, {"_id": 0}).sort("urutan", 1).to_list(500)
        divisi = await db.divisi.find({}, {"_id": 0}).to_list(200)
        divisi_map = {d["id"]: d["nama"] for d in divisi}
        rows = []
        for a in anggota:
            base = {"penerima_tugas_id": a["id"], "archived": {"$ne": True}}
            active = await db.tasks.count_documents({**base, "status": {"$ne": "SELESAI"}})
            proses = await db.tasks.count_documents({**base, "status": "DALAM_PROSES"})
            kendala = await db.tasks.count_documents({**base, "status": "TERKENDALA"})
            belum = await db.tasks.count_documents({**base, "status": "BELUM_MULAI"})
            overdue = await db.tasks.count_documents({**base, "status": {"$ne": "SELESAI"}, "deadline": {"$lt": _today(), "$ne": None}})
            rows.append({
                **a,
                "divisi_nama": divisi_map.get(a.get("divisi_id"), "-"),
                "aktif": active,
                "proses": proses,
                "kendala": kendala,
                "belum": belum,
                "overdue": overdue,
            })
        rows.sort(key=lambda x: x["aktif"], reverse=True)
        max_val = max([r["aktif"] for r in rows] + [1])
        return {"anggota": rows, "max": max_val}

    @router.get("/amaliyah-compliance")
    async def amaliyah_compliance(days: int = 7, user: dict = Depends(get_current_user)):
        g = await _guard(user)
        if not g["is_spv"]:
            raise HTTPException(403, "Data kepatuhan amaliyah hanya untuk SPV.")
        end = date.today()
        start = end - timedelta(days=days - 1)
        start_s, end_s = start.isoformat(), end.isoformat()
        items = await db.amaliyah_items.find({}, {"_id": 0}).sort("urutan", 1).to_list(500)
        entries = await db.amaliyah_entries.find(
            {"tanggal": {"$gte": start_s, "$lte": end_s}, "checked": True},
            {"_id": 0},
        ).to_list(20000)
        by_item = {}
        for e in entries:
            by_item[e["item_id"]] = by_item.get(e["item_id"], 0) + 1

        result = []
        for it in items:
            done = by_item.get(it["id"], 0)
            target = days
            pct = round(done / target * 100, 1) if target else 0
            result.append({**it, "done": done, "target": target, "pct": pct})
        result.sort(key=lambda x: x["pct"], reverse=True)
        total_target = sum(r["target"] for r in result) or 1
        total_done = sum(r["done"] for r in result)
        return {
            "days": days,
            "start": start_s,
            "end": end_s,
            "items": result,
            "overall_pct": round(total_done / total_target * 100, 1),
        }

    @router.get("/stagnant-tasks")
    async def stagnant_tasks(days: int = 3, user: dict = Depends(get_current_user)):
        g = await _guard(user)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        stg_q = {
            "archived": {"$ne": True},
            "status": {"$in": ["BELUM_MULAI", "DALAM_PROSES", "TERKENDALA"]},
            "updated_at": {"$lt": cutoff},
        }
        if not g["is_spv"]:
            stg_q["divisi_id"] = g["divisi"]
        rows = await db.tasks.find(stg_q, {"_id": 0}).sort("updated_at", 1).to_list(500)

        anggota = await db.anggota.find({}, {"_id": 0}).to_list(500)
        anggota_map = {a["id"]: a["nama"] for a in anggota}
        divisi = await db.divisi.find({}, {"_id": 0}).to_list(200)
        divisi_map = {d["id"]: d["nama"] for d in divisi}
        out = [{
            **r,
            "penerima_nama": anggota_map.get(r.get("penerima_tugas_id"), r.get("penerima_tugas") or "-"),
            "divisi_nama": divisi_map.get(r.get("divisi_id"), "-"),
            "hari_diam": (datetime.now(timezone.utc) - datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00") if "Z" in r["updated_at"] else r["updated_at"])).days if r.get("updated_at") else 0,
        } for r in rows]
        return {"days_threshold": days, "tasks": out}

    @router.get("/division-progress")
    async def division_progress(user: dict = Depends(get_current_user)):
        g = await _guard(user)
        div_q = {} if g["is_spv"] else {"id": g["divisi"]}
        divisi = await db.divisi.find(div_q, {"_id": 0}).sort("urutan", 1).to_list(200)
        rows = []
        for d in divisi:
            base = {"divisi_id": d["id"], "archived": {"$ne": True}}
            total = await db.tasks.count_documents(base)
            selesai = await db.tasks.count_documents({**base, "status": "SELESAI"})
            terkendala = await db.tasks.count_documents({**base, "status": "TERKENDALA"})
            overdue = await db.tasks.count_documents({**base, "status": {"$ne": "SELESAI"}, "deadline": {"$lt": _today(), "$ne": None}})
            pct = round(selesai / total * 100, 1) if total else 0
            rows.append({**d, "total": total, "selesai": selesai, "terkendala": terkendala, "overdue": overdue, "pct": pct})
        return {"divisi": rows}

    @router.get("/workload-heatmap")
    async def workload_heatmap(user: dict = Depends(get_current_user)):
        """Matrix divisi × status untuk peta beban tim (heatmap)."""
        g = await _guard(user)
        statuses = ["BELUM_MULAI", "DALAM_PROSES", "TERKENDALA", "SELESAI", "OVERDUE"]
        div_q = {} if g["is_spv"] else {"id": g["divisi"]}
        divisi = await db.divisi.find(div_q, {"_id": 0}).sort("urutan", 1).to_list(200)
        today = _today()
        rows = []
        max_cell = 1
        for d in divisi:
            base = {"divisi_id": d["id"], "archived": {"$ne": True}}
            cells = {
                "BELUM_MULAI": await db.tasks.count_documents({**base, "status": "BELUM_MULAI"}),
                "DALAM_PROSES": await db.tasks.count_documents({**base, "status": "DALAM_PROSES"}),
                "TERKENDALA": await db.tasks.count_documents({**base, "status": "TERKENDALA"}),
                "SELESAI": await db.tasks.count_documents({**base, "status": "SELESAI"}),
                "OVERDUE": await db.tasks.count_documents({**base, "status": {"$ne": "SELESAI"}, "deadline": {"$lt": today, "$ne": None}}),
            }
            total = await db.tasks.count_documents(base)
            active = cells["BELUM_MULAI"] + cells["DALAM_PROSES"] + cells["TERKENDALA"]
            for v in cells.values():
                max_cell = max(max_cell, v)
            rows.append({**d, "cells": cells, "total": total, "aktif": active})
        totals = {s: sum(r["cells"][s] for r in rows) for s in statuses}
        totals["total"] = sum(r["total"] for r in rows)
        return {"statuses": statuses, "divisi": rows, "max": max_cell, "totals": totals}

    @router.get("/user/{anggota_id}")
    async def user_monitoring(anggota_id: str, days: int = 7, user: dict = Depends(get_current_user)):
        """Combined per-anggota monitoring: deadline radar, workload, amaliyah compliance, stagnant tasks."""
        g = await _guard(user)
        ang = await db.anggota.find_one({"id": anggota_id}, {"_id": 0})
        if not ang:
            return {"error": "anggota_not_found"}
        if not g["is_spv"] and ang.get("divisi_id") != g["divisi"]:
            raise HTTPException(403, "Anggota ini di luar divisi Anda.")
        div = await db.divisi.find_one({"id": ang.get("divisi_id")}, {"_id": 0}) if ang.get("divisi_id") else None
        ang["divisi_nama"] = div.get("nama") if div else "-"
        ang["divisi_warna"] = div.get("warna") if div else "#059669"

        base = {"penerima_tugas_id": anggota_id, "archived": {"$ne": True}}
        today = _today()
        d3 = _days_from_today(3)

        overdue = await db.tasks.find({**base, "status": {"$ne": "SELESAI"}, "deadline": {"$lt": today, "$ne": None}}, {"_id": 0}).sort("deadline", 1).to_list(200)
        today_tasks = await db.tasks.find({**base, "status": {"$ne": "SELESAI"}, "deadline": today}, {"_id": 0}).to_list(200)
        upcoming = await db.tasks.find({**base, "status": {"$ne": "SELESAI"}, "deadline": {"$gt": today, "$lte": d3}}, {"_id": 0}).sort("deadline", 1).to_list(200)

        # Workload
        aktif = await db.tasks.count_documents({**base, "status": {"$ne": "SELESAI"}})
        selesai = await db.tasks.count_documents({**base, "status": "SELESAI"})
        proses = await db.tasks.count_documents({**base, "status": "DALAM_PROSES"})
        kendala = await db.tasks.count_documents({**base, "status": "TERKENDALA"})
        belum = await db.tasks.count_documents({**base, "status": "BELUM_MULAI"})
        total = aktif + selesai
        pct = round(selesai / total * 100, 1) if total else 0

        # Stagnant tasks (user-scoped)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        stg = await db.tasks.find({**base, "status": {"$in": ["BELUM_MULAI", "DALAM_PROSES", "TERKENDALA"]}, "updated_at": {"$lt": cutoff}}, {"_id": 0}).sort("updated_at", 1).to_list(100)
        stg_out = []
        for r in stg:
            try:
                iso = r["updated_at"].replace("Z", "+00:00") if "Z" in (r.get("updated_at") or "") else r.get("updated_at")
                hari = (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).days if iso else 0
            except Exception:
                hari = 0
            stg_out.append({**r, "hari_diam": hari})

        # Amaliyah compliance (only if linked to user)
        amal = {"overall_pct": 0, "items": [], "days": days, "start": "-", "end": "-", "linked": False}
        if ang.get("user_id"):
            end_d = date.today()
            start_d = end_d - timedelta(days=days - 1)
            items = await db.amaliyah_items.find({}, {"_id": 0}).sort("urutan", 1).to_list(500)
            entries = await db.amaliyah_entries.find({
                "tanggal": {"$gte": start_d.isoformat(), "$lte": end_d.isoformat()},
                "checked": True,
                "user_id": ang["user_id"],
            }, {"_id": 0}).to_list(20000)
            by_item = {}
            for e in entries:
                by_item[e["item_id"]] = by_item.get(e["item_id"], 0) + 1
            arr = []
            for it in items:
                done = by_item.get(it["id"], 0)
                pct_a = round(done / days * 100, 1) if days else 0
                arr.append({**it, "done": done, "target": days, "pct": pct_a})
            arr.sort(key=lambda x: x["pct"], reverse=True)
            total_target = len(items) * days or 1
            total_done = sum(a["done"] for a in arr)
            amal = {
                "overall_pct": round(total_done / total_target * 100, 1),
                "items": arr,
                "days": days,
                "start": start_d.isoformat(),
                "end": end_d.isoformat(),
                "linked": True,
            }

        return {
            "anggota": ang,
            "deadline": {
                "overdue": overdue, "today": today_tasks, "upcoming": upcoming,
                "summary": {"overdue": len(overdue), "today": len(today_tasks), "upcoming": len(upcoming)},
            },
            "workload": {
                "aktif": aktif, "selesai": selesai, "proses": proses, "kendala": kendala,
                "belum": belum, "total": total, "pct": pct,
            },
            "stagnant": stg_out,
            "amaliyah": amal,
        }

    return router
