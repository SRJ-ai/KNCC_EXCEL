from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class ItemMapping(Base):
    __tablename__ = "item_mappings"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    invoice_description = Column(String, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"))

    project = relationship("Project")
    material = relationship("Material")
