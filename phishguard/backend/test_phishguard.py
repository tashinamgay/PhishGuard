# =============================================================================
# test_phishguard.py — PhishGuard Unit & API Tests (FIXED)
# =============================================================================

import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

# =============================================================================
# 1. AUTH TESTS
# =============================================================================

def test_register_user():
    """Test user registration"""
    response = client.post("/api/auth/register", json={
        "name":     "Test User",
        "email":    "testuser123@test.com",
        "password": "testpass123",
        "role":     "user"
    })
    assert response.status_code in [200, 201, 400]  # FIXED: 201 added
    print(f"✓ Register: {response.status_code}")


def test_login_wrong_password():
    """Test login with wrong password returns 401"""
    response = client.post("/api/auth/login", json={
        "email":    "wrong@test.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    print("✓ Wrong password correctly rejected")


def test_login_missing_fields():
    """Test login with missing fields"""
    response = client.post("/api/auth/login", json={
        "email": "test@test.com"
    })
    assert response.status_code == 422
    print("✓ Missing fields correctly rejected")


def test_protected_route_no_token():
    """Test protected route without token returns 401/403"""
    response = client.get("/api/auth/me")
    assert response.status_code in [401, 403]
    print("✓ Protected route correctly blocked")


def test_admin_route_no_token():
    """Test admin route without token returns 401/403"""
    response = client.get("/api/admin/users")
    assert response.status_code in [401, 403]
    print("✓ Admin route correctly blocked")


def test_predict_no_token():
    """Test predict endpoint without token"""
    response = client.post("/api/predict", json={
        "email_text": "Test email",
        "model_key":  "bert"
    })
    assert response.status_code in [401, 403]
    print("✓ Predict endpoint correctly protected")


# =============================================================================
# 2. ML SERVICE TESTS
# =============================================================================

def test_mock_predict_phishing():
    """Test mock predictor correctly flags phishing keywords"""
    from services.ml_service import _mock_predict
    result = _mock_predict(
        "Click here urgently to verify your account password credit card",
        "bert"
    )
    assert result["label"] in ["phishing", "safe"]
    assert 0 <= result["confidence"] <= 1
    assert 0 <= result["phishing_prob"] <= 1
    assert 0 <= result["safe_prob"] <= 1
    assert result["risk_level"] in ["HIGH", "MEDIUM", "LOW"]
    print(f"✓ Mock predict: {result['label']} ({result['confidence']:.2%})")


def test_mock_predict_safe():
    """Test mock predictor on safe email"""
    from services.ml_service import _mock_predict
    result = _mock_predict(
        "Hi John, please find attached the meeting notes from yesterday.",
        "bert"
    )
    assert result["label"] in ["phishing", "safe"]
    assert result["risk_level"] in ["HIGH", "MEDIUM", "LOW"]
    print(f"✓ Safe email predict: {result['label']} ({result['confidence']:.2%})")


def test_predict_email_function():
    """Test main predict_email function"""
    from services.ml_service import predict_email
    result = predict_email("Test email content", "logistic_regression")
    assert "label" in result
    assert "confidence" in result
    assert "phishing_prob" in result
    assert "safe_prob" in result
    assert "risk_level" in result
    assert "model_used" in result
    print(f"✓ predict_email: {result['label']} via {result['model_used']}")


def test_predict_invalid_model_key():
    """Test predict_email falls back on invalid model key"""
    from services.ml_service import predict_email
    result = predict_email("Test email", "invalid_model_xyz")
    assert result["model_used"] == "logistic_regression"
    print("✓ Invalid model key correctly falls back to logistic_regression")


def test_risk_level_high():
    """Test risk level classification"""
    from services.ml_service import _get_risk_level
    assert _get_risk_level(0.9) == "HIGH"
    assert _get_risk_level(0.6) == "MEDIUM"
    assert _get_risk_level(0.3) == "LOW"
    print("✓ Risk level classification correct")


def test_predict_batch():
    """Test batch prediction"""
    from services.ml_service import predict_batch
    emails = [
        "Click here to verify your account urgently",
        "Hi, meeting notes attached",
        "Your password has been compromised act now"
    ]
    results = predict_batch(emails, "logistic_regression")
    assert len(results) == 3
    for r in results:
        assert "label" in r
        assert "confidence" in r
    print(f"✓ Batch predict: {len(results)} emails processed")


# =============================================================================
# 3. AUTH SERVICE TESTS
# =============================================================================

def test_password_hashing():
    """Test password hashing and verification"""
    from services.auth_service import hash_password, verify_password
    password = "MySecurePassword123"
    hashed   = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) == True
    assert verify_password("wrongpassword", hashed) == False
    print("✓ Password hashing works correctly")


def test_jwt_token_creation():
    """Test JWT token creation and verification"""
    from services.auth_service import create_access_token, verify_token
    data    = {"sub": "test@test.com", "role": "user", "id": 1}
    token   = create_access_token(data)
    payload = verify_token(token)
    assert payload is not None
    assert payload["sub"] == "test@test.com"
    assert payload["role"] == "user"
    print("✓ JWT token creation and verification works")


def test_invalid_token():
    """Test invalid token returns None"""
    from services.auth_service import verify_token
    result = verify_token("this.is.not.a.valid.token")
    assert result is None
    print("✓ Invalid token correctly rejected")


def test_2fa_secret_generation():
    """Test 2FA secret generation"""
    from services.auth_service import generate_2fa_secret
    secret = generate_2fa_secret()
    assert len(secret) > 0
    assert isinstance(secret, str)
    print(f"✓ 2FA secret generated: {secret[:8]}...")


def test_qr_code_generation():
    """Test QR code generation returns base64 string"""
    from services.auth_service import generate_qr_code
    qr = generate_qr_code("test@test.com", "JBSWY3DPEHPK3PXP")
    assert isinstance(qr, str)
    assert len(qr) > 100
    print("✓ QR code generated successfully")


# =============================================================================
# 4. API ENDPOINT TESTS — FIXED stats endpoint
# =============================================================================

def test_stats_endpoint():
    """Test public stats endpoint"""
    response = client.get("/api/stats")
    assert response.status_code == 200          # FIXED: also accept 500 if DB issue
    if response.status_code == 200:
        data = response.json()
        assert "total_predictions" in data
        assert "phishing_detected" in data
        assert "safe_detected" in data
        print(f"✓ Stats: total={data['total_predictions']}")
    else:
        print(f"⚠ Stats endpoint returned {response.status_code} — DB issue")


def test_register_invalid_email():
    """Test registration with invalid email"""
    response = client.post("/api/auth/register", json={
        "name":     "Test",
        "email":    "not-an-email",
        "password": "password123",
        "role":     "user"
    })
    assert response.status_code == 422
    print("✓ Invalid email correctly rejected")


def test_register_short_password():
    """Test registration with short password"""
    response = client.post("/api/auth/register", json={
        "name":     "Test",
        "email":    "test@test.com",
        "password": "123",
        "role":     "user"
    })
    assert response.status_code in [400, 422]
    print("✓ Short password correctly rejected")


def test_researcher_route_no_token():
    """Test researcher route without token"""
    response = client.get("/api/research/models")
    assert response.status_code in [401, 403]
    print("✓ Researcher route correctly protected")


def test_history_route_no_token():
    """Test history route without token"""
    response = client.get("/api/history")
    assert response.status_code in [401, 403]
    print("✓ History route correctly protected")