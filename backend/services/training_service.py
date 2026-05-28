# =============================================================================
# services/training_service.py — Model Training Service (MongoDB version)
# =============================================================================

import os
import csv
import io
import time
import random
import threading
from datetime import datetime
from pathlib import Path

DATASET_STORAGE_PATH = os.getenv("DATASET_STORAGE_PATH", "./datasets")
MODEL_STORAGE_PATH   = os.getenv("MODEL_STORAGE_PATH",   "./trained_models")
USE_MOCK             = os.getenv("USE_MOCK_MODEL", "true").lower() == "true"

Path(DATASET_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
Path(MODEL_STORAGE_PATH).mkdir(parents=True, exist_ok=True)


MODEL_META = {
    "stacking_rf": {
        "display_name": "Stacking - Random Forest",
        "accuracy": 0.9805, "precision": 0.9805,
        "recall":   0.9805, "f1":        0.9805, "auc": None,
    },
    "stacking_logistic": {
        "display_name": "Stacking - Logistic Regression",
        "accuracy": 0.9762, "precision": 0.9762,
        "recall":   0.9762, "f1":        0.9762, "auc": None,
    },
    "bert": {
        "display_name": "BERT",
        "accuracy": 0.9703, "precision": 0.9410,
        "recall":   0.9863, "f1":        0.9631, "auc": 0.9965,
    },
    "distilbert": {
        "display_name": "DistilBERT",
        "accuracy": 0.9600, "precision": 0.9393,
        "recall":   0.9627, "f1":        0.9509, "auc": 0.9910,
    },
    "llama": {
        "display_name": "LLaMA (Individual)",
        "accuracy": 0.9758, "precision": 0.9758,
        "recall":   0.9758, "f1":        0.9758, "auc": 0.9880,
    },
    "logistic_regression": {
        "display_name": "Logistic Regression",
        "accuracy": 0.9514, "precision": 0.9400,
        "recall":   0.9800, "f1":        0.9596, "auc": None,
    },
}

TRAINING_STEPS = {
    "stacking_rf": [
        (10, "Loading trained base model predictions"),
        (25, "Preparing validation features"),
        (45, "Training Random Forest meta-learner"),
        (70, "Evaluating stacked predictions"),
        (90, "Computing F1 score and report"),
        (100,"Training complete"),
    ],
    "stacking_logistic": [
        (10, "Loading trained base model predictions"),
        (25, "Preparing validation features"),
        (45, "Training Logistic Regression meta-learner"),
        (70, "Evaluating stacked predictions"),
        (90, "Computing F1 score and report"),
        (100,"Training complete"),
    ],
    "bert": [
        (5,  "Loading dataset and tokenizer"),
        (15, "Tokenizing email texts (max_length=128)"),
        (25, "Building DataLoader (batch_size=8)"),
        (35, "Epoch 1/5 - training"),
        (50, "Epoch 2/5 - training"),
        (62, "Epoch 3/5 - training"),
        (74, "Epoch 4/5 - training"),
        (85, "Epoch 5/5 - training"),
        (92, "Evaluating on test set"),
        (97, "Computing metrics (confusion matrix, F1, AUC)"),
        (100,"Training complete"),
    ],
    "distilbert": [
        (5,  "Loading DistilBERT tokenizer"),
        (15, "Tokenizing dataset"),
        (30, "Epoch 1/5"), (50, "Epoch 2/5"),
        (65, "Epoch 3/5"), (78, "Epoch 4/5"), (88, "Epoch 5/5"),
        (94, "Evaluating on test set"),
        (98, "Computing metrics"),
        (100,"Training complete"),
    ],
    "llama": [
        (5,  "Loading TinyLLaMA base model"),
        (12, "Applying LoRA adapters"),
        (22, "Tokenizing with chat template"),
        (35, "LoRA fine-tune epoch 1/5"), (50, "LoRA fine-tune epoch 2/5"),
        (62, "LoRA fine-tune epoch 3/5"), (74, "LoRA fine-tune epoch 4/5"),
        (84, "LoRA fine-tune epoch 5/5"),
        (92, "Merging LoRA weights"),
        (97, "Evaluating on test set"),
        (100,"Training complete"),
    ],
    "logistic_regression": [
        (10, "Loading and cleaning dataset"),
        (25, "TF-IDF vectorization (max_features=10000)"),
        (45, "Fitting Logistic Regression (C=1.0, max_iter=1000)"),
        (70, "Cross-validation (5-fold)"),
        (85, "Evaluating on held-out test set"),
        (95, "Computing confusion matrix and classification report"),
        (100,"Training complete"),
    ],
}


def save_dataset(filename: str, content: bytes) -> tuple:
    safe_name  = filename.replace(" ", "_").replace("/", "_")
    timestamp  = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    saved_path = os.path.join(DATASET_STORAGE_PATH, f"{timestamp}_{safe_name}")

    with open(saved_path, "wb") as f:
        f.write(content)

    try:
        text   = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows   = sum(1 for _ in reader)
    except Exception:
        rows = 0

    return saved_path, rows


def _make_metrics(model_key: str, total_rows: int) -> dict:
    meta  = MODEL_META.get(model_key, MODEL_META["stacking_rf"])
    noise = lambda base, scale=0.005: round(base + random.uniform(-scale, scale), 4)

    acc  = noise(meta["accuracy"])
    prec = noise(meta["precision"])
    rec  = noise(meta["recall"])
    f1   = noise(meta["f1"])
    auc  = noise(meta["auc"]) if meta["auc"] else None

    test_n   = max(int(total_rows * 0.2), 100) if total_rows else 800
    phishing = int(test_n * 0.39)
    safe     = test_n - phishing
    tp = int(phishing * rec)
    fn = phishing - tp
    tn = int(safe * (prec * rec / f1 if f1 else 0.95))
    fp = safe - tn

    report = {
        "safe":         {"precision": round(tn/(tn+fn+1e-9),4), "recall": round(tn/(tn+fp+1e-9),4), "f1-score": round(2*tn/(2*tn+fp+fn+1e-9),4), "support": safe},
        "phishing":     {"precision": round(prec,4), "recall": round(rec,4), "f1-score": round(f1,4), "support": phishing},
        "accuracy":     round(acc,4),
        "macro avg":    {"precision": round((prec+tn/(tn+fn+1e-9))/2,4), "recall": round((rec+tn/(tn+fp+1e-9))/2,4), "f1-score": round(f1,4), "support": test_n},
        "weighted avg": {"precision": round(prec,4), "recall": round(rec,4), "f1-score": round(f1,4), "support": test_n},
    }

    return {
        "accuracy": acc, "precision_score": prec, "recall_score": rec,
        "f1": f1, "auc_score": auc,
        "confusion_matrix": [[tn, fp], [fn, tp]],
        "classification_report": report,
    }


# =============================================================================
# Mock training
# =============================================================================
def _run_mock_training(run_id: int, model_key: str, dataset_path: str, dataset_rows: int):
    from models.database import SessionLocal, TrainingRun, TrainedModel

    db    = SessionLocal()
    steps = TRAINING_STEPS.get(model_key, TRAINING_STEPS["stacking_rf"])

    try:
        run = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        if not run:
            return

        run.status = "running"
        db.add(run)
        db.commit()

        total_time = {"stacking_rf": 20, "stacking_logistic": 18, "bert": 40, "distilbert": 30, "llama": 35, "logistic_regression": 15}.get(model_key, 20)

        for i, (progress, label) in enumerate(steps):
            run              = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
            run.progress     = progress
            run.current_step = label
            db.add(run)
            db.commit()

            gap   = steps[i][0] - (steps[i-1][0] if i > 0 else 0)
            delay = (gap / 100) * total_time
            time.sleep(delay + random.uniform(0.2, 0.8))

        metrics = _make_metrics(model_key, dataset_rows)
        meta    = MODEL_META.get(model_key, {})
        count   = db.query(TrainedModel).filter(TrainedModel.model_key == model_key).count()

        tm = TrainedModel({
            "model_key":    model_key,
            "display_name": meta.get("display_name", model_key),
            "version":      f"v{count + 1}",
            "file_path":    os.path.join(MODEL_STORAGE_PATH, f"{model_key}_v{count+1}.pkl"),
            "accuracy":     metrics["accuracy"],
            "precision":    metrics["precision_score"],
            "recall":       metrics["recall_score"],
            "f1_score":     metrics["f1"],
            "auc_score":    metrics["auc_score"],
            "is_deployed":  False,
            "dataset_name": os.path.basename(dataset_path) if dataset_path else None,
            "trained_by":   run.researcher_id,
            "trained_at":   datetime.utcnow(),
        })
        db.add(tm)
        db.commit()

        run                       = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        run.status                = "done"
        run.progress              = 100
        run.current_step          = "Training complete"
        run.trained_model_id      = tm.id
        run.accuracy              = metrics["accuracy"]
        run.precision_score       = metrics["precision_score"]
        run.recall_score          = metrics["recall_score"]
        run.f1                    = metrics["f1"]
        run.auc_score             = metrics["auc_score"]
        run.confusion_matrix      = metrics["confusion_matrix"]
        run.classification_report = metrics["classification_report"]
        run.finished_at           = datetime.utcnow()
        db.add(run)
        db.commit()

        print(f"[Training] Run {run_id} complete - {model_key} accuracy={metrics['accuracy']:.4f}")

    except Exception as e:
        print(f"[Training] Run {run_id} FAILED: {e}")
        try:
            run = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
            if run:
                run.status        = "failed"
                run.error_message = str(e)
                run.finished_at   = datetime.utcnow()
                db.add(run)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# =============================================================================
# Real Logistic Regression training
# =============================================================================
def _run_real_lr_training(run_id: int, dataset_path: str):
    from models.database import SessionLocal, TrainingRun, TrainedModel
    import pickle

    db = SessionLocal()

    def update(progress, step):
        r = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        if r:
            r.progress     = progress
            r.current_step = step
            db.add(r)
            db.commit()

    try:
        import pandas as pd
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import train_test_split, cross_val_score
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score,
            f1_score, confusion_matrix, classification_report, roc_auc_score
        )

        run        = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        run.status = "running"
        db.add(run)
        db.commit()

        update(10, "Loading dataset")
        df        = pd.read_csv(dataset_path)
        text_col  = next((c for c in df.columns if c.lower() in ["text","email text","email_text","body"]), df.columns[0])
        label_col = next((c for c in df.columns if c.lower() in ["label","email type","type","class"]), df.columns[1])
        df        = df[[text_col, label_col]].dropna()
        df.columns = ["text", "label"]

        if df["label"].dtype == object:
            df["label"] = df["label"].str.lower().map(lambda x: 1 if "phish" in str(x) else 0)

        run              = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        run.dataset_rows = len(df)
        db.add(run)
        db.commit()

        update(25, "TF-IDF vectorization (max_features=10000)")
        X_train, X_test, y_train, y_test = train_test_split(
            df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
        )
        vec  = TfidfVectorizer(max_features=10000, ngram_range=(1,2), sublinear_tf=True)
        X_tr = vec.fit_transform(X_train)
        X_te = vec.transform(X_test)

        update(50, "Fitting Logistic Regression (C=1.0, max_iter=1000)")
        clf = LogisticRegression(C=1.0, max_iter=1000, solver="lbfgs")
        clf.fit(X_tr, y_train)

        update(65, "Running 5-fold cross-validation")
        cv_scores = cross_val_score(clf, X_tr, y_train, cv=5, scoring="f1")
        print(f"[Real LR] CV F1: {cv_scores.round(4)} | mean={cv_scores.mean():.4f}")

        update(75, "Evaluating on held-out test set")
        y_pred = clf.predict(X_te)
        y_prob = clf.predict_proba(X_te)[:, 1]

        acc  = round(accuracy_score(y_test, y_pred), 4)
        prec = round(precision_score(y_test, y_pred, zero_division=0), 4)
        rec  = round(recall_score(y_test, y_pred, zero_division=0), 4)
        f1   = round(f1_score(y_test, y_pred, zero_division=0), 4)
        auc  = round(roc_auc_score(y_test, y_prob), 4)
        cm   = confusion_matrix(y_test, y_pred).tolist()
        rpt  = classification_report(y_test, y_pred, target_names=["safe","phishing"], output_dict=True)

        update(90, "Saving model to disk")
        count = db.query(TrainedModel).filter(TrainedModel.model_key == "logistic_regression").count()
        fname = f"logistic_regression_v{count+1}.pkl"
        fpath = os.path.join(MODEL_STORAGE_PATH, fname)

        with open(fpath, "wb") as f:
            import joblib; bundle = {"vectorizer": vec, "classifier": clf}; joblib.dump(bundle, fpath)

        run = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        tm  = TrainedModel({
            "model_key":    "logistic_regression",
            "display_name": "Logistic Regression",
            "version":      f"v{count+1}",
            "file_path":    fpath,
            "accuracy":     acc,
            "precision":    prec,
            "recall":       rec,
            "f1_score":     f1,
            "auc_score":    auc,
            "is_deployed":  False,
            "dataset_name": os.path.basename(dataset_path),
            "trained_by":   run.researcher_id,
            "trained_at":   datetime.utcnow(),
        })
        db.add(tm)
        db.commit()

        run                       = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
        run.status                = "done"
        run.progress              = 100
        run.current_step          = "Training complete"
        run.trained_model_id      = tm.id
        run.accuracy              = acc
        run.precision_score       = prec
        run.recall_score          = rec
        run.f1                    = f1
        run.auc_score             = auc
        run.confusion_matrix      = cm
        run.classification_report = rpt
        run.finished_at           = datetime.utcnow()
        db.add(run)
        db.commit()

        print(f"[Training] Real LR done - acc={acc} prec={prec} rec={rec} f1={f1} auc={auc}")

    except Exception as e:
        print(f"[Training] Real LR {run_id} FAILED: {e}")
        try:
            run = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
            if run:
                run.status        = "failed"
                run.error_message = str(e)
                run.finished_at   = datetime.utcnow()
                db.add(run)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# =============================================================================
# Public entry point
# =============================================================================
def start_training(run_id: int, model_key: str, dataset_path: str, dataset_rows: int):
    if not USE_MOCK and model_key == "logistic_regression":
        t = threading.Thread(target=_run_real_lr_training, args=(run_id, dataset_path), daemon=True)
    else:
        t = threading.Thread(target=_run_mock_training, args=(run_id, model_key, dataset_path, dataset_rows), daemon=True)
    t.start()
    print(f"[Training] Started run {run_id} - model={model_key}, mock={USE_MOCK}")
