import uuid
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from ..database import Base

class VPO(Base):
    __tablename__ = "vpos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)
    
    vpo_date = Column(DateTime(timezone=True), nullable=True)
    qty = Column(Float, default=0)
    uom = Column(String, nullable=True)
    description = Column(String, nullable=True)
    footage = Column(Float, default=0)
    price = Column(Float, default=0)
    amount = Column(Float, default=0)
    tax = Column(Float, default=0)
    total = Column(Float, default=0)
    co_ref = Column(String, nullable=True)
    co_number = Column(String, nullable=True)
    remarks = Column(String, nullable=True)
