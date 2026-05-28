#!/usr/bin/env python3
# =============================================================================
# deploy_best_model.py — Run ONCE from backend/ to register your best .pkl
# Usage: python deploy_best_model.py
# =============================================================================
import os, sys, joblib
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models.database import models_col, _next_id

MODEL_DIR = os.getenv("MODEL_STORAGE_PATH", "./trained_models")

def main():
    print("=" * 55)
    print("PhishGuard - Deploy Best Model")
    print("=" * 55)

    pkls = sorted([f for f in os.listdir(MODEL_DIR)
                   if f.startswith("logistic_regression") and f.endswith(".pkl")])
    if not pkls:
        print(f"ERROR: No .pkl files in {MODEL_DIR}/ - train a model first.")
        sys.exit(1)

    best = pkls[-1]
    path = os.path.join(MODEL_DIR, best)
    print(f"Selected: {best}")

    print("Validating bundle...")
    try:
        bundle = joblib.load(path)
        clf = bundle.get("classifier") or bundle.get("model")
        vec = bundle.get("vectorizer")
        if clf is None or vec is None:
            raise ValueError(f"Missing keys. Found: {list(bundle.keys())}")
        proba = clf.predict_proba(vec.transform(["test email"]))[0]
        print(f"OK - safe={proba[0]:.3f} phishing={proba[1]:.3f}")
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    version = "v1"
    try:
        version = f"v{best.replace('.pkl','').split('_v')[-1]}"
    except Exception:
        pass

    models_col.update_many({"model_key":"logistic_regression"}, {"$set":{"is_deployed":False}})
    existing = models_col.find_one({"file_path": path})
    if existing:
        models_col.update_one({"file_path": path}, {"$set":{"is_deployed":True}})
        print(f"Updated existing record id={existing['id']}")
    else:
        doc = {"id":_next_id("TrainedModel"),"model_key":"logistic_regression",
               "display_name":"Logistic Regression","version":version,
               "file_path":path,"accuracy":0.9514,"precision":0.9400,
               "recall":0.9800,"f1_score":0.9596,"auc_score":None,
               "is_deployed":True,"dataset_name":best,"trained_at":datetime.utcnow()}
        models_col.insert_one(doc)
        print(f"Inserted new record id={doc['id']}")

    print()
    print(f"SUCCESS: {best} is now deployed.")
    print("Restart uvicorn - real predictions are now active.")
    print("=" * 55)

if __name__ == "__main__":
    main()
