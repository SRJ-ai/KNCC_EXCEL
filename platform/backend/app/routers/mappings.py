from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from ..dependencies import get_current_user
from ..models.user import User
from ..database import get_db
from ..models.mapping import ItemMapping

router = APIRouter()

class ItemMappingCreate(BaseModel):
    project_id: int
    invoice_description: str
    material_id: int

@router.get("/")
def get_mappings(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mappings = db.query(ItemMapping).filter(ItemMapping.project_id == project_id).all()
    return mappings

@router.post("/")
def create_mapping(mapping: ItemMappingCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if mapping exists
    existing = db.query(ItemMapping).filter(
        ItemMapping.project_id == mapping.project_id,
        ItemMapping.invoice_description == mapping.invoice_description
    ).first()
    
    if existing:
        existing.material_id = mapping.material_id
    else:
        new_map = ItemMapping(
            project_id=mapping.project_id,
            invoice_description=mapping.invoice_description,
            material_id=mapping.material_id
        )
        db.add(new_map)
        
    db.commit()
    return {"message": "Mapping saved successfully"}
