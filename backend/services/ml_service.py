# services/ml_service.py — Real Model Inference (UPDATED)
import os, random, joblib
from datetime import datetime
from pathlib import Path

PHISHING_KEYWORDS = [
    "click here","verify your account","urgent","suspended","congratulations",
    "winner","free gift","claim now","bit.ly","password","credit card",
    "bank account","prize","offer expires","http://","dear customer",
    "confirm your","immediately","verify","account has been","unusual activity",
    "limited time","act now","login","sign in","update your","security alert","locked",
]

MODELS = {
    "stacking_rf":        {"display_name":"Stacking - Random Forest",       "accuracy":0.9805,"f1":0.9805,"auc":None},
    "stacking_logistic":  {"display_name":"Stacking - Logistic Regression", "accuracy":0.9762,"f1":0.9762,"auc":None},
    "llama":              {"display_name":"LLaMA (Individual)",             "accuracy":0.9758,"f1":0.9758,"auc":0.9880},
    "bert":               {"display_name":"BERT",                          "accuracy":0.9703,"f1":0.9631,"auc":0.9965},
    "distilbert":         {"display_name":"DistilBERT",                    "accuracy":0.9600,"f1":0.9509,"auc":0.9910},
    "logistic_regression":{"display_name":"Logistic Regression","accuracy":0.9514,"f1":0.9596,"auc":None},
}

_loaded_models: dict = {}

def _get_risk_level(p):
    return "HIGH" if p >= 0.8 else "MEDIUM" if p >= 0.5 else "LOW"

def _load_pkl(model_key):
    if model_key in _loaded_models:
        return _loaded_models[model_key]
    try:
        from models.database import models_col
        doc = models_col.find_one({"model_key": model_key, "is_deployed": True})
        if doc and doc.get("file_path") and Path(doc["file_path"]).exists():
            bundle = joblib.load(doc["file_path"])
            _loaded_models[model_key] = bundle
            print(f"[ML] Loaded real model: {doc['file_path']}")
            return bundle
        print(f"[ML] No deployed .pkl found for '{model_key}'")
    except Exception as e:
        print(f"[ML] Could not load pkl for '{model_key}': {e}")
    return None

def _real_predict(email_text, bundle):
    clf = bundle.get("classifier") or bundle.get("model")
    vec = bundle.get("vectorizer")
    X = vec.transform([email_text])
    proba = clf.predict_proba(X)[0]
    phishing_prob = round(float(proba[1]), 4)
    safe_prob = round(float(proba[0]), 4)
    label = "phishing" if phishing_prob >= 0.5 else "safe"
    confidence = phishing_prob if label == "phishing" else safe_prob
    return {"label":label,"confidence":round(confidence,4),"safe_prob":safe_prob,
            "phishing_prob":phishing_prob,"risk_level":_get_risk_level(phishing_prob)}

def _mock_predict(email_text, model_key="bert"):
    text_lower = email_text.lower()
    hits = sum(1 for kw in PHISHING_KEYWORDS if kw in text_lower)
    base = min(0.12 + hits * 0.11, 0.97)
    noise_scale = {"stacking_rf":0.02,"stacking_logistic":0.025,"llama":0.035,"bert":0.03,"distilbert":0.05}.get(model_key, 0.04)
    phishing_prob = round(max(0.02, min(0.98, base + random.uniform(-noise_scale, noise_scale))), 4)
    safe_prob = round(1.0 - phishing_prob, 4)
    label = "phishing" if phishing_prob >= 0.5 else "safe"
    confidence = phishing_prob if label == "phishing" else safe_prob
    return {"label":label,"confidence":round(confidence,4),"safe_prob":safe_prob,
            "phishing_prob":phishing_prob,"risk_level":_get_risk_level(phishing_prob)}

def predict_email(email_text, model_key="stacking_rf"):
    if model_key not in MODELS:
        model_key = "stacking_rf"
    if model_key == "logistic_regression":
        bundle = _load_pkl(model_key)
        result = _real_predict(email_text, bundle) if bundle else _mock_predict(email_text, model_key)
        result["inference_mode"] = "real" if bundle else "mock_no_model"
    else:
        result = _mock_predict(email_text, model_key)
        result["inference_mode"] = "mock_gpu_required"
    result["model_used"] = model_key
    result["timestamp"] = datetime.utcnow()
    result["email_preview"] = email_text[:100].strip()
    return result

def predict_batch(emails, model_key="stacking_rf"):
    return [predict_email(e, model_key) for e in emails]
