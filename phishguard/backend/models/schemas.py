# =============================================================================
# models/schemas.py — Pydantic Validation Models (Full)
# =============================================================================

from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List, Any
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────

class EmailLabel(str, Enum):
    SAFE     = "safe"
    PHISHING = "phishing"

class UserRole(str, Enum):
    ADMIN      = "admin"
    RESEARCHER = "researcher"
    USER       = "user"

class TrainingStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE    = "done"
    FAILED  = "failed"


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name:     str      = Field(..., min_length=2, max_length=100)
    email:    EmailStr
    password: str      = Field(..., min_length=8, max_length=100)
    role:     UserRole = UserRole.USER

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class Verify2FARequest(BaseModel):
    email: EmailStr
    code:  str = Field(..., min_length=6, max_length=6)

class Setup2FAResponse(BaseModel):
    qr_code: str
    secret:  str

class TokenResponse(BaseModel):
    access_token:      str
    token_type:        str  = "bearer"
    requires_2fa:      bool = False
    requires_2fa_setup: bool = False
    user_id:           int
    name:              str
    role:              str

class UserResponse(BaseModel):
    id:             int
    name:           str
    email:          str
    role:           str
    is_active:      bool
    is_approved:    bool
    two_fa_enabled: bool
    created_at:     datetime
    last_login:     Optional[datetime]

    class Config:
        from_attributes = True

class UpdateUserRequest(BaseModel):
    role:        Optional[UserRole] = None
    is_active:   Optional[bool]     = None
    is_approved: Optional[bool]     = None


# ── Prediction ────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    email_text: str            = Field(..., min_length=5, max_length=10000)
    model_key:  str            = Field(default="stacking_rf")
    subject:    Optional[str]  = Field(default=None, max_length=500)
    headers:    Optional[str]  = Field(default=None, max_length=2000)

class BatchPredictRequest(BaseModel):
    emails:    List[str] = Field(..., min_length=1, max_length=50)
    model_key: str       = Field(default="stacking_rf")

class PredictResponse(BaseModel):
    label:         EmailLabel
    confidence:    float
    safe_prob:     float
    phishing_prob: float
    timestamp:     datetime
    email_preview: str
    risk_level:    str
    model_used:    str = "stacking_rf"


# ── History ───────────────────────────────────────────────────────────────────

class HistoryItem(BaseModel):
    id:              int
    label:           EmailLabel
    confidence:      float
    risk_level:      str
    email_preview:   str
    timestamp:       datetime
    model_used:      str
    user_name:       Optional[str] = None
    has_explanation: bool          = False

    class Config:
        from_attributes = True


# ── Activity Log ──────────────────────────────────────────────────────────────

class LogItem(BaseModel):
    id:         int
    user_id:    Optional[int]
    action:     str
    details:    Optional[str]
    ip_address: Optional[str]
    timestamp:  datetime
    user_name:  Optional[str] = None

    class Config:
        from_attributes = True


# ── Researcher — Training ─────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    model_key:    str = Field(..., description="stacking_rf | stacking_logistic | llama")
    dataset_path: str = Field(..., description="Server-side path returned after dataset upload")

class TrainingRunResponse(BaseModel):
    id:                   int
    model_key:            str
    status:               str
    progress:             int
    current_step:         Optional[str]
    dataset_filename:     Optional[str]
    dataset_rows:         Optional[int]
    accuracy:             Optional[float]
    precision_score:      Optional[float]
    recall_score:         Optional[float]
    f1:                   Optional[float]
    auc_score:            Optional[float]
    confusion_matrix:     Optional[Any]
    classification_report: Optional[Any]
    error_message:        Optional[str]
    started_at:           datetime
    finished_at:          Optional[datetime]

    class Config:
        from_attributes = True

class TrainedModelResponse(BaseModel):
    id:           int
    model_key:    str
    display_name: str
    version:      str
    accuracy:     Optional[float]
    precision:    Optional[float]
    recall:       Optional[float]
    f1_score:     Optional[float]
    auc_score:    Optional[float]
    is_deployed:  bool
    dataset_name: Optional[str]
    trained_at:   datetime

    class Config:
        from_attributes = True
