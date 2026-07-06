from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Material, Inventory, Delivery, Project
from pydantic import BaseModel
from typing import Optional
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter()


class MaterialUpdate(BaseModel):
    issues: Optional[float] = None
    variance_code: Optional[str] = None
    reason: Optional[str] = None
    inv_pcs: Optional[float] = None


def _enrich(mat: Material, project: Project, deliveries: list, inv: Inventory) -> dict:
    """Compute derived fields that are formulas in Excel."""
    qty = mat.po_co_qty or mat.qty or 0
    thickness = mat.thickness or 0
    width = mat.width or 0
    length = mat.length or 0
    cost_mbf = mat.cost_mbf or 0
    tax_rate = float(project.tax_rate) if project.tax_rate else 1.06

    # Excel formulas replicated
    lf_pcs   = qty * length if length else (mat.lf_pcs or 0)
    bf_sf    = (qty * thickness * width * length / 12) if (thickness and width and length) else (mat.bf_sf or 0)
    total_cost = (bf_sf * cost_mbf / 1000) if bf_sf and cost_mbf else (mat.total_cost or 0)
    total_tax  = total_cost * tax_rate if total_cost else (mat.total_cost_tax or 0)

    # Delivery totals
    total_delivered = sum((d.quantity or 0) * (d.qty_multiplier or 1.0) for d in deliveries)
    delivered_lf    = total_delivered * length if length else 0
    delivered_bf    = (total_delivered * thickness * width * length / 12) if (thickness and width and length) else 0
    delivered_cost  = (delivered_bf * cost_mbf / 1000) if delivered_bf and cost_mbf else 0
    pct_delivery    = round(total_delivered / qty * 100, 1) if qty > 0 else 0

    # Inventory
    inv_pcs       = inv.inv_pcs if inv else 0
    issues        = inv.issues if inv else 0
    issues_lf     = issues * length if length else 0
    issues_bf     = (issues * thickness * width * length / 12) if (thickness and width and length) else 0
    pct_issued    = round(issues / qty * 100, 1) if qty > 0 else 0
    issues_cost   = (issues_bf * cost_mbf / 1000) if issues_bf and cost_mbf else 0
    issues_tax    = issues_cost * tax_rate

    return {
        "id":              mat.id,
        "project_id":      mat.project_id,
        "type":            mat.type or "",
        "material_type":   mat.material_type or "",
        "qty":             mat.qty or 0,
        "co_qty":          mat.co_qty or 0,
        "po_co_qty":       qty,
        "thickness":       thickness,
        "width":           width,
        "length":          length,
        "cost_mbf":        cost_mbf,
        "lf_pcs":          round(lf_pcs, 2),
        "bf_sf":           round(bf_sf, 2),
        "total_cost":      round(total_cost, 2),
        "total_cost_tax":  round(total_tax, 2),
        "invoice_refs":    mat.invoice_refs or "",
        # Delivery totals
        "total_delivered":      round(total_delivered, 2),
        "delivered_lf":         round(delivered_lf, 2),
        "delivered_bf_sf":      round(delivered_bf, 2),
        "delivered_cost":       round(delivered_cost, 2),
        "delivered_cost_tax":   round(delivered_cost * tax_rate, 2),
        "pct_delivery":         pct_delivery,
        # Inventory
        "inv_bundles":    inv.bundles if inv else None,
        "inv_uom":        inv.uom if inv else "",
        "pcs_per_bundle": inv.pcs_per_bundle if inv else None,
        "inv_pcs":        inv_pcs,
        "issues":         issues,
        "issues_lf":      round(issues_lf, 2),
        "issues_bf_sf":   round(issues_bf, 2),
        "pct_issued":     pct_issued,
        "issues_cost":    round(issues_cost, 2),
        "issues_cost_tax":round(issues_tax, 2),
        "variance_code":  inv.variance_code if inv else "",
        "reason":         inv.reason if inv else "",
    }


@router.get("/{project_id}")
def get_materials(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    materials = db.query(Material).filter(Material.project_id == project_id).all()
    result = []
    for mat in materials:
        deliveries = db.query(Delivery).filter(Delivery.material_id == mat.id).all()
        inv = db.query(Inventory).filter(Inventory.material_id == mat.id).first()
        result.append(_enrich(mat, project, deliveries, inv))
    return result


@router.get("/{project_id}/summary")
def get_summary(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """KPI summary for dashboard cards."""
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    materials = db.query(Material).filter(Material.project_id == project_id).all()
    tax_rate = float(project.tax_rate) if project.tax_rate else 1.06

    total_cost = 0
    total_cost_tax = 0
    total_ordered = 0
    total_delivered = 0

    for mat in materials:
        qty = mat.po_co_qty or mat.qty or 0
        thickness = mat.thickness or 0
        width = mat.width or 0
        length = mat.length or 0
        cost_mbf = mat.cost_mbf or 0
        bf_sf = (qty * thickness * width * length / 12) if (thickness and width and length) else (mat.bf_sf or 0)
        tc = (bf_sf * cost_mbf / 1000) if bf_sf and cost_mbf else (mat.total_cost or 0)
        total_cost += tc
        total_cost_tax += tc * tax_rate
        total_ordered += qty

        deliveries = db.query(Delivery).filter(Delivery.material_id == mat.id).all()
        total_delivered += sum((d.quantity or 0) * (d.qty_multiplier or 1.0) for d in deliveries)

    pct_delivery = round(total_delivered / total_ordered * 100, 1) if total_ordered > 0 else 0

    return {
        "material_count":    len(materials),
        "total_cost":        round(total_cost, 2),
        "total_cost_tax":    round(total_cost_tax, 2),
        "total_ordered":     round(total_ordered),
        "total_delivered":   round(total_delivered),
        "pct_delivery":      pct_delivery,
    }


@router.patch("/{project_id}/{material_id}")
def update_material(project_id: str, material_id: str, updates: MaterialUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == current_user.organization_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    mat = db.query(Material).filter(Material.id == material_id, Material.project_id == project_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")

    inv = db.query(Inventory).filter(Inventory.material_id == material_id).first()
    if not inv:
        inv = Inventory(material_id=material_id)
        db.add(inv)

    if updates.issues is not None:        inv.issues = updates.issues
    if updates.variance_code is not None: inv.variance_code = updates.variance_code
    if updates.reason is not None:        inv.reason = updates.reason
    if updates.inv_pcs is not None:       inv.inv_pcs = updates.inv_pcs

    db.commit()
    return {"message": "Material updated"}
