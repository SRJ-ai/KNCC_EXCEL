import uuid
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from ..database import Base

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey("materials.id"), unique=True, index=True)
    
    bundles = Column(Float, nullable=True)
    uom = Column(String, nullable=True)
    pcs_per_bundle = Column(Float, nullable=True)
    inv_pcs = Column(Float, default=0)
    
    issues = Column(Float, default=0)
    variance_code = Column(String, nullable=True)
    reason = Column(String, nullable=True)
