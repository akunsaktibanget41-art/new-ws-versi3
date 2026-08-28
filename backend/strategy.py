"""Strategy & Execution module for Ruang Sanad — BSC, OKR, KPI, Action Plan, Linimasa.

Collections used (all UUID id, no ObjectId leakage):
- strategy_periods: {id, nama, start, end, active, siklus_bulan}
- strategy_vision: {period_id, visi, misi[], nilai[], updated_at}
- bsc_targets: {id, period_id, aspek, nama, target, achieved, urutan}
- okr_objectives: {id, period_id, level (COMPANY|DIVISI|INDIVIDU), divisi_id?, owner_id?, supporter_ids[], objective, bsc_target_id?, urutan}
- okr_keyresults: {id, objective_id, nama, target, actual, urutan}
- kpi_items: {id, period_id, anggota_id, indikator, polaritas (MAX|MIN), bobot, target, aktual, okr_id?, urutan}
- strategy_projects: {id, period_id, nama, outcome, omtm, anggaran, divisi_id?, owner_id?, tim_ids[], task_ids[], start, end}
"""
import io
import uuid
from datetime import datetime, timezone, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ConfigDict

from komitmen_pdf import build_komitmen_pdf
from evaluasi_pdf import build_evaluasi_pdf


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_strategy_router(db, get_current_user, require_spv, user_scope):
    router = APIRouter(prefix="/strategy", tags=["strategy"])

    # ============ MODELS ============
    class PeriodCreate(BaseModel):
        nama: str
        start: str  # YYYY-MM-DD
        end: str
        siklus_bulan: int = 3  # 2 = siklus 2-bulanan, 3 = kuartal, etc.
        active: bool = False

    class PeriodUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        nama: Optional[str] = None
        start: Optional[str] = None
        end: Optional[str] = None
        siklus_bulan: Optional[int] = None
        active: Optional[bool] = None

    class BscIndikator(BaseModel):
        model_config = ConfigDict(extra="ignore")
        id: Optional[str] = None
        nama: str = ""
        target: str = ""
        realisasi: str = ""

    class BscCreate(BaseModel):
        period_id: str
        aspek: str  # FINANCIAL | CUSTOMER | INTERNAL | LEARNING
        judul: str = ""
        indikators: List[BscIndikator] = Field(default_factory=list)
        urutan: int = 0

    class BscUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        judul: Optional[str] = None
        indikators: Optional[List[BscIndikator]] = None
        urutan: Optional[int] = None

    class OkrCreate(BaseModel):
        period_id: str
        level: str = "DIVISI"  # COMPANY | DIVISI | INDIVIDU
        divisi_id: Optional[str] = None
        owner_id: Optional[str] = None  # anggota_id (dynamic — SPV picks who holds this OKR)
        owner_jabatan: Optional[str] = None  # free-text job title assigned to the owner
        supporter_ids: List[str] = Field(default_factory=list)
        objective: str
        bsc_target_id: Optional[str] = None  # link to BSC goal (BSC → OKR alignment)
        urutan: int = 0

    class OkrUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        level: Optional[str] = None
        divisi_id: Optional[str] = None
        owner_id: Optional[str] = None
        owner_jabatan: Optional[str] = None
        supporter_ids: Optional[List[str]] = None
        objective: Optional[str] = None
        bsc_target_id: Optional[str] = None
        urutan: Optional[int] = None

    class KrCreate(BaseModel):
        nama: str
        polaritas: str = "MAX"  # MAX (lebih tinggi lebih baik) | MIN (lebih rendah lebih baik)
        baseline: str = ""  # optional starting point
        target: str = ""
        actual: str = ""  # realisasi
        urutan: int = 0

    class KrUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        nama: Optional[str] = None
        polaritas: Optional[str] = None
        baseline: Optional[str] = None
        target: Optional[str] = None
        actual: Optional[str] = None
        urutan: Optional[int] = None

    class InitiativeCreate(BaseModel):
        nama: str
        kr_id: Optional[str] = None
        pic_id: Optional[str] = None  # anggota_id
        deadline: Optional[str] = None  # YYYY-MM-DD
        status: str = "BELUM"  # BELUM | SELESAI

    class InitiativeUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        nama: Optional[str] = None
        kr_id: Optional[str] = None
        pic_id: Optional[str] = None
        deadline: Optional[str] = None
        status: Optional[str] = None

    class KpiCreate(BaseModel):
        period_id: str
        anggota_id: str
        indikator: str
        polaritas: str = "MAX"  # MAX | MIN
        bobot: float = 0
        target: float = 0
        aktual: float = 0
        okr_id: Optional[str] = None
        urutan: int = 0

    class KpiUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        anggota_id: Optional[str] = None
        indikator: Optional[str] = None
        polaritas: Optional[str] = None
        bobot: Optional[float] = None
        target: Optional[float] = None
        aktual: Optional[float] = None
        okr_id: Optional[str] = None
        urutan: Optional[int] = None

    class ProjectCreate(BaseModel):
        period_id: str
        nama: str
        outcome: str = ""
        omtm: str = ""  # One Metric That Matters
        anggaran: float = 0
        divisi_id: Optional[str] = None
        owner_id: Optional[str] = None
        tim_ids: List[str] = Field(default_factory=list)
        task_ids: List[str] = Field(default_factory=list)
        start: Optional[str] = None
        end: Optional[str] = None

    class ProjectUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        nama: Optional[str] = None
        outcome: Optional[str] = None
        omtm: Optional[str] = None
        anggaran: Optional[float] = None
        divisi_id: Optional[str] = None
        owner_id: Optional[str] = None
        tim_ids: Optional[List[str]] = None
        task_ids: Optional[List[str]] = None
        start: Optional[str] = None
        end: Optional[str] = None

    class LinkTasksPayload(BaseModel):
        task_ids: List[str]

    # ============ HELPERS ============
    def _score_kpi(polaritas: str, bobot: float, target: float, aktual: float) -> tuple[float, str]:
        """Return (weighted_score_pct, status). Score = min(100, achievement) * bobot."""
        if target == 0:
            achievement = 100 if aktual == 0 else 0
        elif polaritas == "MIN":
            # for min, lower actual is better. formula: target/aktual
            achievement = min(200, (target / aktual) * 100) if aktual > 0 else 100
        else:
            achievement = min(200, (aktual / target) * 100)
        weighted = round((achievement / 100.0) * bobot, 2)
        # Status thresholds
        if achievement >= 100:
            status = "EXCELLENT"
        elif achievement >= 80:
            status = "ON_TRACK"
        elif achievement >= 60:
            status = "AT_RISK"
        else:
            status = "OFF_TRACK"
        return weighted, status

    def _kr_pct(kr: dict) -> Optional[float]:
        """KR achievement % respecting polaritas + optional baseline. Returns None if not measurable."""
        try:
            tgt = float(kr.get("target") or 0)
        except (TypeError, ValueError):
            return None
        try:
            act = float(kr.get("actual") or 0)
        except (TypeError, ValueError):
            act = 0.0
        base = None
        try:
            if kr.get("baseline") not in (None, ""):
                base = float(kr.get("baseline"))
        except (TypeError, ValueError):
            base = None
        pol = (kr.get("polaritas") or "MAX").upper()
        if pol == "MIN":
            if base is not None and base != tgt:
                pct = (base - act) / (base - tgt) * 100
            elif act > 0:
                pct = (tgt / act) * 100
            else:
                pct = 100.0 if tgt == 0 else 0.0
        else:  # MAX
            if base is not None and (tgt - base) != 0:
                pct = (act - base) / (tgt - base) * 100
            elif tgt > 0:
                pct = (act / tgt) * 100
            elif tgt == 0 and act == 0:
                return None
            else:
                pct = 0.0
        return round(max(0.0, min(200.0, pct)), 1)

    def _okr_progress(kr_list: list) -> float:
        pcts = [p for p in (_kr_pct(kr) for kr in kr_list) if p is not None]
        return round(sum(pcts) / len(pcts), 1) if pcts else 0.0

    def _okr_label(pct: float) -> str:
        """<51 OFF_TRACK (red) · 51–70 NEED_IMPROVEMENT (yellow) · >=71 ON_TRACK (green)."""
        if pct < 51:
            return "OFF_TRACK"
        if pct <= 70:
            return "NEED_IMPROVEMENT"
        return "ON_TRACK"

    async def _my_anggota_id(user: dict) -> Optional[str]:
        """Return the anggota_id linked to the current user, or None if unlinked.

        Auth stores linkage on user.anggota_id (set via PUT /api/auth/users/{uid} {anggota_id}).
        We use the shared user_scope() helper to be consistent with the rest of the app.
        """
        scope = await user_scope(user)
        return scope.get("anggota_id")

    async def _decorate_anggota_map():
        rows = await db.anggota.find({}, {"_id": 0}).to_list(500)
        return {r["id"]: r for r in rows}

    async def _decorate_divisi_map():
        rows = await db.divisi.find({}, {"_id": 0}).to_list(200)
        return {r["id"]: r for r in rows}

    # ================================================================
    # PERIODS
    # ================================================================
    @router.get("/periods")
    async def list_periods(_: dict = Depends(get_current_user)):
        rows = await db.strategy_periods.find({}, {"_id": 0}).sort("start", -1).to_list(200)
        return rows

    @router.get("/periods/active")
    async def get_active_period(_: dict = Depends(get_current_user)):
        row = await db.strategy_periods.find_one({"active": True}, {"_id": 0})
        return row or None

    @router.post("/periods")
    async def create_period(payload: PeriodCreate, _: dict = Depends(require_spv)):
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["created_at"] = _now()
        if data.get("active"):
            await db.strategy_periods.update_many({}, {"$set": {"active": False}})
        await db.strategy_periods.insert_one(data)
        data.pop("_id", None)
        return data

    @router.put("/periods/{pid}")
    async def update_period(pid: str, payload: PeriodUpdate, _: dict = Depends(require_spv)):
        update = payload.model_dump(exclude_unset=True)
        if update.get("active"):
            await db.strategy_periods.update_many({"id": {"$ne": pid}}, {"$set": {"active": False}})
        result = await db.strategy_periods.find_one_and_update(
            {"id": pid}, {"$set": update}, return_document=True, projection={"_id": 0}
        )
        if not result:
            raise HTTPException(404, "Periode tidak ditemukan.")
        return result

    @router.delete("/periods/{pid}")
    async def delete_period(pid: str, _: dict = Depends(require_spv)):
        r = await db.strategy_periods.delete_one({"id": pid})
        # Cascade cleanup
        await db.bsc_targets.delete_many({"period_id": pid})
        await db.bsc_goals.delete_many({"period_id": pid})
        objs = await db.okr_objectives.find({"period_id": pid}, {"id": 1}).to_list(500)
        oids = [o["id"] for o in objs]
        await db.okr_keyresults.delete_many({"objective_id": {"$in": oids}})
        await db.okr_initiatives.delete_many({"objective_id": {"$in": oids}})
        await db.okr_objectives.delete_many({"period_id": pid})
        await db.kpi_items.delete_many({"period_id": pid})
        await db.strategy_projects.delete_many({"period_id": pid})
        await db.strategy_evaluations.delete_many({"period_id": pid})
        await db.strategy_vision.delete_many({"period_id": pid})
        return {"ok": True, "deleted": r.deleted_count}

    @router.post("/periods/{pid}/activate")
    async def activate_period(pid: str, _: dict = Depends(require_spv)):
        exists = await db.strategy_periods.find_one({"id": pid}, {"_id": 0})
        if not exists:
            raise HTTPException(404, "Periode tidak ditemukan.")
        await db.strategy_periods.update_many({}, {"$set": {"active": False}})
        await db.strategy_periods.update_one({"id": pid}, {"$set": {"active": True}})
        return {"ok": True}

    # ================================================================
    # BSC — Goals per aspek, each with embedded KPI indicators
    # ================================================================
    @router.get("/bsc")
    async def list_bsc(period_id: str, _: dict = Depends(get_current_user)):
        rows = await db.bsc_goals.find({"period_id": period_id}, {"_id": 0}).sort([("aspek", 1), ("urutan", 1)]).to_list(500)
        return rows

    @router.post("/bsc")
    async def create_bsc(payload: BscCreate, _: dict = Depends(require_spv)):
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["created_at"] = _now()
        for ind in data.get("indikators") or []:
            if not ind.get("id"):
                ind["id"] = str(uuid.uuid4())
        await db.bsc_goals.insert_one(data)
        data.pop("_id", None)
        return data

    @router.put("/bsc/{bid}")
    async def update_bsc(bid: str, payload: BscUpdate, _: dict = Depends(require_spv)):
        update = payload.model_dump(exclude_unset=True)
        if "indikators" in update:
            for ind in update["indikators"] or []:
                if not ind.get("id"):
                    ind["id"] = str(uuid.uuid4())
        r = await db.bsc_goals.find_one_and_update({"id": bid}, {"$set": update}, return_document=True, projection={"_id": 0})
        if not r:
            raise HTTPException(404, "Goal BSC tidak ditemukan.")
        return r

    @router.delete("/bsc/{bid}")
    async def delete_bsc(bid: str, _: dict = Depends(require_spv)):
        r = await db.bsc_goals.delete_one({"id": bid})
        return {"ok": True, "deleted": r.deleted_count}

    # ================================================================
    # OKR
    # ================================================================
    @router.get("/okr")
    async def list_okr(period_id: str, anggota_id: Optional[str] = None, _: dict = Depends(get_current_user)):
        q = {"period_id": period_id}
        if anggota_id:
            q["$or"] = [{"owner_id": anggota_id}, {"supporter_ids": anggota_id}]
        objs = await db.okr_objectives.find(q, {"_id": 0}).sort([("level", 1), ("urutan", 1)]).to_list(500)
        oids = [o["id"] for o in objs]
        krs = await db.okr_keyresults.find({"objective_id": {"$in": oids}}, {"_id": 0}).sort("urutan", 1).to_list(2000)
        by_obj: dict = {}
        for k in krs:
            by_obj.setdefault(k["objective_id"], []).append(k)
        inits = await db.okr_initiatives.find({"objective_id": {"$in": oids}}, {"_id": 0}).sort("created_at", 1).to_list(2000)
        init_by_obj: dict = {}
        for it in inits:
            init_by_obj.setdefault(it["objective_id"], []).append(it)
        ang_map = await _decorate_anggota_map()
        div_map = await _decorate_divisi_map()
        # BSC goal map (for link decoration)
        bsc_ids = list({o.get("bsc_target_id") for o in objs if o.get("bsc_target_id")})
        bsc_map = {}
        if bsc_ids:
            bsc_rows = await db.bsc_goals.find({"id": {"$in": bsc_ids}}, {"_id": 0}).to_list(500)
            bsc_map = {b["id"]: {"id": b["id"], "aspek": b.get("aspek"), "nama": b.get("judul", "")} for b in bsc_rows}
        result = []
        for o in objs:
            kr_raw = by_obj.get(o["id"], [])
            kr_list = [{**kr, "pct": _kr_pct(kr)} for kr in kr_raw]
            progress = _okr_progress(kr_raw)
            owner = ang_map.get(o.get("owner_id")) if o.get("owner_id") else None
            supporters = [ang_map[i] for i in (o.get("supporter_ids") or []) if i in ang_map]
            divisi = div_map.get(o.get("divisi_id")) if o.get("divisi_id") else None
            bsc = bsc_map.get(o.get("bsc_target_id")) if o.get("bsc_target_id") else None
            initiatives = []
            for it in init_by_obj.get(o["id"], []):
                pic = ang_map.get(it.get("pic_id")) if it.get("pic_id") else None
                initiatives.append({**it, "pic": {"id": pic["id"], "nama": pic["nama"]} if pic else None})
            result.append({
                **o,
                "key_results": kr_list,
                "progress": progress,
                "label": _okr_label(progress),
                "owner": owner,
                "supporters": supporters,
                "divisi": divisi,
                "bsc_target": bsc,
                "initiatives": initiatives,
            })
        return result

    @router.get("/okr/my")
    async def my_okr(period_id: str, user: dict = Depends(get_current_user)):
        # Resolve current user's anggota_id via user_scope (auth stores linkage on user.anggota_id)
        ang_id = await _my_anggota_id(user)
        if not ang_id:
            return []
        q = {"period_id": period_id, "$or": [{"owner_id": ang_id}, {"supporter_ids": ang_id}]}
        objs = await db.okr_objectives.find(q, {"_id": 0}).to_list(500)
        return objs

    @router.post("/okr")
    async def create_okr(payload: OkrCreate, _: dict = Depends(require_spv)):
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["created_at"] = _now()
        await db.okr_objectives.insert_one(data)
        data.pop("_id", None)
        return data

    @router.put("/okr/{oid}")
    async def update_okr(oid: str, payload: OkrUpdate, _: dict = Depends(require_spv)):
        update = payload.model_dump(exclude_unset=True)
        r = await db.okr_objectives.find_one_and_update({"id": oid}, {"$set": update}, return_document=True, projection={"_id": 0})
        if not r:
            raise HTTPException(404, "Objective tidak ditemukan.")
        return r

    @router.delete("/okr/{oid}")
    async def delete_okr(oid: str, _: dict = Depends(require_spv)):
        await db.okr_keyresults.delete_many({"objective_id": oid})
        await db.okr_initiatives.delete_many({"objective_id": oid})
        r = await db.okr_objectives.delete_one({"id": oid})
        return {"ok": True, "deleted": r.deleted_count}

    @router.post("/okr/{oid}/keyresults")
    async def add_kr(oid: str, payload: KrCreate, user: dict = Depends(get_current_user)):
        # Owner or SPV can add
        obj = await db.okr_objectives.find_one({"id": oid}, {"_id": 0})
        if not obj:
            raise HTTPException(404, "Objective tidak ditemukan.")
        scope = await user_scope(user)
        if not scope["is_spv"]:
            my_id = await _my_anggota_id(user)
            if my_id is None or obj.get("owner_id") != my_id:
                raise HTTPException(403, "Hanya SPV atau pemilik OKR yang bisa mengubah key result.")
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["objective_id"] = oid
        data["created_at"] = _now()
        await db.okr_keyresults.insert_one(data)
        data.pop("_id", None)
        return data

    @router.put("/okr/{oid}/keyresults/{kid}")
    async def update_kr(oid: str, kid: str, payload: KrUpdate, user: dict = Depends(get_current_user)):
        obj = await db.okr_objectives.find_one({"id": oid}, {"_id": 0})
        if not obj:
            raise HTTPException(404, "Objective tidak ditemukan.")
        scope = await user_scope(user)
        if not scope["is_spv"]:
            my_id = await _my_anggota_id(user)
            if my_id is None or (obj.get("owner_id") != my_id and my_id not in (obj.get("supporter_ids") or [])):
                raise HTTPException(403, "Hanya SPV, owner atau supporter yang bisa update KR.")
        update = payload.model_dump(exclude_unset=True)
        r = await db.okr_keyresults.find_one_and_update({"id": kid, "objective_id": oid}, {"$set": update}, return_document=True, projection={"_id": 0})
        if not r:
            raise HTTPException(404, "Key Result tidak ditemukan.")
        return r

    @router.delete("/okr/{oid}/keyresults/{kid}")
    async def delete_kr(oid: str, kid: str, _: dict = Depends(require_spv)):
        r = await db.okr_keyresults.delete_one({"id": kid, "objective_id": oid})
        # Detach initiatives linked to this KR
        await db.okr_initiatives.update_many({"objective_id": oid, "kr_id": kid}, {"$set": {"kr_id": None}})
        return {"ok": True, "deleted": r.deleted_count}

    # ---- Initiatives (sub-items under an OKR, optionally tied to a KR) ----
    async def _can_manage_okr(oid: str, user: dict) -> dict:
        obj = await db.okr_objectives.find_one({"id": oid}, {"_id": 0})
        if not obj:
            raise HTTPException(404, "Objective tidak ditemukan.")
        scope = await user_scope(user)
        if not scope["is_spv"]:
            my_id = await _my_anggota_id(user)
            if my_id is None or (obj.get("owner_id") != my_id and my_id not in (obj.get("supporter_ids") or [])):
                raise HTTPException(403, "Hanya SPV, owner atau supporter yang bisa mengubah initiative.")
        return obj

    @router.post("/okr/{oid}/initiatives")
    async def add_initiative(oid: str, payload: InitiativeCreate, user: dict = Depends(get_current_user)):
        await _can_manage_okr(oid, user)
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["objective_id"] = oid
        data["created_at"] = _now()
        await db.okr_initiatives.insert_one(data)
        data.pop("_id", None)
        return data

    @router.put("/okr/{oid}/initiatives/{iid}")
    async def update_initiative(oid: str, iid: str, payload: InitiativeUpdate, user: dict = Depends(get_current_user)):
        await _can_manage_okr(oid, user)
        update = payload.model_dump(exclude_unset=True)
        r = await db.okr_initiatives.find_one_and_update({"id": iid, "objective_id": oid}, {"$set": update}, return_document=True, projection={"_id": 0})
        if not r:
            raise HTTPException(404, "Initiative tidak ditemukan.")
        return r

    @router.delete("/okr/{oid}/initiatives/{iid}")
    async def delete_initiative(oid: str, iid: str, user: dict = Depends(get_current_user)):
        await _can_manage_okr(oid, user)
        r = await db.okr_initiatives.delete_one({"id": iid, "objective_id": oid})
        return {"ok": True, "deleted": r.deleted_count}

    # ================================================================
    # KPI
    # ================================================================
    @router.get("/kpi")
    async def list_kpi(period_id: str, _: dict = Depends(get_current_user)):
        rows = await db.kpi_items.find({"period_id": period_id}, {"_id": 0}).sort("urutan", 1).to_list(1000)
        ang_map = await _decorate_anggota_map()
        div_map = await _decorate_divisi_map()
        # OKR label
        okr_map: dict = {}
        okr_ids = list({r.get("okr_id") for r in rows if r.get("okr_id")})
        if okr_ids:
            okrs = await db.okr_objectives.find({"id": {"$in": okr_ids}}, {"_id": 0, "id": 1, "objective": 1}).to_list(500)
            okr_map = {o["id"]: o["objective"] for o in okrs}

        result = []
        total_bobot = sum(float(r.get("bobot") or 0) for r in rows)
        for r in rows:
            weighted, status = _score_kpi(r.get("polaritas") or "MAX", float(r.get("bobot") or 0),
                                          float(r.get("target") or 0), float(r.get("aktual") or 0))
            ang = ang_map.get(r.get("anggota_id"))
            divisi = div_map.get(ang.get("divisi_id")) if ang else None
            result.append({**r, "weighted_score": weighted, "status": status,
                           "anggota_nama": ang.get("nama") if ang else "-",
                           "divisi_nama": divisi.get("nama") if divisi else "-",
                           "okr_label": okr_map.get(r.get("okr_id")) if r.get("okr_id") else None})
        return {"items": result, "total_bobot": total_bobot,
                "final_score": round(sum(x["weighted_score"] for x in result), 2)}

    @router.post("/kpi")
    async def create_kpi(payload: KpiCreate, _: dict = Depends(require_spv)):
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["created_at"] = _now()
        await db.kpi_items.insert_one(data)
        data.pop("_id", None)
        return data

    @router.put("/kpi/{kid}")
    async def update_kpi(kid: str, payload: KpiUpdate, user: dict = Depends(get_current_user)):
        # SPV can update any field; anggota can only update `aktual` on their own KPI.
        kpi = await db.kpi_items.find_one({"id": kid}, {"_id": 0})
        if not kpi:
            raise HTTPException(404, "KPI tidak ditemukan.")
        scope = await user_scope(user)
        if not scope["is_spv"]:
            my_id = await _my_anggota_id(user)
            if my_id is None or kpi.get("anggota_id") != my_id:
                raise HTTPException(403, "Bukan KPI Anda.")
            # only `aktual` allowed — reject requests that include any other field (even null unset attempts)
            payload_set = payload.model_dump(exclude_unset=True)
            forbidden = [k for k in payload_set.keys() if k != "aktual"]
            if forbidden:
                raise HTTPException(403, f"Anggota hanya boleh update kolom 'aktual'. Ditolak: {', '.join(forbidden)}")
        update = payload.model_dump(exclude_unset=True)
        r = await db.kpi_items.find_one_and_update({"id": kid}, {"$set": update}, return_document=True, projection={"_id": 0})
        return r

    @router.delete("/kpi/{kid}")
    async def delete_kpi(kid: str, _: dict = Depends(require_spv)):
        r = await db.kpi_items.delete_one({"id": kid})
        return {"ok": True, "deleted": r.deleted_count}

    # ================================================================
    # PROJECTS (ACTION PLAN + LINIMASA)
    # ================================================================
    async def _decorate_project(p: dict, ang_map: dict, div_map: dict, tasks_map: dict) -> dict:
        linked = [tasks_map[i] for i in (p.get("task_ids") or []) if i in tasks_map]
        total = len(linked)
        selesai = sum(1 for t in linked if t.get("status") == "SELESAI")
        proses = sum(1 for t in linked if t.get("status") == "DALAM_PROSES")
        kendala = sum(1 for t in linked if t.get("status") == "TERKENDALA")
        overdue = sum(1 for t in linked if t.get("deadline") and t.get("deadline") < date.today().isoformat() and t.get("status") != "SELESAI")
        pct = round((selesai / total * 100) if total else 0, 1)
        # derive start/end from linked tasks if not explicit
        starts = [t.get("tanggal_mulai") for t in linked if t.get("tanggal_mulai")]
        ends = [t.get("deadline") for t in linked if t.get("deadline")]
        auto_start = min(starts) if starts else None
        auto_end = max(ends) if ends else None
        status = "OFF_TRACK"
        if selesai == total and total > 0:
            status = "SELESAI"
        elif overdue > 0:
            status = "TERLAMBAT"
        elif total > 0:
            status = "BERJALAN"
        else:
            status = "BELUM_MULAI"
        return {
            **p,
            "owner": ang_map.get(p.get("owner_id")),
            "divisi": div_map.get(p.get("divisi_id")),
            "tim": [ang_map[i] for i in (p.get("tim_ids") or []) if i in ang_map],
            "tasks": linked,
            "summary": {"total": total, "selesai": selesai, "proses": proses, "kendala": kendala, "overdue": overdue, "pct": pct, "status": status},
            "start_effective": p.get("start") or auto_start,
            "end_effective": p.get("end") or auto_end,
        }

    @router.get("/projects")
    async def list_projects(period_id: str, _: dict = Depends(get_current_user)):
        rows = await db.strategy_projects.find({"period_id": period_id}, {"_id": 0}).sort("start", 1).to_list(500)
        all_task_ids = []
        for r in rows:
            all_task_ids.extend(r.get("task_ids") or [])
        tasks_map = {}
        if all_task_ids:
            trows = await db.tasks.find({"id": {"$in": all_task_ids}}, {"_id": 0}).to_list(5000)
            tasks_map = {t["id"]: t for t in trows}
        ang_map = await _decorate_anggota_map()
        div_map = await _decorate_divisi_map()
        return [await _decorate_project(p, ang_map, div_map, tasks_map) for p in rows]

    @router.post("/projects")
    async def create_project(payload: ProjectCreate, _: dict = Depends(require_spv)):
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["created_at"] = _now()
        await db.strategy_projects.insert_one(data)
        data.pop("_id", None)
        return data

    @router.put("/projects/{pid}")
    async def update_project(pid: str, payload: ProjectUpdate, _: dict = Depends(require_spv)):
        update = payload.model_dump(exclude_unset=True)
        r = await db.strategy_projects.find_one_and_update({"id": pid}, {"$set": update}, return_document=True, projection={"_id": 0})
        if not r:
            raise HTTPException(404, "Proyek tidak ditemukan.")
        return r

    @router.delete("/projects/{pid}")
    async def delete_project(pid: str, _: dict = Depends(require_spv)):
        r = await db.strategy_projects.delete_one({"id": pid})
        return {"ok": True, "deleted": r.deleted_count}

    @router.post("/projects/{pid}/link-tasks")
    async def link_tasks(pid: str, payload: LinkTasksPayload, _: dict = Depends(require_spv)):
        r = await db.strategy_projects.find_one_and_update(
            {"id": pid}, {"$addToSet": {"task_ids": {"$each": payload.task_ids}}},
            return_document=True, projection={"_id": 0},
        )
        if not r:
            raise HTTPException(404, "Proyek tidak ditemukan.")
        return r

    @router.post("/projects/{pid}/unlink-task")
    async def unlink_task(pid: str, payload: LinkTasksPayload, _: dict = Depends(require_spv)):
        r = await db.strategy_projects.find_one_and_update(
            {"id": pid}, {"$pull": {"task_ids": {"$in": payload.task_ids}}},
            return_document=True, projection={"_id": 0},
        )
        if not r:
            raise HTTPException(404, "Proyek tidak ditemukan.")
        return r

    # ================================================================
    # DASHBOARD
    # ================================================================
    @router.get("/dashboard")
    async def dashboard(period_id: str, _: dict = Depends(get_current_user)):
        bsc_count = await db.bsc_goals.count_documents({"period_id": period_id})
        objs = await db.okr_objectives.find({"period_id": period_id}, {"_id": 0}).to_list(500)
        oids = [o["id"] for o in objs]
        # OKR avg progress
        pcts = []
        krs = await db.okr_keyresults.find({"objective_id": {"$in": oids}}, {"_id": 0}).to_list(2000) if oids else []
        krs_by_obj: dict = {}
        for k in krs:
            krs_by_obj.setdefault(k["objective_id"], []).append(k)
        for o in objs:
            local = [p for p in (_kr_pct(kr) for kr in krs_by_obj.get(o["id"], [])) if p is not None]
            if local:
                pcts.append(sum(local) / len(local))
        avg_okr = round(sum(pcts) / len(pcts), 1) if pcts else 0

        kpi_rows = await db.kpi_items.find({"period_id": period_id}, {"_id": 0}).to_list(1000)
        total_bobot = sum(float(k.get("bobot") or 0) for k in kpi_rows)
        weighted_sum = 0.0
        for k in kpi_rows:
            w, _s = _score_kpi(k.get("polaritas") or "MAX", float(k.get("bobot") or 0),
                               float(k.get("target") or 0), float(k.get("aktual") or 0))
            weighted_sum += w
        kpi_final = round(weighted_sum, 2)

        projects = await db.strategy_projects.find({"period_id": period_id}, {"_id": 0}).to_list(500)
        all_tids = []
        for p in projects:
            all_tids.extend(p.get("task_ids") or [])
        tasks = await db.tasks.find({"id": {"$in": all_tids}}, {"_id": 0}).to_list(5000) if all_tids else []
        tmap = {t["id"]: t for t in tasks}
        proj_selesai = 0
        proj_terlambat = 0
        for p in projects:
            linked = [tmap[i] for i in (p.get("task_ids") or []) if i in tmap]
            total = len(linked)
            selesai = sum(1 for t in linked if t.get("status") == "SELESAI")
            overdue = sum(1 for t in linked if t.get("deadline") and t.get("deadline") < date.today().isoformat() and t.get("status") != "SELESAI")
            if total and selesai == total:
                proj_selesai += 1
            if overdue > 0:
                proj_terlambat += 1

        return {
            "bsc_count": bsc_count,
            "okr_count": len(objs),
            "okr_avg_progress": avg_okr,
            "kpi_count": len(kpi_rows),
            "kpi_total_bobot": total_bobot,
            "kpi_final_score": kpi_final,
            "project_count": len(projects),
            "project_selesai": proj_selesai,
            "project_terlambat": proj_terlambat,
        }

    # ================================================================
    # VISI & MISI (per period — anchor of strategy execution)
    # ================================================================
    class VisionUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        visi: Optional[str] = None
        misi: Optional[List[str]] = None
        nilai: Optional[List[str]] = None  # core values (optional)

    @router.get("/vision")
    async def get_vision(period_id: str, _: dict = Depends(get_current_user)):
        row = await db.strategy_vision.find_one({"period_id": period_id}, {"_id": 0})
        return row or {"period_id": period_id, "visi": "", "misi": [], "nilai": []}

    @router.put("/vision")
    async def upsert_vision(period_id: str, payload: VisionUpdate, _: dict = Depends(require_spv)):
        update = payload.model_dump(exclude_unset=True)
        update["updated_at"] = _now()
        update["period_id"] = period_id
        await db.strategy_vision.update_one({"period_id": period_id}, {"$set": update}, upsert=True)
        return await db.strategy_vision.find_one({"period_id": period_id}, {"_id": 0})

    # ================================================================
    # EVALUASI — Periode Review (SPV)
    # ================================================================
    class EvaluationUpdate(BaseModel):
        model_config = ConfigDict(extra="ignore")
        summary: Optional[str] = None
        kesimpulan: Optional[str] = None  # REWARD | EVALUASI | NETRAL
        highlights: Optional[List[str]] = None
        improvements: Optional[List[str]] = None
        next_focus: Optional[List[str]] = None

    @router.get("/evaluation")
    async def get_evaluation(period_id: str, _: dict = Depends(get_current_user)):
        """Auto-computed period review recap (Visi, BSC, OKR, Action Plan, KPI) + saved SPV notes."""
        note = await db.strategy_evaluations.find_one({"period_id": period_id}, {"_id": 0}) or {
            "period_id": period_id, "summary": "", "kesimpulan": "NETRAL",
            "highlights": [], "improvements": [], "next_focus": [],
        }
        period = await db.strategy_periods.find_one({"id": period_id}, {"_id": 0})
        vision = await db.strategy_vision.find_one({"period_id": period_id}, {"_id": 0}) or {"visi": "", "misi": [], "nilai": []}

        ang_map = await _decorate_anggota_map()
        div_map = await _decorate_divisi_map()

        # BSC goals (with indicators)
        bsc_goals = await db.bsc_goals.find({"period_id": period_id}, {"_id": 0}).sort([("aspek", 1), ("urutan", 1)]).to_list(500)
        bsc_by_aspek: dict = {"FINANCIAL": [], "CUSTOMER": [], "INTERNAL": [], "LEARNING": []}
        for b in bsc_goals:
            bsc_by_aspek.setdefault(b.get("aspek", "INTERNAL"), []).append(b)

        # OKR data
        okrs = await db.okr_objectives.find({"period_id": period_id}, {"_id": 0}).to_list(500)
        oids = [o["id"] for o in okrs]
        krs = await db.okr_keyresults.find({"objective_id": {"$in": oids}}, {"_id": 0}).to_list(2000) if oids else []
        krs_by_obj: dict = {}
        for k in krs:
            krs_by_obj.setdefault(k["objective_id"], []).append(k)

        okr_list = []
        for o in okrs:
            pct = _okr_progress(krs_by_obj.get(o["id"], []))
            okr_list.append({
                "id": o["id"], "objective": o.get("objective"),
                "owner_nama": (ang_map.get(o.get("owner_id")) or {}).get("nama") if o.get("owner_id") else None,
                "owner_jabatan": o.get("owner_jabatan"),
                "divisi_id": o.get("divisi_id"),
                "divisi_nama": (div_map.get(o.get("divisi_id")) or {}).get("nama") if o.get("divisi_id") else None,
                "level": o.get("level"),
                "progress": pct,
                "status": _okr_label(pct),
            })

        # OKR aggregate per divisi + overall
        okr_by_divisi = {}
        for o in okr_list:
            dv = o["divisi_nama"] or "Company / Umum"
            okr_by_divisi.setdefault(dv, {"nama": dv, "sum": 0.0, "n": 0})
            okr_by_divisi[dv]["sum"] += o["progress"]
            okr_by_divisi[dv]["n"] += 1
        okr_divisi_rank = sorted(
            [{"nama": d["nama"], "avg": round(d["sum"] / d["n"], 1) if d["n"] else 0,
              "label": _okr_label(round(d["sum"] / d["n"], 1) if d["n"] else 0), "count": d["n"]}
             for d in okr_by_divisi.values()],
            key=lambda x: x["avg"], reverse=True,
        )
        overall_okr = round(sum(o["progress"] for o in okr_list) / len(okr_list), 1) if okr_list else 0

        # KPI aggregated per anggota
        kpis = await db.kpi_items.find({"period_id": period_id}, {"_id": 0}).to_list(1000)
        kpi_total_bobot = sum(float(k.get("bobot") or 0) for k in kpis)
        kpi_final_score = 0.0
        by_anggota: dict = {}
        for k in kpis:
            w, st = _score_kpi(k.get("polaritas") or "MAX", float(k.get("bobot") or 0),
                               float(k.get("target") or 0), float(k.get("aktual") or 0))
            kpi_final_score += w
            aid = k.get("anggota_id")
            if aid not in by_anggota:
                ang = ang_map.get(aid)
                div = div_map.get(ang.get("divisi_id")) if ang else None
                by_anggota[aid] = {"anggota_id": aid, "anggota_nama": ang.get("nama") if ang else "-",
                                   "divisi_nama": div.get("nama") if div else "-", "bobot": 0, "score": 0, "count": 0}
            by_anggota[aid]["bobot"] += float(k.get("bobot") or 0)
            by_anggota[aid]["score"] += w
            by_anggota[aid]["count"] += 1
        kpi_final_score = round(kpi_final_score, 2)
        rank = sorted(by_anggota.values(), key=lambda x: x["score"], reverse=True)

        # Divisi ranking (avg of anggota KPI scores)
        div_agg: dict = {}
        for r in by_anggota.values():
            dv = r["divisi_nama"]
            div_agg.setdefault(dv, {"nama": dv, "score_sum": 0, "n": 0})
            div_agg[dv]["score_sum"] += r["score"]
            div_agg[dv]["n"] += 1
        div_rank = sorted([{"nama": d["nama"], "avg_score": round(d["score_sum"] / d["n"], 2) if d["n"] else 0} for d in div_agg.values()], key=lambda x: x["avg_score"], reverse=True)

        # Action Plan / Projects summary
        projects = await db.strategy_projects.find({"period_id": period_id}, {"_id": 0}).to_list(500)
        all_tids = []
        for p in projects:
            all_tids.extend(p.get("task_ids") or [])
        tasks = await db.tasks.find({"id": {"$in": all_tids}}, {"_id": 0}).to_list(5000) if all_tids else []
        tmap = {t["id"]: t for t in tasks}
        proj_list = []
        for p in projects:
            linked = [tmap[i] for i in (p.get("task_ids") or []) if i in tmap]
            total = len(linked)
            selesai = sum(1 for t in linked if t.get("status") == "SELESAI")
            overdue = sum(1 for t in linked if t.get("deadline") and t.get("deadline") < date.today().isoformat() and t.get("status") != "SELESAI")
            pct = round((selesai / total * 100) if total else 0, 1)
            status = "SELESAI" if (total and selesai == total) else "TERLAMBAT" if overdue > 0 else "BERJALAN" if total else "BELUM_MULAI"
            proj_list.append({"id": p["id"], "nama": p.get("nama"), "outcome": p.get("outcome"), "omtm": p.get("omtm"),
                              "divisi_nama": (div_map.get(p.get("divisi_id")) or {}).get("nama") if p.get("divisi_id") else "-",
                              "total": total, "selesai": selesai, "overdue": overdue, "pct": pct, "status": status})

        off_okrs = [o for o in okr_list if o["status"] == "OFF_TRACK"][:10]
        at_risk = [o for o in okr_list if o["status"] == "NEED_IMPROVEMENT"][:10]

        return {
            "note": note,
            "period": period,
            "vision": vision,
            "bsc_goals": bsc_goals,
            "bsc_summary": {k: len(v) for k, v in bsc_by_aspek.items()},
            "okr_list": okr_list,
            "okr_by_divisi": okr_divisi_rank,
            "okr_stats": {
                "total": len(okr_list),
                "on_track": sum(1 for o in okr_list if o["status"] == "ON_TRACK"),
                "need_improvement": len(at_risk),
                "off_track": len(off_okrs),
                "avg_progress": overall_okr,
            },
            "overall_okr": {"avg": overall_okr, "label": _okr_label(overall_okr)},
            "kpi_ranking": rank[:20],
            "kpi_final_score": kpi_final_score,
            "kpi_total_bobot": kpi_total_bobot,
            "divisi_ranking": div_rank,
            "projects": proj_list,
            "off_track_okrs": off_okrs,
            "at_risk_okrs": at_risk,
        }

    @router.put("/evaluation")
    async def upsert_evaluation(period_id: str, payload: EvaluationUpdate, _: dict = Depends(require_spv)):
        update = payload.model_dump(exclude_unset=True)
        update["period_id"] = period_id
        update["updated_at"] = _now()
        await db.strategy_evaluations.update_one({"period_id": period_id}, {"$set": update}, upsert=True)
        return await db.strategy_evaluations.find_one({"period_id": period_id}, {"_id": 0})

    # ================================================================
    # KOMITMEN — Surat Kesepakatan Target PDF per Divisi
    # ================================================================
    @router.get("/komitmen.pdf")
    async def komitmen_pdf(period_id: str, divisi_id: str, _: dict = Depends(require_spv)):
        period = await db.strategy_periods.find_one({"id": period_id}, {"_id": 0})
        if not period:
            raise HTTPException(404, "Periode tidak ditemukan.")
        divisi = await db.divisi.find_one({"id": divisi_id}, {"_id": 0})
        if not divisi:
            raise HTTPException(404, "Divisi tidak ditemukan.")
        vision = await db.strategy_vision.find_one({"period_id": period_id}, {"_id": 0}) or {}
        bsc_goals = await db.bsc_goals.find({"period_id": period_id}, {"_id": 0}).sort([("aspek", 1), ("urutan", 1)]).to_list(500)
        bsc = []
        for g in bsc_goals:
            inds = [x for x in (g.get("indikators") or []) if (x.get("nama") or x.get("target") or x.get("realisasi"))]
            if inds:
                for ind in inds:
                    nm = f"{g.get('judul','')} — {ind.get('nama','')}" if g.get("judul") else ind.get("nama", "")
                    bsc.append({"aspek": g.get("aspek"), "nama": nm, "target": ind.get("target") or ""})
            else:
                bsc.append({"aspek": g.get("aspek"), "nama": g.get("judul", ""), "target": ""})
        # OKR for this division (DIVISI level + INDIVIDU level in this division)
        okr_raw = await db.okr_objectives.find(
            {"period_id": period_id, "$or": [{"divisi_id": divisi_id}, {"level": "COMPANY"}]},
            {"_id": 0},
        ).sort([("level", 1), ("urutan", 1)]).to_list(500)
        oids = [o["id"] for o in okr_raw]
        krs = await db.okr_keyresults.find({"objective_id": {"$in": oids}}, {"_id": 0}).sort("urutan", 1).to_list(2000)
        by_obj: dict = {}
        for k in krs:
            by_obj.setdefault(k["objective_id"], []).append(k)
        ang_map = await _decorate_anggota_map()
        okr_items = []
        for o in okr_raw:
            okr_items.append({
                **o,
                "key_results": by_obj.get(o["id"], []),
                "owner": ang_map.get(o.get("owner_id")) if o.get("owner_id") else None,
                "supporters": [ang_map[i] for i in (o.get("supporter_ids") or []) if i in ang_map],
            })
        # Members of this division
        members = await db.anggota.find({"divisi_id": divisi_id}, {"_id": 0}).sort("nama", 1).to_list(500)
        mem_ids = [m["id"] for m in members]
        # KPI for this division's members
        kpi_raw = await db.kpi_items.find({"period_id": period_id, "anggota_id": {"$in": mem_ids}}, {"_id": 0}).sort("urutan", 1).to_list(1000)
        kpi_items = []
        for k in kpi_raw:
            ang = ang_map.get(k.get("anggota_id"))
            kpi_items.append({**k, "anggota_nama": ang.get("nama") if ang else "-"})

        pdf_bytes = build_komitmen_pdf(
            period=period, divisi=divisi, vision=vision,
            bsc_items=bsc, okr_items=okr_items, kpi_items=kpi_items,
            members=members,
        )
        slug = (divisi.get("nama") or "divisi").lower().replace(" ", "-")
        fname = f"komitmen-{slug}-{period.get('nama', 'periode').lower().replace(' ', '-')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )

    # ================================================================
    # EVALUASI — Rekap Raker PDF (Visi, BSC, OKR, Action Plan, KPI)
    # ================================================================
    @router.get("/evaluasi.pdf")
    async def evaluasi_pdf(period_id: str, user: dict = Depends(require_spv)):
        period = await db.strategy_periods.find_one({"id": period_id}, {"_id": 0})
        if not period:
            raise HTTPException(404, "Periode tidak ditemukan.")
        data = await get_evaluation(period_id=period_id, _=user)
        pdf_bytes = build_evaluasi_pdf(period=period, data=data)
        slug = (period.get("nama") or "periode").lower().replace(" ", "-")
        fname = f"evaluasi-raker-{slug}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'},
        )

    return router
