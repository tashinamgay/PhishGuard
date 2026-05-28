# =============================================================================
# services/history_service.py — Live usage stats from the database (FIXED)
# =============================================================================

from models.database import SessionLocal, Prediction

def get_summary_stats() -> dict:
    """
    Return live prediction stats from the database.
    Called by GET /api/stats endpoint.
    """
    db = SessionLocal()
    try:
        total    = db.query(Prediction).count()
        phishing = db.query(Prediction).filter(Prediction.label == "phishing").count()
        safe     = total - phishing

        # FIXED: get full objects instead of Prediction.confidence
        # MongoDB wrapper doesn't support column-level queries
        all_preds = db.query(Prediction).all()
        if all_preds:
            confidences = []
            for p in all_preds:
                if isinstance(p, dict):
                    confidences.append(p.get("confidence", 0))
                else:
                    confidences.append(getattr(p, "confidence", 0))
            avg_conf = round(sum(confidences) / len(confidences), 4)
        else:
            avg_conf = 0.0

        return {
            "total_predictions": total,
            "phishing_detected": phishing,
            "safe_detected":     safe,
            "avg_confidence":    avg_conf,
        }
    finally:
        db.close()