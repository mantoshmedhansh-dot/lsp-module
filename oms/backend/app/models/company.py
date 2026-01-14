from sqlalchemy import Column, String, Boolean, DateTime, JSON, Enum, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class LocationType(str, enum.Enum):
    WAREHOUSE = "WAREHOUSE"
    STORE = "STORE"
    HUB = "HUB"
    VIRTUAL = "VIRTUAL"


class ZoneType(str, enum.Enum):
    SALEABLE = "SALEABLE"
    DAMAGED = "DAMAGED"
    QC = "QC"
    RETURNS = "RETURNS"
    DISPATCH = "DISPATCH"


class Company(Base):
    __tablename__ = "Company"

    id = Column(String, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    legalName = Column(String)
    gst = Column(String)
    pan = Column(String)
    cin = Column(String)
    logo = Column(String)
    email = Column(String)
    phone = Column(String)
    address = Column(JSON)
    settings = Column(JSON)
    isActive = Column(Boolean, default=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="company")
    locations = relationship("Location", back_populates="company")
    skus = relationship("SKU", back_populates="company")
    brands = relationship("Brand", back_populates="company")


class Location(Base):
    __tablename__ = "Location"

    id = Column(String, primary_key=True)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    type = Column(Enum(LocationType, name="LocationType", create_type=False))
    address = Column(JSON)
    contactPerson = Column(String)
    contactPhone = Column(String)
    contactEmail = Column(String)
    gst = Column(String)
    isActive = Column(Boolean, default=True)
    settings = Column(JSON)

    companyId = Column(String, ForeignKey("Company.id", ondelete="CASCADE"), index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="locations")
    zones = relationship("Zone", back_populates="location")
    orders = relationship("Order", back_populates="location")
    inventory = relationship("Inventory", back_populates="location")


class Zone(Base):
    __tablename__ = "Zone"

    id = Column(String, primary_key=True)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    type = Column(Enum(ZoneType, name="ZoneType", create_type=False))
    description = Column(String)
    isActive = Column(Boolean, default=True)

    locationId = Column(String, ForeignKey("Location.id", ondelete="CASCADE"), index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    location = relationship("Location", back_populates="zones")
    bins = relationship("Bin", back_populates="zone")


class Bin(Base):
    __tablename__ = "Bin"

    id = Column(String, primary_key=True)
    code = Column(String, nullable=False)
    name = Column(String)
    description = Column(String)
    capacity = Column(Integer)
    isActive = Column(Boolean, default=True)

    zoneId = Column(String, ForeignKey("Zone.id", ondelete="CASCADE"), index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    zone = relationship("Zone", back_populates="bins")
    inventory = relationship("Inventory", back_populates="bin")
