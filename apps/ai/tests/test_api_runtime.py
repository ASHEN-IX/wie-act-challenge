"""Real FastAPI bootstrap/auth/schema gates; no inference or database reads."""
from fastapi.testclient import TestClient

from services.api.main import app


SERVICE_KEY = "m01-synthetic-service-key-for-runtime-tests-only"
AUTH_HEADERS = {"Authorization": f"Bearer {SERVICE_KEY}"}
ACTION_PATH = "/api/ai/facilitator/action"


def test_health_is_liveness_without_service_credentials(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_API_KEY", raising=False)
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_private_routes_require_service_auth_configuration(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_API_KEY", raising=False)
    with TestClient(app) as client:
        response = client.post(ACTION_PATH, json={})
    assert response.status_code == 503
    assert response.json() == {"detail": "AI service authentication is not configured"}


def test_private_routes_reject_invalid_service_credentials(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_API_KEY", SERVICE_KEY)
    with TestClient(app) as client:
        response = client.post(
            ACTION_PATH, headers={"Authorization": "Bearer invalid"}, json={}
        )
    assert response.status_code == 401


def test_authenticated_invalid_request_is_rejected_before_processing(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_API_KEY", SERVICE_KEY)
    with TestClient(app) as client:
        response = client.post(ACTION_PATH, headers=AUTH_HEADERS, json={})
    assert response.status_code == 422


def test_explicit_opt_out_uses_existing_deterministic_path(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_API_KEY", SERVICE_KEY)
    monkeypatch.setenv("LLM_MOCK", "0")
    with TestClient(app) as client:
        response = client.post(
            ACTION_PATH,
            headers=AUTH_HEADERS,
            json={
                "roomId": "m01-synthetic-room",
                "actionType": "decline_prompt",
                "userId": "synthetic-user",
            },
        )
    assert response.status_code == 200
    assert response.json()["shouldIntervene"] is False
    assert response.json()["messageText"] == ""


def test_bootstrap_does_not_shadow_shared_security_package():
    import os
    import subprocess
    import sys
    from pathlib import Path

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from services.api.main import app; "
            "from security.prompt_guard import build_system_block; "
            "from utils.llm_client import ask; "
            "assert app is not None and callable(build_system_block) and callable(ask)",
        ],
        cwd=Path(__file__).resolve().parents[1],
        env=os.environ.copy(),
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
