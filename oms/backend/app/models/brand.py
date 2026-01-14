from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


class Brand(Base):
    __tablename__ = "Brand"

    id = Column(String, primary_key=True)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    logo = Column(String)
    description = Column(String)
    contactPerson = Column(String)
    contactEmail = Column(String)
    contactPhone = Column(String)
    website = Column(String)
    address = Column(JSON)
    settings = Column(JSON)
    isActive = Column(Boolean, default=True)

    companyId = Column(String, ForeignKey("Company.id", ondelete="CASCADE"), index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="brands")
