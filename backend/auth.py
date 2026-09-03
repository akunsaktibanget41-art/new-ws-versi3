"""Authentication module - Emergent Google + custom email/password."""
import os
import uuid
import secrets
import hashlib
import bcrypt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorDatabase


EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_COOKIE = "session_token"
SESSION_DAYS = 7


# ============== MODELS ==============
class RegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionPayload(BaseModel):
    session_id: str


class UpdateUserPayload(BaseModel):
    status: Optional[str] = None  # pending | approved | rejected
    role: Optional[str] = None  # spv | anggota
    anggota_id: Optional[str] = None


class UpdateProfilePayload(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(default=None, min_length=6)


class CreateUserPayload(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "anggota"  # spv | anggota
    anggota_id: Optional[str] = None


class ResetPasswordPayload(BaseModel):
    new_password: str = Field(min_length=6)


class ApiKeyCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=80)


# ============== HELPERS ==============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _sanitize(user: dict) -> dict:
    u = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return u


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
    )


def _clear_session_cookie(response: Response):
    response.delete_cookie(key=SESSION_COOKIE, path="/")


async def _create_session(db, user_id: str, source: str = "local") -> str:
    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "source": source,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
    })
    return token


async def get_current_user_optional(request: Request, db):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        expires_at = sess.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < datetime.now(timezone.utc):
            await db.user_sessions.delete_one({"session_token": token})
            return None
        return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})

    # API keys are stored only as SHA-256 hashes and may authenticate server-to-server calls.
    key_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    api_key = await db.api_keys.find_one({"key_hash": key_hash, "revoked_at": None}, {"_id": 0})
    if not api_key:
        return None
    await db.api_keys.update_one({"id": api_key["id"]}, {"$set": {"last_used_at": datetime.now(timezone.utc)}})
    user = await db.users.find_one({"user_id": api_key["user_id"]}, {"_id": 0})
    return user


def make_auth_dependencies(db):
    async def get_current_user(request: Request) -> dict:
        user = await get_current_user_optional(request, db)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if user.get("status") != "approved":
            raise HTTPException(status_code=403, detail=f"Akun {user.get('status', 'pending')} — belum bisa akses.")
        return _sanitize(user)

    async def require_spv(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") != "spv":
            raise HTTPException(status_code=403, detail="Hanya SPV yang bisa mengakses.")
        return user

    return get_current_user, require_spv


# ============== SEED ==============
async def seed_admin(db):
    email = (os.environ.get("ADMIN_EMAIL") or "admin@example.com").lower()
    password = os.environ.get("ADMIN_PASSWORD") or "admin12345"
    name = os.environ.get("ADMIN_NAME") or "Admin SPV"

    existing = await db.users.find_one({"email": email})
    if existing is None:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "password_hash": hash_password(password),
            "role": "spv",
            "status": "approved",
            "auth_provider": "local",
            "picture": "",
            "anggota_id": None,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        upd = {}
        if not existing.get("password_hash") or not verify_password(password, existing["password_hash"]):
            upd["password_hash"] = hash_password(password)
        if existing.get("role") != "spv":
            upd["role"] = "spv"
        if existing.get("status") != "approved":
            upd["status"] = "approved"
        if upd:
            await db.users.update_one({"email": email}, {"$set": upd})

    # Indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.api_keys.create_index("key_hash", unique=True)
        await db.api_keys.create_index("user_id")
    except Exception:
        pass


# ============== ROUTER FACTORY ==============
def build_auth_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])
    get_current_user, require_spv = make_auth_dependencies(db)

    @router.post("/register")
    async def register(payload: RegisterPayload, response: Response):
        email = payload.email.lower()
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(400, "Email sudah terdaftar.")
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        doc = {
            "user_id": user_id,
            "email": email,
            "name": payload.name.strip(),
            "password_hash": hash_password(payload.password),
            "role": "anggota",
            "status": "pending",
            "auth_provider": "local",
            "picture": "",
            "anggota_id": None,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(doc)
        return {"ok": True, "status": "pending", "message": "Menunggu approval SPV."}

    @router.post("/login")
    async def login(payload: LoginPayload, response: Response):
        email = payload.email.lower()
        user = await db.users.find_one({"email": email})
        if not user or not user.get("password_hash"):
            raise HTTPException(401, "Email atau password salah.")
        if not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(401, "Email atau password salah.")
        if user.get("status") == "pending":
            # Return user info so the frontend can route to /pending, but do NOT issue a session cookie.
            return {"ok": False, "status": "pending", "user": _sanitize(user), "message": "Akun menunggu approval SPV."}
        if user.get("status") == "rejected":
            raise HTTPException(403, "Akun Anda ditolak. Hubungi SPV.")
        token = await _create_session(db, user["user_id"], "local")
        _set_session_cookie(response, token)
        return {"ok": True, "status": "approved", "user": _sanitize(user), "session_token": token}

    @router.post("/google/session")
    async def google_session(payload: GoogleSessionPayload, response: Response):
        # Exchange session_id with Emergent auth service
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    EMERGENT_AUTH_URL,
                    headers={"X-Session-ID": payload.session_id},
                )
        except Exception as e:
            raise HTTPException(502, f"Gagal hubungi Emergent Auth: {e}")
        if r.status_code != 200:
            raise HTTPException(401, "Sesi Google tidak valid atau kadaluarsa.")
        data = r.json()
        email = (data.get("email") or "").lower()
        if not email:
            raise HTTPException(400, "Email Google tidak ditemukan.")
        emergent_token = data.get("session_token")

        existing = await db.users.find_one({"email": email})
        if existing:
            upd = {"picture": data.get("picture") or existing.get("picture", "")}
            if not existing.get("name"):
                upd["name"] = data.get("name") or email
            # If Google account exists as local without picture, save it
            await db.users.update_one({"email": email}, {"$set": upd})
            user = await db.users.find_one({"email": email})
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = {
                "user_id": user_id,
                "email": email,
                "name": data.get("name") or email,
                "password_hash": None,
                "role": "anggota",
                "status": "pending",
                "auth_provider": "google",
                "picture": data.get("picture") or "",
                "anggota_id": None,
                "created_at": datetime.now(timezone.utc),
            }
            await db.users.insert_one(user)

        # Always issue our own session cookie
        token = await _create_session(db, user["user_id"], "google")
        # Also store the Emergent token for reference
        if emergent_token:
            await db.user_sessions.update_one(
                {"session_token": token},
                {"$set": {"emergent_token": emergent_token}},
            )
        _set_session_cookie(response, token)
        return {"ok": True, "user": _sanitize(user), "status": user.get("status")}

    @router.get("/me")
    async def me(request: Request):
        user = await get_current_user_optional(request, db)
        if not user:
            raise HTTPException(401, "Not authenticated")
        return _sanitize(user)

    @router.post("/logout")
    async def logout(request: Request, response: Response):
        token = request.cookies.get(SESSION_COOKIE)
        if token:
            await db.user_sessions.delete_one({"session_token": token})
        _clear_session_cookie(response)
        return {"ok": True}

    # ---------- USER MANAGEMENT (SPV) ----------
    @router.get("/users")
    async def list_users(status: Optional[str] = None, _: dict = Depends(require_spv)):
        q = {}
        if status:
            q["status"] = status
        rows = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
        return rows

    @router.put("/users/{user_id}")
    async def update_user(user_id: str, payload: UpdateUserPayload, current: dict = Depends(require_spv)):
        upd = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not upd:
            raise HTTPException(400, "Tidak ada perubahan.")
        # Prevent demoting the last SPV
        if upd.get("role") == "anggota" or upd.get("status") in ("pending", "rejected"):
            target = await db.users.find_one({"user_id": user_id})
            if target and target.get("role") == "spv":
                spv_count = await db.users.count_documents({"role": "spv", "status": "approved"})
                if spv_count <= 1:
                    raise HTTPException(400, "Tidak bisa demote SPV terakhir.")
        result = await db.users.find_one_and_update(
            {"user_id": user_id},
            {"$set": upd},
            return_document=True,
            projection={"_id": 0, "password_hash": 0},
        )
        if not result:
            raise HTTPException(404, "User tidak ditemukan.")
        return result

    @router.delete("/users/{user_id}")
    async def delete_user(user_id: str, current: dict = Depends(require_spv)):
        if user_id == current.get("user_id"):
            raise HTTPException(400, "Tidak bisa hapus akun sendiri.")
        target = await db.users.find_one({"user_id": user_id})
        if target and target.get("role") == "spv":
            spv_count = await db.users.count_documents({"role": "spv", "status": "approved"})
            if spv_count <= 1:
                raise HTTPException(400, "Tidak bisa hapus SPV terakhir.")
        r = await db.users.delete_one({"user_id": user_id})
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.api_keys.delete_many({"user_id": user_id})
        return {"ok": True, "deleted": r.deleted_count}

    # ---------- API KEYS (SPV) ----------
    @router.get("/api-keys")
    async def list_api_keys(current: dict = Depends(require_spv)):
        return await db.api_keys.find(
            {"user_id": current["user_id"]},
            {"_id": 0, "key_hash": 0},
        ).sort("created_at", -1).to_list(100)

    @router.post("/api-keys")
    async def create_api_key(payload: ApiKeyCreatePayload, current: dict = Depends(require_spv)):
        name = payload.name.strip()
        if not name:
            raise HTTPException(400, "Nama integrasi wajib diisi.")
        raw_key = f"rs_live_{secrets.token_urlsafe(32)}"
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": current["user_id"],
            "name": name,
            "prefix": raw_key[:16],
            "key_hash": hashlib.sha256(raw_key.encode("utf-8")).hexdigest(),
            "created_at": datetime.now(timezone.utc),
            "last_used_at": None,
            "revoked_at": None,
        }
        await db.api_keys.insert_one(doc)
        return {**{k: v for k, v in doc.items() if k not in ("_id", "key_hash")}, "key": raw_key}

    @router.delete("/api-keys/{key_id}")
    async def revoke_api_key(key_id: str, current: dict = Depends(require_spv)):
        result = await db.api_keys.update_one(
            {"id": key_id, "user_id": current["user_id"], "revoked_at": None},
            {"$set": {"revoked_at": datetime.now(timezone.utc)}},
        )
        if not result.modified_count:
            raise HTTPException(404, "API key tidak ditemukan atau sudah dicabut.")
        return {"ok": True}

    # ---------- PROFILE (SELF-SERVICE) ----------
    @router.put("/profile")
    async def update_profile(payload: UpdateProfilePayload, request: Request):
        user = await get_current_user(request)
        upd = {}
        if payload.name is not None and payload.name.strip():
            upd["name"] = payload.name.strip()
        if payload.email is not None:
            email = payload.email.lower()
            existing = await db.users.find_one({"email": email})
            if existing and existing["user_id"] != user["user_id"]:
                raise HTTPException(400, "Email sudah dipakai akun lain.")
            upd["email"] = email
        if payload.new_password:
            full = await db.users.find_one({"user_id": user["user_id"]})
            if not full.get("password_hash"):
                raise HTTPException(400, "Akun Google tidak punya password lokal. Minta SPV untuk reset password.")
            if not payload.current_password or not verify_password(payload.current_password, full["password_hash"]):
                raise HTTPException(400, "Password saat ini salah.")
            upd["password_hash"] = hash_password(payload.new_password)
        if not upd:
            raise HTTPException(400, "Tidak ada perubahan.")
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
        if payload.new_password:
            # Cabut sesi lain, pertahankan sesi saat ini
            token = request.cookies.get(SESSION_COOKIE)
            if not token:
                auth = request.headers.get("Authorization", "")
                if auth.startswith("Bearer "):
                    token = auth[7:]
            q = {"user_id": user["user_id"]}
            if token:
                q["session_token"] = {"$ne": token}
            await db.user_sessions.delete_many(q)
        return {"ok": True}

    # ---------- MANUAL USER MANAGEMENT (SPV) ----------
    @router.post("/users")
    async def create_user(payload: CreateUserPayload, _: dict = Depends(require_spv)):
        email = payload.email.lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(400, "Email sudah terdaftar.")
        if payload.role not in ("spv", "anggota"):
            raise HTTPException(400, "Role tidak valid.")
        doc = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": payload.name.strip(),
            "password_hash": hash_password(payload.password),
            "role": payload.role,
            "status": "approved",
            "auth_provider": "local",
            "picture": "",
            "anggota_id": payload.anggota_id,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(doc)
        return _sanitize(doc)

    @router.put("/users/{user_id}/password")
    async def reset_user_password(user_id: str, payload: ResetPasswordPayload, _: dict = Depends(require_spv)):
        target = await db.users.find_one({"user_id": user_id})
        if not target:
            raise HTTPException(404, "User tidak ditemukan.")
        await db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": hash_password(payload.new_password)}})
        await db.user_sessions.delete_many({"user_id": user_id})
        return {"ok": True}

    return router
