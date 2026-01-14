from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Numeric, ARRAY, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


class SKU(Base):
    __tablename__ = "SKU"

    id = Column(String, primary_key=True)
    code = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String)
    category = Column(String)
    subCategory = Column(String)
    brand = Column(String)
    hsn = Column(String)
    weight = Column(Numeric(10, 3))
    length = Column(Numeric(10, 2))
    width = Column(Numeric(10, 2))
    height = Column(Numeric(10, 2))
    mrp = Column(Numeric(12, 2))
    costPrice = Column(Numeric(12, 2))
    sellingPrice = Column(Numeric(12, 2))
    taxRate = Column(Numeric(5, 2))
    isSerialised = Column(Boolean, default=False)
    isBatchTracked = Column(Boolean, default=False)
    reorderLevel = Column(Integer)
    reorderQty = Column(Integer)
    barcodes = Column(ARRAY(String), default=[])
    images = Column(ARRAY(String), default=[])
    attributes = Column(JSON)
    isActive = Column(Boolean, default=True)

    companyId = Column(String, ForeignKey("Company.id", ondelete="CASCADE"), index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    company = relationship("Company", back_populates="skus")
    inventory = relationship("Inventory", back_populates="sku")
    orderItems = relationship("OrderItem", back_populates="sku")


class Inventory(Base):
    __tablename__ = "Inventory"

    id = Column(String, primary_key=True)
    quantity = Column(Integer, default=0)
    reservedQty = Column(Integer, default=0)
    batchNo = Column(String)
    lotNo = Column(String)
    expiryDate = Column(DateTime)
    mfgDate = Column(DateTime)
    mrp = Column(Numeric(12, 2))
    serialNumbers = Column(ARRAY(String), default=[])
    costPrice = Column(Numeric(12, 2))

    skuId = Column(String, ForeignKey("SKU.id", ondelete="CASCADE"), index=True)
    binId = Column(String, ForeignKey("Bin.id", ondelete="CASCADE"), index=True)
    locationId = Column(String, ForeignKey("Location.id", ondelete="CASCADE"), index=True)

    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sku = relationship("SKU", back_populates="inventory")
    bin = relationship("Bin", back_populates="inventory")
    location = relationship("Location", back_populates="inventory")
