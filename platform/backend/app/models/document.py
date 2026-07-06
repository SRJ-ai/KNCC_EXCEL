"""
Document model — fixed:
  FIX #13: Added doc_number field for duplicate invoice detection.
"""
import uuid
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from ..database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True)

    doc_type = Column(String, index=True)  # PO, INV, CO
    filename = Column(String)
    doc_number = Column(String, index=True, default="")  # FIX #13: for duplicate guard
    parsed_data_json = Column(Text, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def amount(self):
        import json
        try:
            data = json.loads(self.parsed_data_json)
            return float(data.get("total_amount", 0))
        except:
            return 0.0

    @property
    def date(self):
        import json
        try:
            data = json.loads(self.parsed_data_json)
            return data.get("date")
        except:
            return None
