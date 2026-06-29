from fastapi import APIRouter
from .projects import router as projects_router
from .upload import router as upload_router
from .materials import router as materials_router
from .documents import router as documents_router
from .deliveries import router as deliveries_router
from .export import router as export_router
from .activity import router as activity_router
from .vpos import router as vpos_router
from .auth import router as auth_router
from .scan import router as scan_router
api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(upload_router, prefix="/upload", tags=["upload"])
api_router.include_router(materials_router, prefix="/materials", tags=["materials"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(deliveries_router, prefix="/deliveries", tags=["deliveries"])
api_router.include_router(vpos_router, prefix="/vpos", tags=["vpos"])
api_router.include_router(export_router, prefix="/export", tags=["export"])
api_router.include_router(activity_router, prefix="/activity", tags=["activity"])
api_router.include_router(scan_router, prefix="/scan", tags=["scan"])
