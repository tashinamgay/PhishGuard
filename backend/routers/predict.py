# =============================================================================
# routers/predict.py — Email Prediction + On-Demand Gemini Explanation
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime

from models.database import get_db, Prediction, ActivityLog, User
from models.schemas import PredictRequest, BatchPredictRequest
from services.ml_service import predict_email, predict_batch
from services.gemini_service import get_gemini_explanation
from routers.dependencies import get_current_user

router = APIRouter()


# ── Helper: save prediction to DB ────────────────────────────────────────────
def save_prediction(db, user_id: int, result: dict, email_text: str) -> Prediction:
    pred = Prediction({
        "user_id":       user_id,
        "email_content": email_text[:5000],
        "email_preview": email_text[:200].strip(),
        "label":         result["label"],
        "confidence":    result["confidence"],
        "phishing_prob": result["phishing_prob"],
        "safe_prob":     result["safe_prob"],
        "risk_level":    result["risk_level"],
        "model_used":    result["model_used"],
        "timestamp":     result.get("timestamp", datetime.utcnow()),
    })
    db.add(pred)
    db.commit()
    return pred


# =============================================================================
# POST /api/predict
# =============================================================================
@router.post("/predict")
async def classify_email(
    request:      PredictRequest,
    db            = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Build enriched email text with subject/headers prepended
    enriched = request.email_text
    if request.subject:
        enriched = f"Subject: {request.subject}\n{enriched}"
    if request.headers:
        enriched = f"Headers:\n{request.headers}\n{enriched}"

    result = predict_email(enriched, request.model_key)
    pred   = save_prediction(db, current_user.id, result, request.email_text)

    db.add(ActivityLog({
        "user_id": current_user.id,
        "action":  "predict",
        "details": f"Model: {request.model_key}, Result: {result['label']}",
    }))
    db.commit()

    return {
        **result,
        "prediction_id": pred.id,
        "explanation":   None,
    }


# =============================================================================
# POST /api/explain/{prediction_id}
# =============================================================================
@router.post("/explain/{prediction_id}")
async def explain_prediction(
    prediction_id: int,
    db             = Depends(get_db),
    current_user:  User = Depends(get_current_user)
):
    pred = db.query(Prediction).filter(Prediction.id == prediction_id).first()

    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")

    if current_user.role == "user" and pred.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = get_gemini_explanation(
        email_text    = pred.email_content,
        label         = pred.label,
        confidence    = pred.confidence,
        risk_level    = pred.risk_level,
        model_used    = pred.model_used,
        db            = db,
        user          = current_user,
        prediction_id = prediction_id,
    )

    db.add(ActivityLog({
        "user_id": current_user.id,
        "action":  "explain",
        "details": f"Prediction {prediction_id} — source: {result['source']}",
    }))
    db.commit()

    return result


# =============================================================================
# POST /api/predict/batch
# =============================================================================
@router.post("/predict/batch")
async def classify_batch(
    request:      BatchPredictRequest,
    db            = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results   = predict_batch(request.emails, request.model_key)
    saved_ids = []
    for i, result in enumerate(results):
        pred = save_prediction(db, current_user.id, result, request.emails[i])
        saved_ids.append(pred.id)

    phishing_count = sum(1 for r in results if r["label"] == "phishing")
    return {
        "results":        results,
        "prediction_ids": saved_ids,
        "total":          len(results),
        "phishing_count": phishing_count,
        "safe_count":     len(results) - phishing_count,
    }


# =============================================================================
# GET /api/history
# =============================================================================
@router.get("/history")
async def get_history(
    limit:        int  = 50,
    offset:       int  = 0,
    db            = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Prediction)
    if current_user.role == "user":
        query = query.filter(Prediction.user_id == current_user.id)

    predictions = query.order_by(Prediction.timestamp.desc()).offset(offset).limit(limit).all()

    return [{
        "id":              p.id,
        "label":           p.label,
        "confidence":      p.confidence,
        "risk_level":      p.risk_level,
        "email_preview":   p.email_preview,
        "model_used":      p.model_used,
        "timestamp":       p.timestamp,
        "user_name":       p.user.name if p.user else None,
        "has_explanation": bool(p.gemini_explanation),
    } for p in predictions]


# =============================================================================
# DELETE /api/history
# =============================================================================
@router.delete("/history")
async def clear_history(
    db            = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role in ["admin", "researcher"]:
        db.query(Prediction).delete()
    else:
        db.query(Prediction).filter(Prediction.user_id == current_user.id).delete()
    db.commit()
    return {"message": "History cleared"}