import os
import requests
import time
import re

BASE_URL = "http://127.0.0.1:8000/api"

# Paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROJECTS_DIR = os.path.join(ROOT_DIR, "Client")
WILLOW_DIR = os.path.join(PROJECTS_DIR, "Willow way Village")
COBIA_DIR = os.path.join(PROJECTS_DIR, "Cobia Cove")

def get_pdfs_from_dir(directory):
    pdfs = []
    if os.path.exists(directory):
        for root, _, files in os.walk(directory):
            for file in files:
                if file.lower().endswith('.pdf'):
                    pdfs.append(os.path.join(root, file))
    return pdfs

def test_full_flow():
    # 0. Authenticate
    print("Authenticating...")
    auth_data = {
        "email": "test@kncc.com",
        "password": "testpassword123",
        "name": "Test User",
        "organization_name": "KNCC"
    }
    # Try register first
    res = requests.post(f"{BASE_URL}/auth/register", json=auth_data)
    if res.status_code == 400 and "Email already registered" in res.text:
        # If already registered, login
        login_data = {"username": auth_data["email"], "password": auth_data["password"]}
        res = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    
    res.raise_for_status()
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create Projects
    print("Creating projects...")
    res = requests.post(f"{BASE_URL}/projects/", json={"name": "Willow Way Village", "job_number": "60126", "tax_rate": 1.06}, headers=headers)
    willow_id = res.json()["id"]
    
    res = requests.post(f"{BASE_URL}/projects/", json={"name": "Cobia Cove Appartments", "job_number": "68981", "tax_rate": 1.06}, headers=headers)
    cobia_id = res.json()["id"]

    # 2. Upload POs to establish base materials (if any exist)
    print("Uploading POs...")
    for project_id, directory in [(willow_id, WILLOW_DIR), (cobia_id, COBIA_DIR)]:
        # Usually POs are named "PO.pdf" or similar
        pdfs = get_pdfs_from_dir(directory)
        for pdf_path in pdfs:
            if "po.pdf" in pdf_path.lower() or "purchase order" in pdf_path.lower():
                filename = os.path.basename(pdf_path)
                print(f"Uploading {filename}...")
                # We just use the confirm endpoint directly for testing
                res = requests.post(f"{BASE_URL}/upload/confirm", data={
                    "filename": filename,
                    "doc_type": "PO",
                    "project_id": project_id
                }, headers=headers)
                res.raise_for_status()
                data = res.json()
                print(f"Response for {filename}: {data}")
                assert data.get("line_items_parsed", 0) > 0, f"No line items parsed for {filename}"
                    
    # 3. Upload Invoices & COs
    print("Uploading Invoices and COs...")
    for project_id, directory in [(willow_id, WILLOW_DIR), (cobia_id, COBIA_DIR)]:
        pdfs = get_pdfs_from_dir(directory)
        for pdf_path in pdfs:
            filename = os.path.basename(pdf_path)
            doc_type = "UNKNOWN"
            if "co" in filename.lower() and "cobia" not in filename.lower():
                doc_type = "CO"
            elif "invoice" in filename.lower() or re.match(r'\d{5,}', filename):
                doc_type = "INV"
                
            if doc_type != "UNKNOWN":
                print(f"Uploading {filename} as {doc_type}...")
                res = requests.post(f"{BASE_URL}/upload/confirm", data={
                    "filename": filename,
                    "doc_type": doc_type,
                    "project_id": project_id
                }, headers=headers)
                res.raise_for_status()
                data = res.json()
                print(f"Response for {filename}: {data}")
                assert data.get("line_items_parsed", 0) > 0, f"No line items parsed for {filename}"
                
    # 4. Generate Export
    print("Exporting Excel...")
    res = requests.post(f"{BASE_URL}/export/{willow_id}", headers=headers)
    if res.status_code == 200:
        print("Willow Way export generated.")
    res = requests.post(f"{BASE_URL}/export/{cobia_id}", headers=headers)
    if res.status_code == 200:
        print("Cobia Cove export generated.")
        
    print("E2E Test Complete.")

if __name__ == "__main__":
    test_full_flow()
