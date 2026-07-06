"""Documents router — serve PDF files and parsed data."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os, json

from ..database import get_db
from ..models import Document, Project
from ..schemas.responses import DocumentResponse
from ..config import UPLOAD_DIR
from ..dependencies import get_current_project

router = APIRouter()


@router.get("/{project_id}", response_model=List[DocumentResponse])
def get_documents(project: Project = Depends(get_current_project), db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.project_id == project.id).order_by(Document.created_at.desc()).all()


@router.get("/pdf/{project_id}/{doc_id}")
def get_pdf(doc_id: str, project: Project = Depends(get_current_project), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.project_id == project.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    filepath = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="PDF file not found on disk")
    return FileResponse(filepath, media_type="application/pdf")


@router.get("/parsed/{project_id}/{doc_id}")
def get_parsed(doc_id: str, project: Project = Depends(get_current_project), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id, Document.project_id == project.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        return json.loads(doc.parsed_data_json or "{}")
    except json.JSONDecodeError:
        return {}
