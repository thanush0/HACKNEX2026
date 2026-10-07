from fastapi.testclient import TestClient
from app.main import app


def test_reconstruct_requires_files():
    with TestClient(app) as client:
        response = client.post("/api/reconstruct")
        assert response.status_code == 422
