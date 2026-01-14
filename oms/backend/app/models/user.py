from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    OPERATOR = "OPERATOR"
    PICKER = "PICKER"
    PACKER = "PACKER"
    VIEWER = "VIEWER"
    CLIENT = "CLIENT"


class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String)
    avatar = Column(String)
    # Use the exact enum type name that Prisma created in PostgreSQL
    role = Column(Enum(UserRole, name="UserRole", create_type=False), default=UserRole.OPERATOR)
    isActive = Column(Boolean, default=True)
    lastLoginAt = Column(DateTime)

    companyId = Column(String, ForeignKey("Company.id", ondelete="SET NULL"), index=True)
    locationAccess = Column(ARRAY(String), default=[])

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="users")
