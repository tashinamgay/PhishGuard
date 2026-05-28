# =============================================================================
# routers/researcher.py — Researcher Training API
# =============================================================================

import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from datetime import datetime

from models.database import get_db, TrainingRun, TrainedModel, ActivityLog, User
from models.schemas import TrainRequest, TrainingRunResponse, TrainedModelResponse
from services.training_service import save_dataset, start_training, MODEL_META
from routers.dependencies import require_researcher

router = APIRouter()

ALLOWED_MODELS = list(MODEL_META.keys())


# =============================================================================
# POST /api/research/upload
# =============================================================================
@router.post("/upload")
async def upload_dataset(
    file:         UploadFile = File(...),
    current_user: User       = Depends(require_researcher),
    db                       = Depends(get_db),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()

    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    saved_path, row_count = save_dataset(file.filename, content)

    db.add(ActivityLog({
        "user_id": current_user.id,
        "action":  "dataset_upload",
        "details": f"Uploaded {file.filename} ({row_count} rows)",
    }))
    db.commit()

    return {
        "message":    "Dataset uploaded successfully",
        "filename":   file.filename,
        "saved_path": saved_path,
        "row_count":  row_count,
    }


# =============================================================================
# POST /api/research/train
# =============================================================================
@router.post("/train")
async def start_training_job(
    request:      TrainRequest,
    current_user: User = Depends(require_researcher),
    db                 = Depends(get_db),
):
    if request.model_key not in ALLOWED_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model. Choose from: {', '.join(ALLOWED_MODELS)}"
        )

    if not os.path.exists(request.dataset_path):
        raise HTTPException(status_code=400, detail="Dataset file not found on server")

    try:
        import csv
        with open(request.dataset_path, "r", encoding="utf-8", errors="replace") as f:
            row_count = sum(1 for _ in csv.reader(f)) - 1
    except Exception:
        row_count = 0

    run = TrainingRun({
        "researcher_id":    current_user.id,
        "model_key":        request.model_key,
        "dataset_filename": os.path.basename(request.dataset_path),
        "dataset_rows":     row_count,
        "status":           "pending",
        "progress":         0,
        "current_step":     "Queued",
        "started_at":       datetime.utcnow(),
    })
    db.add(run)
    db.commit()

    db.add(ActivityLog({
        "user_id": current_user.id,
        "action":  "training_started",
        "details": f"Model: {request.model_key}, Dataset: {os.path.basename(request.dataset_path)}",
    }))
    db.commit()

    start_training(run.id, request.model_key, request.dataset_path, row_count)

    return {
        "message": "Training started",
        "run_id":  run.id,
        "model":   request.model_key,
    }


# =============================================================================
# GET /api/research/training/{run_id}/status
# =============================================================================
@router.get("/training/{run_id}/status", response_model=TrainingRunResponse)
async def get_training_status(
    run_id:       int,
    current_user: User = Depends(require_researcher),
    db                 = Depends(get_db),
):
    run = db.query(TrainingRun).filter(TrainingRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Training run not found")
    return run


# =============================================================================
# GET /api/research/runs
# =============================================================================
@router.get("/runs")
async def list_training_runs(
    current_user: User = Depends(require_researcher),
    db                 = Depends(get_db),
):
    runs = db.query(TrainingRun).order_by(TrainingRun.started_at.desc()).limit(50).all()
    return [
        {
            "id":               r.id,
            "model_key":        r.model_key,
            "status":           r.status,
            "progress":         r.progress,
            "current_step":     r.current_step,
            "accuracy":         r.accuracy,
            "f1":               r.f1,
            "dataset_filename": r.dataset_filename,
            "dataset_rows":     r.dataset_rows,
            "started_at":       r.started_at,
            "finished_at":      r.finished_at,
        }
        for r in runs
    ]


# =============================================================================
# GET /api/research/models
# =============================================================================
@router.get("/models", response_model=list[TrainedModelResponse])
async def list_trained_models(
    current_user: User = Depends(require_researcher),
    db                 = Depends(get_db),
):
    return db.query(TrainedModel).order_by(TrainedModel.trained_at.desc()).all()


# =============================================================================
# POST /api/research/models/{model_id}/deploy
# =============================================================================
@router.post("/models/{model_id}/deploy")
async def deploy_model(
    model_id:     int,
    current_user: User = Depends(require_researcher),
    db                 = Depends(get_db),
):
    model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    db.query(TrainedModel).filter(
        TrainedModel.model_key == model.model_key,
        TrainedModel.id != model_id
    ).update({"is_deployed": False})

    model.is_deployed = True
    db.commit()

    db.add(ActivityLog({
        "user_id": current_user.id,
        "action":  "model_deployed",
        "details": f"Deployed {model.display_name} {model.version} (id={model_id})",
    }))
    db.commit()

    return {
        "message":   f"{model.display_name} {model.version} deployed successfully",
        "model_id":  model_id,
        "model_key": model.model_key,
        "version":   model.version,
        "accuracy":  model.accuracy,
    }


# =============================================================================
# GET /api/research/deployed
# =============================================================================
@router.get("/deployed")
async def get_deployed_models(
    current_user: User = Depends(require_researcher),
    db                 = Depends(get_db),
):
    models = db.query(TrainedModel).filter(TrainedModel.is_deployed == True).all()
    return [
        {
            "model_key":    m.model_key,
            "display_name": m.display_name,
            "version":      m.version,
            "accuracy":     m.accuracy,
            "f1_score":     m.f1_score,
            "deployed_at":  m.trained_at,
        }
        for m in models
    ]