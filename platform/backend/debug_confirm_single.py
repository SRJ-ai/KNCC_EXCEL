import sys
import os

# Add platform/backend to path
sys.path.append(r"c:\Users\Admin\Desktop\KNCC_EXCEL\platform\backend")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("1. Registering user...")
auth_data = {
    "email": "test_debug@kncc.com",
    "password": "testpassword123",
    "name": "Test User",
    "organization_name": "KNCC"
}
res = client.post("/api/auth/register", json=auth_data)
print("Register status:", res.status_code, res.text)

print("2. Logging in...")
login_data = {"username": auth_data["email"], "password": auth_data["password"]}
res = client.post("/api/auth/login", data=login_data)
print("Login status:", res.status_code)
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("3. Creating project...")
res = client.post("/api/projects/", json={"name": "Willow Way Village", "job_number": "60126", "tax_rate": 1.06}, headers=headers)
print("Create project status:", res.status_code)
project_id = res.json()["id"]

print("4. Confirming PO...")
res = client.post("/api/upload/confirm", data={
    "filename": "Willow way  Lumber PO.pdf",
    "doc_type": "PO",
    "project_id": str(project_id)
}, headers=headers)
print("Confirm PO status:", res.status_code, res.text)

print("5. Confirming Invoice 60126022.pdf...")
try:
    res = client.post("/api/upload/confirm", data={
        "filename": "60126022.pdf",
        "doc_type": "INV",
        "project_id": str(project_id)
    }, headers=headers)
    print("Confirm Invoice status:", res.status_code, res.text)
except Exception as e:
    import traceback
    print("CRITICAL EXCEPTION RAISED:")
    traceback.print_exc()
