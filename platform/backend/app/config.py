"""
KNCC Platform Configuration
Supports local SQLite dev, Vercel serverless, and Render (Postgres).
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLATFORM_DIR = os.path.dirname(BASE_DIR)
PROJECT_ROOT = os.path.dirname(PLATFORM_DIR)

# ── Database ──────────────────────────────────────────────────────────────────
# Render / production sets DATABASE_URL to a Postgres connection string.
# Vercel serverless uses /tmp ephemeral SQLite.
# Local dev falls back to file-based SQLite.
if os.environ.get("DATABASE_URL"):
    DATABASE_URL = os.environ["DATABASE_URL"]
    # psycopg2 requires postgresql:// not postgres://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
elif os.environ.get("VERCEL") == "1":
    DATABASE_URL = "sqlite:////tmp/kncc_platform.db"
else:
    DB_PATH = os.path.join(BASE_DIR, "kncc_platform.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"

# ── File Storage ──────────────────────────────────────────────────────────────
# Render / Vercel both use /tmp for ephemeral file storage.
_default_upload = "/tmp/uploads" if (os.environ.get("VERCEL") == "1" or os.environ.get("RENDER")) else os.path.join(BASE_DIR, "uploads")
_default_export = "/tmp/exports" if (os.environ.get("VERCEL") == "1" or os.environ.get("RENDER")) else os.path.join(BASE_DIR, "exports")

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", _default_upload)
EXPORT_DIR = os.environ.get("EXPORT_DIR", _default_export)

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# ── Legacy Excel Path ─────────────────────────────────────────────────────────
# On Render, the repo is mounted at /opt/render/project/src/
_default_excel = os.path.join(PROJECT_ROOT, "Client", "Client_Requirments_Doc.xlsx")
LEGACY_CLIENT_DIR = os.path.dirname(_default_excel)
LEGACY_EXCEL = os.environ.get("LEGACY_EXCEL", _default_excel)

# ── Auth Configuration ────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("SECRET_KEY", "super_secret_jwt_key_for_development_change_in_prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

# ── Supabase (optional — used by seed endpoint) ───────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
