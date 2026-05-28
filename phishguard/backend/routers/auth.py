# =============================================================================
# routers/auth.py — Authentication Endpoints (MongoDB version)
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status, Request
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from models.database import get_db, User, ActivityLog
from models.schemas import (
    RegisterRequest, LoginRequest, Verify2FARequest,
    TokenResponse, UserResponse, Setup2FAResponse
)
from services.auth_service import (
    hash_password, verify_password, create_access_token,
    verify_token, generate_2fa_secret, generate_qr_code, verify_2fa_code
)
from routers.dependencies import get_current_user

router = APIRouter()


class CodeRequest(BaseModel):
    code: str


# ── Helper: Log Activity ──────────────────────────────────────────────────────
def log_activity(db, user_id, action, details=None, ip=None):
    try:
        log = ActivityLog({
            "user_id":    user_id,
            "action":     action,
            "details":    details,
            "ip_address": ip,
            "timestamp":  datetime.utcnow(),
        })
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()


# ── Register ──────────────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(request: RegisterRequest, req: Request, db = Depends(get_db)):
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_count  = db.query(User).count()
    role        = "admin" if user_count == 0 else request.role.value
    is_approved = True if role == "admin" else False

    user = User({
        "name":          request.name,
        "email":         request.email,
        "password_hash": hash_password(request.password),
        "role":          role,
        "is_approved":   is_approved,
        "is_active":     True,
        "created_at":    datetime.utcnow(),
    })
    db.add(user)
    db.commit()

    ip = req.client.host if req.client else None
    log_activity(db, user.id, "register", f"New {role} registered", ip)

    return {
        "message":     "Registration successful",
        "user_id":     user.id,
        "role":        user.role,
        "is_approved": user.is_approved,
        "note":        "Account ready" if role == "admin" else "Account pending admin approval"
    }


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, req: Request, db = Depends(get_db)):
    ip   = req.client.host if req.client else None
    user = db.query(User).filter(User.email == request.email).first()

    if not user or not verify_password(request.password, user.password_hash):
        log_activity(db, None, "login_failed", f"Failed: {request.email}", ip)
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account has been suspended")

    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Account pending admin approval")

    user.last_login = datetime.utcnow()
    db.add(user)
    db.commit()
    log_activity(db, user.id, "login", "Successful login", ip)

    if user.two_fa_enabled and user.two_fa_secret:
        temp_token = create_access_token({
            "sub": user.email, "id": user.id,
            "role": user.role, "2fa_pending": True
        })
        return TokenResponse(
            access_token=temp_token, requires_2fa=True,
            requires_2fa_setup=False,
            user_id=user.id, name=user.name, role=user.role
        )

    token          = create_access_token({"sub": user.email, "id": user.id, "role": user.role})
    requires_setup = not user.two_fa_enabled
    return TokenResponse(
        access_token=token, requires_2fa=False,
        requires_2fa_setup=requires_setup,
        user_id=user.id, name=user.name, role=user.role
    )


# ── Verify 2FA after login ────────────────────────────────────────────────────
@router.post("/verify-2fa", response_model=TokenResponse)
async def verify_2fa_login(request: Verify2FARequest, req: Request, db = Depends(get_db)):
    ip   = req.client.host if req.client else None
    user = db.query(User).filter(User.email == request.email).first()

    if not user or not user.two_fa_secret:
        raise HTTPException(status_code=400, detail="2FA not configured")

    if not verify_2fa_code(user.two_fa_secret, str(request.code).strip()):
        log_activity(db, user.id, "2fa_failed", "Invalid code", ip)
        raise HTTPException(status_code=401, detail="Invalid 2FA code. Please try again.")

    log_activity(db, user.id, "2fa_verified", "2FA verified", ip)
    token = create_access_token({"sub": user.email, "id": user.id, "role": user.role})
    return TokenResponse(
        access_token=token, requires_2fa=False,
        requires_2fa_setup=False,
        user_id=user.id, name=user.name, role=user.role
    )


# ── Setup 2FA ─────────────────────────────────────────────────────────────────
@router.post("/setup-2fa", response_model=Setup2FAResponse)
async def setup_2fa(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    secret  = generate_2fa_secret()
    qr_code = generate_qr_code(current_user.email, secret)

    current_user.two_fa_secret  = secret
    current_user.two_fa_enabled = False
    db.add(current_user)
    db.commit()

    return Setup2FAResponse(qr_code=qr_code, secret=secret)


# ── Enable 2FA ────────────────────────────────────────────────────────────────
@router.post("/enable-2fa")
async def enable_2fa(
    request:      CodeRequest,
    current_user: User = Depends(get_current_user),
    db                 = Depends(get_db)
):
    if not current_user.two_fa_secret:
        raise HTTPException(status_code=400, detail="Please setup 2FA first")

    code = str(request.code).strip()
    if not verify_2fa_code(current_user.two_fa_secret, code):
        raise HTTPException(status_code=401, detail="Invalid code. Please check your authenticator app.")

    current_user.two_fa_enabled = True
    db.add(current_user)
    db.commit()
    return {"message": "2FA enabled successfully!"}


# ── Disable 2FA ───────────────────────────────────────────────────────────────
@router.post("/disable-2fa")
async def disable_2fa(
    request:      CodeRequest,
    current_user: User = Depends(get_current_user),
    db                 = Depends(get_db)
):
    if not current_user.two_fa_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    if not verify_2fa_code(current_user.two_fa_secret, str(request.code).strip()):
        raise HTTPException(status_code=401, detail="Invalid code")

    current_user.two_fa_enabled = False
    current_user.two_fa_secret  = None
    db.add(current_user)
    db.commit()
    return {"message": "2FA disabled successfully"}


# ── Get current user ──────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user