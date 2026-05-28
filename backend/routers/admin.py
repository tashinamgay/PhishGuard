# =============================================================================
# routers/admin.py — Admin Management Endpoints (MongoDB version)
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException

from models.database import get_db, User, ActivityLog, Prediction
from models.schemas import UserResponse, UpdateUserRequest, LogItem
from routers.dependencies import require_admin

router = APIRouter()


# ── List All Users ────────────────────────────────────────────────────────────
@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db           = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    return db.query(User).order_by(User.created_at.desc()).all()


# ── Get Single User ───────────────────────────────────────────────────────────
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id:      int,
    db           = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Update User ───────────────────────────────────────────────────────────────
@router.put("/users/{user_id}")
async def update_user(
    user_id:      int,
    request:      UpdateUserRequest,
    db           = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and request.is_active == False:
        raise HTTPException(status_code=400, detail="Cannot suspend your own account")

    if request.role        is not None: user.role        = request.role.value
    if request.is_active   is not None: user.is_active   = request.is_active
    if request.is_approved is not None: user.is_approved = request.is_approved

    db.add(user)
    db.commit()
    return {"message": "User updated successfully"}


# ── Delete User ───────────────────────────────────────────────────────────────
@router.delete("/users/{user_id}")
async def delete_user(
    user_id:      int,
    db           = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(Prediction).filter(Prediction.user_id == user_id).delete()
    db.query(ActivityLog).filter(ActivityLog.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


# ── Activity Logs ─────────────────────────────────────────────────────────────
@router.get("/logs")
async def get_logs(
    limit:        int  = 100,
    db           = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    logs = db.query(ActivityLog).order_by(
        ActivityLog.timestamp.desc()
    ).limit(limit).all()

    return [{
        "id":         log.id,
        "user_id":    log.user_id,
        "user_name":  log.user.name if log.user else "Unknown",
        "action":     log.action,
        "details":    log.details,
        "ip_address": log.ip_address,
        "timestamp":  log.timestamp,
    } for log in logs]


# ── System Stats ──────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_admin_stats(
    db           = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    total_users       = db.query(User).count()
    pending_approvals = db.query(User).filter(User.is_approved == False).count()
    total_predictions = db.query(Prediction).count()
    phishing_detected = db.query(Prediction).filter(Prediction.label == "phishing").count()

    return {
        "total_users":       total_users,
        "pending_approvals": pending_approvals,
        "total_predictions": total_predictions,
        "phishing_detected": phishing_detected,
        "safe_detected":     total_predictions - phishing_detected,
    }