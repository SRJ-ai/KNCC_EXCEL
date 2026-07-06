from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime


class ProjectBase(BaseModel):
    name: str
    job_number: str
    tax_rate: Optional[float] = 1.06


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MaterialResponse(BaseModel):
    id: int
    project_id: int
    type: Optional[str] = None
    qty: float = 0
    co_qty: float = 0
    po_co_qty: float = 0
    thickness: Optional[float] = None
    width: Optional[float] = None
    length: Optional[float] = None
    material_type: Optional[str] = None
    lf_pcs: float = 0
    bf_sf: float = 0
    cost_mbf: float = 0
    total_cost: float = 0
    total_cost_tax: float = 0
    invoice_refs: Optional[str] = None
    
    total_delivered: float = 0
    delivered_lf: float = 0
    delivered_bf_sf: float = 0
    delivered_cost: float = 0
    delivered_cost_tax: float = 0
    pct_delivery: float = 0
    
    inv_bundles: Optional[float] = None
    inv_uom: Optional[str] = None
    pcs_per_bundle: Optional[float] = None
    inv_pcs: float = 0
    issues: float = 0
    issues_lf: float = 0
    issues_bf_sf: float = 0
    pct_issued: float = 0
    issues_cost: float = 0

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: int
    project_id: int
    doc_type: str
    filename: str
    doc_number: Optional[str] = None
    created_at: Optional[datetime] = None
    amount: float = 0
    date: Optional[str] = None

    class Config:
        from_attributes = True


class ActivityResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    action: str
    detail: Optional[str] = ""     # Fixed: model uses 'detail' not 'description'
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
