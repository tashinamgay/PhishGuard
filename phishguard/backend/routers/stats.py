# =============================================================================
# routers/stats.py — Model Statistics Endpoint
# =============================================================================

from fastapi import APIRouter
from services.history_service import get_summary_stats

router = APIRouter()

BENCHMARKS = {
    "stacking_rf": {
        "accuracy":  0.9805,
        "precision": 0.9805,
        "recall":    0.9805,
        "f1_score":  0.9805,
        "auc_score": None,
    },
    "stacking_logistic": {
        "accuracy":  0.9762,
        "precision": 0.9762,
        "recall":    0.9762,
        "f1_score":  0.9762,
        "auc_score": None,
    },
    "llama": {
        "accuracy":  0.9758,
        "precision": 0.9758,
        "recall":    0.9758,
        "f1_score":  0.9758,
        "auc_score": 0.9880,
    },
    "bert": {
        "accuracy":  0.9703,
        "precision": 0.9410,
        "recall":    0.9863,
        "f1_score":  0.9631,
        "auc_score": 0.9965,
    },
    "distilbert": {
        "accuracy":  0.9600,
        "precision": 0.9393,
        "recall":    0.9627,
        "f1_score":  0.9509,
        "auc_score": 0.9910,
    },
}


@router.get("/stats")
async def get_stats():
    usage = get_summary_stats()
    return {
        "total_predictions": usage["total_predictions"],
        "phishing_detected": usage["phishing_detected"],
        "safe_detected":     usage["safe_detected"],
        "avg_confidence":    usage["avg_confidence"],
        "benchmarks":        BENCHMARKS,
        "model_name":        "Stacking RF / Stacking Logistic / LLaMA",
        "accuracy":          BENCHMARKS["stacking_rf"]["accuracy"],
        "precision":         BENCHMARKS["stacking_rf"]["precision"],
        "recall":            BENCHMARKS["stacking_rf"]["recall"],
        "f1_score":          BENCHMARKS["stacking_rf"]["f1_score"],
        "auc_score":         BENCHMARKS["stacking_rf"]["auc_score"],
    }
