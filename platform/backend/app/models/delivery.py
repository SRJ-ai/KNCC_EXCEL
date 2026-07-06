"""
Delivery model — fixed:
  FIX #6: Added qty_multiplier column to store the dimension-scale factor
          (e.g. 12.0 when a 2x6x12 invoice piece maps to a 2x6x1 PO row).
"""
import uuid
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from ..database import Base


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey("materials.id"), index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=True)
    invoice_number = Column(String, default="")
    ship_date = Column(DateTime, nullable=True)
    quantity = Column(Float, default=0)
    qty_multiplier = Column(Float, default=1.0)  # FIX #6: dimension-scale factor
    uom = Column(String, default="")
