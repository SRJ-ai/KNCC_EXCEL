"""
Projects router — extended with import-excel endpoint.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os, shutil

from ..database import get_db
from ..models import Project, User
from ..schemas.responses import ProjectCreate, ProjectResponse
from ..services.excel_importer import import_excel_data
from ..config import UPLOAD_DIR, LEGACY_EXCEL
from ..dependencies import get_current_user

router = APIRouter()


@router.get("/", response_model=List[ProjectResponse])
def get_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.organization_id == current_user.organization_id).all()


@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_project = Project(
        name=project.name,
        job_number=project.job_number,
        tax_rate=project.tax_rate,
        organization_id=current_user.organization_id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.delete("/{project_id}")
def delete_project(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
        
    from ..models import Material, Delivery, COAdjustment, Inventory, ItemMapping, Activity, Document
    
    # Delete child data via material IDs
    materials = db.query(Material).filter(Material.project_id == project_id).all()
    mat_ids = [m.id for m in materials]
    if mat_ids:
        db.query(Delivery).filter(Delivery.material_id.in_(mat_ids)).delete(synchronize_session=False)
        db.query(COAdjustment).filter(COAdjustment.material_id.in_(mat_ids)).delete(synchronize_session=False)
        db.query(Inventory).filter(Inventory.material_id.in_(mat_ids)).delete(synchronize_session=False)
        db.query(ItemMapping).filter(ItemMapping.material_id.in_(mat_ids)).delete(synchronize_session=False)
        
    db.query(ItemMapping).filter(ItemMapping.project_id == project_id).delete(synchronize_session=False)
    db.query(Activity).filter(Activity.project_id == project_id).delete(synchronize_session=False)
    db.query(Material).filter(Material.project_id == project_id).delete(synchronize_session=False)
    db.query(Document).filter(Document.project_id == project_id).delete(synchronize_session=False)
    
    db.delete(p)
    db.commit()
    return {"message": "Project deleted"}


@router.post("/{project_id}/import-excel")
async def import_excel(
    project_id: str,
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Import an Excel file into the project.
    If no file is uploaded, falls back to the legacy Client_Requirments_Doc.xlsx.
    """
    p = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if file:
        # Save uploaded Excel to temp path
        safe_name = os.path.basename(file.filename)
        excel_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(excel_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    else:
        excel_path = LEGACY_EXCEL

    if not os.path.exists(excel_path):
        raise HTTPException(
            status_code=404,
            detail=f"Excel file not found at {excel_path}. Upload it or place it at {LEGACY_EXCEL}",
        )

    result = import_excel_data(db, p, excel_path)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "message": f"Import complete for {p.name}",
        "imported": result,
    }
