# =============================================================================
# locustfile.py — PhishGuard Load Testing
# =============================================================================

from locust import HttpUser, task, between

class PhishGuardUser(HttpUser):
    wait_time = between(1, 3)
    token = None

    def on_start(self):
        """Login before starting tests"""
        response = self.client.post("/api/auth/login", json={
            "email":    "tashi@gmail.com",
            "password": "123456789"
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
        else:
            print(f"Login failed: {response.status_code}")

    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    @task(3)
    def predict_email(self):
        """Predict phishing email — most common task"""
        self.client.post("/api/predict",
            json={
                "email_text": "Click here urgently to verify your account password and credit card",
                "model_key":  "logistic_regression"
            },
            headers=self.get_headers()
        )

    @task(2)
    def get_history(self):
        """Get prediction history"""
        self.client.get("/api/history",
            headers=self.get_headers()
        )

    @task(1)
    def get_stats(self):
        """Get system stats — no token needed"""
        self.client.get("/api/stats")