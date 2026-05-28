# =============================================================================
# services/auth_service.py — Authentication Service
# =============================================================================
# Handles:
#   - Password hashing and verification with bcrypt
#   - JWT token creation and verification
#   - Two-Factor Authentication (2FA) with PyOTP
#   - QR code generation for 2FA setup
# =============================================================================

import os
import io
import base64
import pyotp
import qrcode
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# ── Configuration ─────────────────────────────────────────────────────────────
SECRET_KEY  = os.getenv("SECRET_KEY", "change-this-secret-key")
ALGORITHM   = os.getenv("ALGORITHM", "HS256")
EXPIRE_MINS = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
TWO_FA_ISSUER = os.getenv("TWO_FA_ISSUER", "PhishGuard")

# Password hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password Functions ────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.
    bcrypt automatically adds a salt — passwords are never stored plain text.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compare a plain password against a bcrypt hash.
    Returns True if they match, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT Token Functions ───────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token containing user data.
    The token expires after ACCESS_TOKEN_EXPIRE_MINUTES (default 30 min).

    data should contain:
        sub   → user email (subject)
        role  → user role (admin/researcher/user)
        id    → user ID
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=EXPIRE_MINS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """
    Verify a JWT token and return its payload.
    Returns None if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# ── Two-Factor Authentication Functions ──────────────────────────────────────

def generate_2fa_secret() -> str:
    """
    Generate a new random secret key for 2FA.
    This secret is stored in the users table and used to verify TOTP codes.
    """
    return pyotp.random_base32()


def get_2fa_uri(email: str, secret: str) -> str:
    """
    Generate the otpauth URI for QR code scanning.
    This URI is scanned by Google Authenticator or Authy.
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=TWO_FA_ISSUER)


def generate_qr_code(email: str, secret: str) -> str:
    """
    Generate a QR code image as a base64 string.
    The frontend displays this as an <img src="data:image/png;base64,...">
    so the user can scan it with their authenticator app.
    """
    uri = get_2fa_uri(email, secret)

    # Generate QR code image
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64 string
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def verify_2fa_code(secret: str, code: str) -> bool:
    """
    Verify a 6-digit TOTP code against the user's secret.
    PyOTP checks the current time window (30 seconds) and adjacent windows.
    Returns True if the code is valid.
    """
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)  # Allow 30 second window on each side
