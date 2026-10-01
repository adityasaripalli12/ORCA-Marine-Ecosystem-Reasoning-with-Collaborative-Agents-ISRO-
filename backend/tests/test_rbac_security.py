
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.auth.jwt import create_access_token
from backend.database.connection import SessionLocal
from backend.models.user import User

client = TestClient(app)

def get_token_for_role(role: str, email: str) -> str:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user_id = user.id if user else "test-id"
        return create_access_token(data={"sub": user_id, "email": email, "role": role})
    finally:
        db.close()

def test_student_cannot_delete_dataset():
    token = get_token_for_role("Student", "student@gmail.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.delete("/datasets/123", headers=headers)
    assert response.status_code == 403, f"Expected 403 for Student deleting dataset, got {response.status_code}"

def test_shipping_cannot_access_audit_logs():
    token = get_token_for_role("Shipping", "shipping@gmail.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/admin/audit-logs", headers=headers)
    assert response.status_code == 403, f"Expected 403 for Shipping viewing audit logs, got {response.status_code}"

def test_researcher_cannot_manage_users():
    token = get_token_for_role("Researcher", "research@gmail.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/admin/users", headers=headers)
    assert response.status_code == 403, f"Expected 403 for Researcher viewing users, got {response.status_code}"

def test_government_cannot_delete_dataset():
    token = get_token_for_role("Government", "govp@gmail.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.delete("/datasets/123", headers=headers)
    assert response.status_code == 403, f"Expected 403 for Government deleting dataset, got {response.status_code}"

def test_administrator_has_access():
    token = get_token_for_role("Admin", "admin@gmail.com")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/admin/users", headers=headers)
    assert response.status_code == 200, f"Expected 200 for Admin viewing users, got {response.status_code}"
