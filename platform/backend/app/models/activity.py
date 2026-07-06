"""
Activity model — fixed:
  Added project_id FK so logs can be filtered per project.
"""
import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from ..database import Base

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=True)
    action = Column(String)
    detail = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
