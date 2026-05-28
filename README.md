# PhishGuard v3.1

LLM-assisted phishing email detection and explanation platform built for the CIHE cybersecurity project requirement.

## What This Project Includes

- Admin, researcher, and normal user roles
- Admin approval, user management, suspension/deletion, and activity logs
- Mandatory two-factor authentication using authenticator apps
- Email phishing/safe classification with confidence and risk level
- Google Gemini explanation on demand with caching, rate limiting, and fallback explanation
- Researcher dashboard for dataset upload, model training/testing, confusion matrix, classification report, and model deployment
- Real deployable Logistic Regression pipeline using TF-IDF and scikit-learn
- Research benchmark workflows for BERT, DistilBERT, and TinyLLaMA
- MongoDB Atlas persistence for users, predictions, logs, training runs, and model metadata

## Important Model Note

The real local training/deployment path is:

```text
TF-IDF vectorizer + Logistic Regression classifier
```

BERT, DistilBERT, and TinyLLaMA are included in the researcher workflow as advanced model benchmark options. For production use, their trained model weights should be deployed through a GPU-enabled inference service.

## Quick Start

### 1. Backend

```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env` and set:

```text
MONGO_URL=your MongoDB Atlas URL
GEMINI_API_KEY=your Gemini API key
SECRET_KEY=a long random secret
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

If port `8000` is already used by another project, run the included helper:

```powershell
.\Start-PhishGuard.ps1
```

This starts PhishGuard on:

```text
Frontend: http://127.0.0.1:5174
Backend:  http://127.0.0.1:8001
```

To stop those helper-started services:

```powershell
.\Stop-PhishGuard.ps1
```

## First Login Flow

1. Register the first account. The first account becomes admin automatically.
2. Login.
3. Set up 2FA with Google Authenticator or another TOTP app.
4. Register researcher/user accounts.
5. Admin approves new accounts and assigns roles.

## Activate Real Logistic Regression Prediction

1. Set this in `backend/.env`:

```text
USE_MOCK_MODEL=false
```

2. Login as researcher.
3. Upload a labelled CSV dataset.
4. Train `Logistic Regression`.
5. From the backend folder, run:

```bash
python deploy_best_model.py
```

6. Restart the backend.

## Requirement Mapping

| Requirement | PhishGuard implementation |
| --- | --- |
| Admin role | Admin dashboard, approval, role/status updates, delete users, logs |
| Researcher role | Dataset upload, train/test, metrics, confusion matrix, classification report, deploy model |
| Normal user role | Email detector, prediction result, history, Gemini explanation |
| Gemini integration | On-demand `/api/explain/{prediction_id}` workflow |
| ML model integration | Logistic Regression `.pkl` bundle loading and prediction |
| Advanced model research | BERT, DistilBERT, TinyLLaMA benchmark workflows |
| 2FA for all users | TOTP setup and login verification |
| Security | Password hashing, JWT, RBAC, approval workflow, audit logs |

## Submission Cleanup Checklist

Before zipping the final project, remove these folders/files:

```text
frontend/node_modules/
frontend/dist/
backend/venv/
backend/__pycache__/
backend/.pytest_cache/
backend/.env
```

Keep:

```text
backend/.env.example
backend/requirements.txt
frontend/package.json
README.md
```

Keep trained model `.pkl` files only if your submission requires the demo to run without retraining.
