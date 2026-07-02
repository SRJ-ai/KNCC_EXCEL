import os
import requests
import re
import traceback

BASE_URL = "http://localhost:8000/api"
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
    try:
        print("0. Authenticate")
        auth_data = {
            "email": "test@kncc.com",
            "password": "testpassword123",
            "name": "Test User",
            "organization_name": "KNCC"
        }
        res = requests.post(f"{BASE_URL}/auth/register", json=auth_data)
        print(f"Register status: {res.status_code}, response: {res.text[:200]}")
        
        if res.status_code == 400 and "Email already registered" in res.text:
            login_data = {"username": auth_data["email"], "password": auth_data["password"]}
            res = requests.post(f"{BASE_URL}/auth/login", data=login_data)
            print(f"Login status: {res.status_code}, response: {res.text[:200]}")
        
        res.raise_for_status()
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("1. Create Projects")
        res = requests.post(f"{BASE_URL}/projects/", json={"name": "Willow Way Village", "job_number": "60126", "tax_rate": 1.06}, headers=headers)
        print(f"Create Willow status: {res.status_code}, response: {res.text[:200]}")
        res.raise_for_status()
        willow_id = res.json()["id"]
        
        res = requests.post(f"{BASE_URL}/projects/", json={"name": "Cobia Cove Appartments", "job_number": "68981", "tax_rate": 1.06}, headers=headers)
        print(f"Create Cobia status: {res.status_code}, response: {res.text[:200]}")
        res.raise_for_status()
        cobia_id = res.json()["id"]

        print("2. Upload POs")
        for project_id, directory in [(willow_id, WILLOW_DIR), (cobia_id, COBIA_DIR)]:
            pdfs = get_pdfs_from_dir(directory)
            print(f"Dir {directory} has PDFs: {pdfs}")
            for pdf_path in pdfs:
                if "po.pdf" in pdf_path.lower() or "purchase order" in pdf_path.lower():
                    print(f"Uploading {os.path.basename(pdf_path)}...")
                    # We need to simulate uploading via multipart form OR confirm? 
                    # Wait, in the test_e2e.py, it says:
                    # requests.post(f"{BASE_URL}/upload/confirm", data={"filename": ..., "doc_type": "PO", "project_id": project_id})
                    # But is the file already in the upload queue? 
                    # Let's check how the endpoint behaves.
                    res = requests.post(f"{BASE_URL}/upload/confirm", data={
                        "filename": os.path.basename(pdf_path),
                        "doc_type": "PO",
                        "project_id": project_id
                    }, headers=headers)
                    print(f"Confirm PO {os.path.basename(pdf_path)} status: {res.status_code}, response: {res.text[:200]}")
                    
        print("3. Upload Invoices & COs")
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
                    print(f"Confirm {filename} status: {res.status_code}, response: {res.text[:200]}")
                    
        print("4. Generate Export")
        res = requests.post(f"{BASE_URL}/export/{willow_id}", headers=headers)
        print(f"Export Willow status: {res.status_code}")
        res = requests.post(f"{BASE_URL}/export/{cobia_id}", headers=headers)
        print(f"Export Cobia status: {res.status_code}")
            
        print("E2E Test Complete.")
    except Exception as e:
        print("ERROR occurred:")
        traceback.print_exc()

if __name__ == "__main__":
    test_full_flow()
