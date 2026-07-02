"""
KNCC Platform — Backend API (FastAPI)
Fixes applied:
  - UPLOAD_DIR and EXPORT_DIR created on startup from config
  - CORS enabled for Electron/Vite dev server
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db, SessionLocal
from .routers import api_router
from .config import UPLOAD_DIR, EXPORT_DIR

# Ensure required directories exist at startup
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

app = FastAPI(title="KNCC Platform API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite dev server
        "http://localhost:3000",    # Alt dev server
        "https://kncc-excel.vercel.app",  # Production frontend
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    # NOTE: Demo account seeding has been removed.
    # Accounts are now created through the proper /api/auth/register endpoint
    # or directly in Supabase Auth dashboard.
    
    # Automatically inject test accounts to Supabase (R4)
    try:
        try:
            from inject_test_accounts import inject_accounts
        except ImportError:
            import sys
            import os
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)
            from inject_test_accounts import inject_accounts
        inject_accounts()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to run Supabase test account injection on startup: {e}")


app.include_router(api_router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}
