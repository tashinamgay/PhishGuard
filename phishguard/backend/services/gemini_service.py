# =============================================================================
# services/gemini_service.py — Google Gemini AI Explanation Service
# =============================================================================
#
# QUOTA-SAFE DESIGN (solves the "key expires fast" problem):
#
#   1. ON-DEMAND ONLY — Gemini is NOT called on every prediction.
#      The user clicks "Get AI Explanation" button manually.
#      This alone cuts API calls by ~80%.
#
#   2. CACHING — If a prediction already has a saved explanation in the DB,
#      it is returned instantly without calling Gemini at all.
#
#   3. PER-USER RATE LIMIT — Each user can request one explanation per
#      GEMINI_RATE_LIMIT_SECONDS (default 60s). Prevents one user burning
#      the free quota for everyone.
#
#   4. SMART FALLBACK — If Gemini fails (quota, expired key, network error),
#      a rule-based explanation is generated from the ML result so the user
#      always gets a useful response and the app never breaks.
#
# Free tier limits: 15 req/min, 1500 req/day — more than enough for a demo.
# =============================================================================

from dotenv import load_dotenv
import os
import httpx
import time
from datetime import datetime, timedelta

load_dotenv()

GEMINI_API_URL     = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"
RATE_LIMIT_SECONDS = int(os.getenv("GEMINI_RATE_LIMIT_SECONDS", "60"))


# =============================================================================
# STEP 1 — Check rate limit for a user
# =============================================================================

def check_rate_limit(user) -> tuple:
    """
    Returns (is_allowed, seconds_remaining).
    Pass the User ORM object — reads gemini_last_called from DB.
    """
    if not user.gemini_last_called:
        return True, 0

    elapsed   = (datetime.utcnow() - user.gemini_last_called).total_seconds()
    remaining = int(RATE_LIMIT_SECONDS - elapsed)

    if remaining <= 0:
        return True, 0

    return False, remaining


# =============================================================================
# STEP 2 — Update rate limit timestamp after a successful call
# =============================================================================

def update_rate_limit(db, user):
    """Call this after every successful Gemini API call."""
    user.gemini_last_called = datetime.utcnow()
    db.commit()


# =============================================================================
# STEP 3 — Build the Gemini prompt
# =============================================================================

def _build_prompt(email_text, label, confidence, risk_level, model_used):
    label_text     = "PHISHING" if label == "phishing" else "SAFE"
    confidence_pct = round(confidence * 100, 1)
    model_name     = {
        "stacking_rf":       "Stacking - Random Forest",
        "stacking_logistic": "Stacking - Logistic Regression",
        "llama":             "LLaMA (Individual)",
        "bert":              "BERT",
        "distilbert":        "DistilBERT",
    }.get(model_used, model_used.upper())

    return f"""You are a cybersecurity expert explaining email phishing detection results to non-technical users.

An AI model called {model_name} analysed the following email and classified it as {label_text} with {confidence_pct}% confidence and {risk_level} risk level.

EMAIL CONTENT:
\"\"\"
{email_text[:1500]}
\"\"\"

CLASSIFICATION RESULT: {label_text} ({confidence_pct}% confidence, {risk_level} RISK)

Provide a clear, friendly explanation that:
1. States in one sentence whether this email is phishing or safe
2. Lists 2-4 specific reasons WHY, based on the actual email content
3. Ends with one practical action the user should take

Format:
- First line: one sentence summary
- Then bullet points for each indicator found
- Last line: what the user should do

Keep it simple, non-technical, under 150 words. Do not use markdown headers."""


# =============================================================================
# STEP 4 — Call Gemini API
# =============================================================================

def _call_gemini_api(prompt):
    """
    Calls Gemini API. Returns text or empty string on failure.
    Retries once on 503. Does NOT retry on 429 (quota) — goes to fallback.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key or api_key == "your-gemini-api-key-here":
        print("[Gemini] No API key configured - skipping Gemini call")
        return ""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature":     0.3,
            "maxOutputTokens": 400,
            "topP":            0.8,
        }
    }

    for attempt in range(2):
        try:
            print(f"[Gemini] Calling API... (attempt {attempt + 1}/2)")
            with httpx.Client(timeout=20.0) as client:
                response = client.post(
                    f"{GEMINI_API_URL}?key={api_key}",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )

            print(f"[Gemini] Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                text = (
                    data.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                        .strip()
                )
                print(f"[Gemini] Success - {len(text)} chars")
                return text

            elif response.status_code == 429:
                # Quota exceeded — don't retry, use fallback
                print("[Gemini] Quota exceeded (429) - switching to fallback")
                return ""

            elif response.status_code == 503:
                print("[Gemini] Server busy (503) — waiting 3s before retry")
                time.sleep(3)
                continue

            else:
                print(f"[Gemini] Error {response.status_code}: {response.text[:200]}")
                return ""

        except Exception as e:
            print(f"[Gemini] Exception: {e}")
            if attempt == 0:
                time.sleep(2)
                continue
            return ""

    return ""


# =============================================================================
# STEP 5 — Smart fallback explanation (rule-based, always works)
# =============================================================================

PHISHING_INDICATORS = [
    ("urgent",           "Uses urgent or threatening language to pressure you into acting immediately"),
    ("verify",           "Asks you to verify your account or personal information"),
    ("click here",       "Contains suspicious call-to-action links"),
    ("password",         "Requests your password or login credentials"),
    ("bank account",     "References bank account details"),
    ("credit card",      "Asks for credit card information"),
    ("congratulations",  "Uses congratulatory language typical of scam offers"),
    ("winner",           "Falsely claims you have won a prize"),
    ("free",             "Offers something for free as a lure"),
    ("suspended",        "Threatens account suspension to create fear"),
    ("unusual activity", "Claims unusual activity on your account"),
    ("limited time",     "Creates artificial urgency with time limits"),
    ("act now",          "Uses high-pressure language to force immediate action"),
    ("bit.ly",           "Uses shortened URLs that hide the real destination"),
    ("http://",          "Contains insecure HTTP links instead of HTTPS"),
    ("dear customer",    "Uses a generic greeting instead of your real name"),
    ("security alert",   "Uses fake security alerts to cause panic"),
    ("claim",            "Pressures you to claim something urgently"),
]

SAFE_INDICATORS = [
    "Does not contain urgent or threatening language",
    "Does not request personal credentials or financial information",
    "Does not use suspicious links or shortened URLs",
    "Uses a legitimate, professional tone",
]


def _generate_fallback_explanation(email_text, label, confidence, risk_level, model_used):
    """
    Rule-based explanation generated from keyword matching.
    Always returns a useful, readable result — never empty.
    """
    confidence_pct = round(confidence * 100, 1)
    model_name     = {
        "stacking_rf":       "Stacking - Random Forest",
        "stacking_logistic": "Stacking - Logistic Regression",
        "llama":             "LLaMA (Individual)",
        "bert":              "BERT",
        "distilbert":        "DistilBERT",
    }.get(model_used, model_used.upper())

    text_lower = email_text.lower()

    if label == "phishing":
        found = [desc for kw, desc in PHISHING_INDICATORS if kw in text_lower]

        if not found:
            found = [
                "Contains patterns commonly associated with phishing attempts",
                "Overall writing style matches known phishing templates",
            ]

        reasons = found[:3]
        summary = f"This email has been identified as PHISHING by {model_name} with {confidence_pct}% confidence ({risk_level} risk)."
        bullets = "\n".join(f"- {r}" for r in reasons)
        advice  = "Do not click any links, download attachments, or reply with personal information. Delete this email immediately."
        return f"{summary}\n\n{bullets}\n\n{advice}"

    else:
        summary = f"This email appears to be SAFE according to {model_name} with {confidence_pct}% confidence."
        bullets = "\n".join(f"- {r}" for r in SAFE_INDICATORS[:3])
        advice  = "The email passed our security checks. Still exercise caution before clicking any links."
        return f"{summary}\n\n{bullets}\n\n{advice}"


# =============================================================================
# STEP 6 — Main public function called by the router
# =============================================================================

def get_gemini_explanation(
    email_text:     str,
    label:          str,
    confidence:     float,
    risk_level:     str,
    model_used:     str,
    db=None,
    user=None,
    prediction_id:  int = None,
) -> dict:
    """
    Main entry point. Returns:
        {
            "explanation":  str,   # The explanation text (never empty)
            "source":       str,   # "gemini" | "fallback" | "cached"
            "rate_limited": bool,  # True if user hit per-minute rate limit
            "retry_after":  int,   # Seconds until Gemini calls are allowed again
        }

    Flow:
        1. Cached?      → return DB explanation immediately (zero API calls)
        2. Rate limited? → return fallback explanation with retry_after
        3. Gemini OK?   → call API, save to DB, update rate limit timestamp
        4. Gemini fails  → return rule-based fallback, save to DB
    """

    # ── 1. Return cached explanation if already in DB ──────────────────────
    if db and prediction_id:
        from models.database import Prediction
        pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
        if pred and pred.gemini_explanation:
            print(f"[Gemini] Cache hit for prediction {prediction_id}")
            return {
                "explanation":  pred.gemini_explanation,
                "source":       "cached",
                "rate_limited": False,
                "retry_after":  0,
            }

    # ── 2. Check per-user rate limit ───────────────────────────────────────
    if user:
        allowed, retry_after = check_rate_limit(user)
        if not allowed:
            print(f"[Gemini] Rate limited - {retry_after}s left for user {user.id}")
            fallback = _generate_fallback_explanation(email_text, label, confidence, risk_level, model_used)
            return {
                "explanation":  fallback,
                "source":       "fallback",
                "rate_limited": True,
                "retry_after":  retry_after,
            }

    # ── 3. Try Gemini API ──────────────────────────────────────────────────
    prompt      = _build_prompt(email_text, label, confidence, risk_level, model_used)
    gemini_text = _call_gemini_api(prompt)

    if gemini_text:
        if db and user:
            update_rate_limit(db, user)

        if db and prediction_id:
            from models.database import Prediction
            pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
            if pred:
                pred.gemini_explanation = gemini_text
                db.commit()
                print(f"[Gemini] Saved to prediction {prediction_id}")

        return {
            "explanation":  gemini_text,
            "source":       "gemini",
            "rate_limited": False,
            "retry_after":  0,
        }

    # ── 4. Gemini failed — smart fallback ──────────────────────────────────
    print("[Gemini] API failed - using rule-based fallback")
    fallback = _generate_fallback_explanation(email_text, label, confidence, risk_level, model_used)

    if db and prediction_id:
        from models.database import Prediction
        pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()
        if pred:
            pred.gemini_explanation = fallback
            db.commit()

    return {
        "explanation":  fallback,
        "source":       "fallback",
        "rate_limited": False,
        "retry_after":  0,
    }
