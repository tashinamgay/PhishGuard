# =============================================================================
# models/database.py — MongoDB Database (replaces SQLAlchemy/PostgreSQL)
# Connects via port 443 (HTTPS) — works on ALL networks including college WiFi
# =============================================================================

import os
from datetime import datetime
from dotenv import load_dotenv
from pymongo import MongoClient, DESCENDING, ASCENDING

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "")
if not MONGO_URL:
    raise ValueError("MONGO_URL not set in .env file")

# ── Connect to MongoDB Atlas ──────────────────────────────────────────────────
try:
    _client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    _client.admin.command("ping")
    print("[DB] Connected to MongoDB Atlas")
except Exception as e:
    print(f"[DB] MongoDB connection failed: {e}")
    raise

_db = _client["phishguard"]

# ── Collections ───────────────────────────────────────────────────────────────
users_col       = _db["users"]
predictions_col = _db["predictions"]
logs_col        = _db["activity_logs"]
models_col      = _db["trained_models"]
runs_col        = _db["training_runs"]
counters_col    = _db["counters"]

# ── Indexes ───────────────────────────────────────────────────────────────────
users_col.create_index("email", unique=True)
predictions_col.create_index("user_id")
logs_col.create_index("user_id")


# =============================================================================
# Auto-increment ID helper
# =============================================================================
def _next_id(name: str) -> int:
    r = counters_col.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}},
        upsert=True, return_document=True
    )
    return r["seq"]


# =============================================================================
# Model classes
# =============================================================================
class User:
    def __init__(self, doc):
        self.id                 = doc.get("id")
        self.name               = doc.get("name", "")
        self.email              = doc.get("email", "")
        self.password_hash      = doc.get("password_hash", "")
        self.role               = doc.get("role", "user")
        self.is_active          = doc.get("is_active", True)
        self.is_approved        = doc.get("is_approved", False)
        self.two_fa_secret      = doc.get("two_fa_secret")
        self.two_fa_enabled     = doc.get("two_fa_enabled", False)
        self.created_at         = doc.get("created_at", datetime.utcnow())
        self.last_login         = doc.get("last_login")
        self.gemini_last_called = doc.get("gemini_last_called")

    def to_dict(self):
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


class Prediction:
    def __init__(self, doc):
        self.id                 = doc.get("id")
        self.user_id            = doc.get("user_id")
        self.email_content      = doc.get("email_content", "")
        self.email_preview      = doc.get("email_preview", "")
        self.label              = doc.get("label")
        self.confidence         = doc.get("confidence")
        self.phishing_prob      = doc.get("phishing_prob")
        self.safe_prob          = doc.get("safe_prob")
        self.risk_level         = doc.get("risk_level")
        self.model_used         = doc.get("model_used")
        self.gemini_explanation = doc.get("gemini_explanation")
        self.timestamp          = doc.get("timestamp", datetime.utcnow())

    @property
    def user(self):
        doc = users_col.find_one({"id": self.user_id})
        return User(doc) if doc else None

    def to_dict(self):
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


class ActivityLog:
    def __init__(self, doc):
        self.id         = doc.get("id")
        self.user_id    = doc.get("user_id")
        self.action     = doc.get("action", "")
        self.details    = doc.get("details")
        self.ip_address = doc.get("ip_address")
        self.timestamp  = doc.get("timestamp", datetime.utcnow())

    @property
    def user(self):
        if not self.user_id:
            return None
        doc = users_col.find_one({"id": self.user_id})
        return User(doc) if doc else None

    def to_dict(self):
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


class TrainedModel:
    def __init__(self, doc):
        self.id           = doc.get("id")
        self.model_key    = doc.get("model_key")
        self.display_name = doc.get("display_name", "")
        self.version      = doc.get("version", "v1")
        self.file_path    = doc.get("file_path")
        self.accuracy     = doc.get("accuracy")
        self.precision    = doc.get("precision")
        self.recall       = doc.get("recall")
        self.f1_score     = doc.get("f1_score")
        self.auc_score    = doc.get("auc_score")
        self.is_deployed  = doc.get("is_deployed", False)
        self.dataset_name = doc.get("dataset_name")
        self.trained_by   = doc.get("trained_by")
        self.trained_at   = doc.get("trained_at", datetime.utcnow())

    def to_dict(self):
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


class TrainingRun:
    def __init__(self, doc):
        self.id                    = doc.get("id")
        self.trained_model_id      = doc.get("trained_model_id")
        self.researcher_id         = doc.get("researcher_id")
        self.model_key             = doc.get("model_key", "")
        self.dataset_filename      = doc.get("dataset_filename")
        self.dataset_rows          = doc.get("dataset_rows")
        self.status                = doc.get("status", "pending")
        self.progress              = doc.get("progress", 0)
        self.current_step          = doc.get("current_step")
        self.accuracy              = doc.get("accuracy")
        self.precision_score       = doc.get("precision_score")
        self.recall_score          = doc.get("recall_score")
        self.f1                    = doc.get("f1")
        self.auc_score             = doc.get("auc_score")
        self.confusion_matrix      = doc.get("confusion_matrix")
        self.classification_report = doc.get("classification_report")
        self.training_log          = doc.get("training_log")
        self.error_message         = doc.get("error_message")
        self.started_at            = doc.get("started_at", datetime.utcnow())
        self.finished_at           = doc.get("finished_at")

    def to_dict(self):
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}


# =============================================================================
# Filter / Sort helpers — make User.email == "x" work like SQLAlchemy
# =============================================================================
class _Expr:
    def __init__(self, f): self._f = f
    @property
    def _mongo_filter(self): return self._f

class _Attr:
    def __init__(self, field): self.field = field
    def __eq__(self, v):  return _Expr({self.field: v})
    def __ne__(self, v):  return _Expr({self.field: {"$ne": v}})
    def desc(self):       return (self.field, DESCENDING)
    def asc(self):        return (self.field, ASCENDING)

def _attach(cls, fields):
    for f in fields:
        setattr(cls, f, _Attr(f))

_attach(User,        ["id","email","role","is_active","is_approved","two_fa_enabled","created_at","last_login","gemini_last_called"])
_attach(Prediction,  ["id","user_id","label","timestamp"])
_attach(ActivityLog, ["id","user_id","action","timestamp"])
_attach(TrainedModel,["id","model_key","is_deployed","trained_at"])
_attach(TrainingRun, ["id","researcher_id","model_key","status","started_at"])


# =============================================================================
# MongoQuery — mimics SQLAlchemy query interface
# =============================================================================
_COL_MAP = {
    User: users_col,
    Prediction: predictions_col,
    ActivityLog: logs_col,
    TrainedModel: models_col,
    TrainingRun: runs_col,
}

class MongoQuery:
    def __init__(self, model_cls):
        self._cls     = model_cls
        self._col     = _COL_MAP[model_cls]
        self._filters = {}
        self._sort    = None
        self._lim     = None
        self._skip    = 0

    def filter(self, *exprs):
        for e in exprs:
            if hasattr(e, "_mongo_filter"):
                self._filters.update(e._mongo_filter)
        return self

    def filter_by(self, **kw):
        self._filters.update(kw)
        return self

    def order_by(self, *args):
        sort = []
        for a in args:
            if isinstance(a, tuple):
                sort.append(a)
            elif hasattr(a, "_mongo_sort"):
                sort.extend(a._mongo_sort)
        self._sort = sort or None
        return self

    def limit(self, n):  self._lim = n;  return self
    def offset(self, n): self._skip = n; return self

    def _cursor(self):
        c = self._col.find(self._filters)
        if self._sort:  c = c.sort(self._sort)
        if self._skip:  c = c.skip(self._skip)
        if self._lim:   c = c.limit(self._lim)
        return c

    def first(self):
        doc = self._col.find_one(self._filters)
        return self._cls(doc) if doc else None

    def all(self):
        return [self._cls(d) for d in self._cursor()]

    def count(self):
        return self._col.count_documents(self._filters)

    def delete(self):
        self._col.delete_many(self._filters)
        return self

    def update(self, vals: dict):
        self._col.update_many(self._filters, {"$set": vals})
        return self


# =============================================================================
# MongoSession — drop-in for SQLAlchemy Session
# =============================================================================
class MongoSession:
    def __init__(self):
        self._pending = []

    def add(self, obj):
        self._pending.append(obj)

    def commit(self):
        for obj in self._pending:
            self._save(obj)
        self._pending = []

    def rollback(self): self._pending = []
    def flush(self):    self.commit()
    def refresh(self, obj): pass
    def close(self): pass

    def query(self, cls):
        return MongoQuery(cls)

    def delete(self, obj):
        col = _COL_MAP.get(type(obj))
        if col:
            col.delete_one({"id": obj.id})

    def _save(self, obj):
        col = _COL_MAP.get(type(obj))
        if col is None:
            return
        if not obj.id:
            obj.id = _next_id(type(obj).__name__)
        col.replace_one({"id": obj.id}, obj.to_dict(), upsert=True)


# =============================================================================
# FastAPI dependency
# =============================================================================
def get_db():
    db = MongoSession()
    try:
        yield db
    finally:
        db.close()


# SessionLocal for background threads (training_service.py)
class SessionLocal:
    def __new__(cls):
        return MongoSession()


def create_tables():
    print("[DB] MongoDB ready - collections and indexes set")
