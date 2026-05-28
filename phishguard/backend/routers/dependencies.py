# =============================================================================
# routers/dependencies.py — Shared FastAPI Dependencies
# =============================================================================
# These functions are injected into route handlers using FastAPI's
# Depends() system to enforce authentication and role checks.
# =============================================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


from models.database import get_db, User
from services.auth_service import verify_token

# HTTP Bearer token scheme — reads "Authorization: Bearer <token>" header
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_db)
) -> User:
    """
    Extract and verify JWT token from request header.
    Returns the User object if valid, raises 401 if not.
    Used as a dependency in protected routes.
    """
    token = credentials.credentials
    payload = verify_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    # Check if this is a 2FA pending token (not fully authenticated)
    if payload.get("2fa_pending"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA verification required"
        )

    # Get user from database
    user = db.query(User).filter(User.id == payload.get("id")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account suspended")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Only allow admin users — raise 403 for anyone else."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def require_researcher(current_user: User = Depends(get_current_user)) -> User:
    """Allow admin and researcher roles — raise 403 for regular users."""
    if current_user.role not in ["admin", "researcher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Researcher access required"
        )
    return current_user


def get_optional_user(
    db = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))
) -> User | None:
    """
    Try to get current user but don't fail if not authenticated.
    Used for routes that work for both authenticated and anonymous users.
    """
    if not credentials:
        return None
    payload = verify_token(credentials.credentials)
    if not payload:
        return None
    return db.query(User).filter(User.id == payload.get("id")).first()
