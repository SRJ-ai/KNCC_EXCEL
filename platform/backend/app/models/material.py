import uuid
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from ..database import Base

class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    
    type = Column(String)  # Lumber, LVL, Panels, Each
    qty = Column(Float, default=0)
    co_qty = Column(Float, default=0)
    po_co_qty = Column(Float, default=0)
    
    thickness = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    length = Column(Float, nullable=True)
    material_type = Column(String)
    
    lf_pcs = Column(Float, default=0)
    bf_sf = Column(Float, default=0)
    cost_mbf = Column(Float, default=0)
    total_cost = Column(Float, default=0)
    total_cost_tax = Column(Float, default=0)
    
    invoice_refs = Column(String, default="")  # Newline-separated invoice numbers

class COAdjustment(Base):
    __tablename__ = "co_adjustments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey("materials.id"), index=True)
    co_number = Column(String)
    co_date = Column(String)
    qty_change = Column(Float)
    description = Column(String)
