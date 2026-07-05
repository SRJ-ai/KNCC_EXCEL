"""
KNCC Platform — Backend API (FastAPI)
Fixes applied:
   - UPLOAD_DIR and EXPORT_DIR created on startup from config
   - CORS enabled for Electron/Vite dev server
   - Added JSON request body sanitization middleware
"""
import json
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db, SessionLocal
from .routers import api_router
from .config import UPLOAD_DIR, EXPORT_DIR
from .core.validation import _sanitize_text

# Ensure required directories exist at startup
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

app = FastAPI(title="KNCC Platform API", version="1.0.0")


@app.get("/api/reset-db")
def reset_db():
    from .database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"status": "reset complete"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite dev server
        "http://localhost:3000",    # Alt dev server
        "https://kncc-excel.vercel.app",  # Production frontend
        "https://iventree.duckdns.org",   # Custom Vercel Domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


def _sanitize_json(data):
    """Recursively sanitize strings in JSON data using _sanitize_text."""
    if isinstance(data, dict):
        return {key: _sanitize_json(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [_sanitize_json(item) for item in data]
    elif isinstance(data, str):
        return _sanitize_text(data)
    else:
        return data


@app.middleware("http")
async def sanitize_json_middleware(request: Request, call_next):
    if request.headers.get("content-type") == "application/json":
        try:
            body = await request.body()
            if body:
                data = json.loads(body)
                sanitized_data = _sanitize_json(data)
                request._body = json.dumps(sanitized_data).encode("utf-8")
        except (json.JSONDecodeError, UnicodeDecodeError):
            # If body is not valid JSON, pass through unchanged
            pass
    response = await call_next(request)
    return response


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
