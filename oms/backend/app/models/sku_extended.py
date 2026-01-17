"""
SKU Extended Models: Bundles, Variants, Attributes
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

from .base import BaseModel


# ============================================================================
# Bundle Type Enum
# ============================================================================

class BundleType:
    KIT = "KIT"
    COMBO = "COMBO"
    ASSEMBLY = "ASSEMBLY"
    VIRTUAL = "VIRTUAL"


class VariantAttributeType:
    SIZE = "SIZE"
    COLOR = "COLOR"
    MATERIAL = "MATERIAL"
    PATTERN = "PATTERN"
    STYLE = "STYLE"
    CUSTOM = "CUSTOM"


# ============================================================================
# SKU Bundle
# ============================================================================

class SKUBundleBase(SQLModel):
    """SKU Bundle base fields"""
    code: str = Field(unique=True, index=True)
    name: str
    description: Optional[str] = None
    type: str = Field(default="KIT", index=True)  # KIT, COMBO, ASSEMBLY, VIRTUAL
    parentSkuId: UUID = Field(foreign_key="SKU.id", index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    mrp: Optional[Decimal] = None
    sellingPrice: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    isActive: bool = Field(default=True)
    validFrom: Optional[datetime] = None
    validTo: Optional[datetime] = None
    minQty: int = Field(default=1)
    maxQty: Optional[int] = None


class SKUBundle(SKUBundleBase, BaseModel, table=True):
    """SKU Bundle model"""
    __tablename__ = "SKUBundle"

    # Relationships
    items: List["BundleItem"] = Relationship(back_populates="bundle")


class SKUBundleCreate(SQLModel):
    """SKU Bundle creation schema"""
    code: str
    name: str
    description: Optional[str] = None
    type: str = "KIT"
    parentSkuId: UUID
    mrp: Optional[Decimal] = None
    sellingPrice: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    items: Optional[List["BundleItemCreate"]] = None


class SKUBundleUpdate(SQLModel):
    """SKU Bundle update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    mrp: Optional[Decimal] = None
    sellingPrice: Optional[Decimal] = None
    costPrice: Optional[Decimal] = None
    isActive: Optional[bool] = None
    validTo: Optional[datetime] = None


class SKUBundleResponse(SKUBundleBase):
    """SKU Bundle response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    items: Optional[List["BundleItemResponse"]] = None


# ============================================================================
# Bundle Item
# ============================================================================

class BundleItemBase(SQLModel):
    """Bundle Item base fields"""
    bundleId: UUID = Field(foreign_key="SKUBundle.id", index=True)
    componentSkuId: UUID = Field(foreign_key="SKU.id", index=True)
    quantity: int = Field(default=1)
    allowSubstitute: bool = Field(default=False)
    substituteSkus: Optional[List[UUID]] = Field(default=None, sa_column=Column(JSON))
    sequence: int = Field(default=0)


class BundleItem(BundleItemBase, BaseModel, table=True):
    """Bundle Item model"""
    __tablename__ = "BundleItem"

    # Relationships
    bundle: Optional["SKUBundle"] = Relationship(back_populates="items")


class BundleItemCreate(SQLModel):
    """Bundle Item creation schema"""
    componentSkuId: UUID
    quantity: int = 1
    allowSubstitute: bool = False
    substituteSkus: Optional[List[UUID]] = None
    sequence: int = 0


class BundleItemResponse(BundleItemBase):
    """Bundle Item response schema"""
    id: UUID


# ============================================================================
# Variant Attribute
# ============================================================================

class VariantAttributeBase(SQLModel):
    """Variant Attribute base fields"""
    code: str = Field(index=True)
    name: str
    type: str = Field(default="CUSTOM", index=True)  # SIZE, COLOR, MATERIAL, etc.
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    displayOrder: int = Field(default=0)
    isRequired: bool = Field(default=False)
    isFilterable: bool = Field(default=True)
    isVisible: bool = Field(default=True)


class VariantAttribute(VariantAttributeBase, BaseModel, table=True):
    """Variant Attribute model"""
    __tablename__ = "VariantAttribute"

    # Relationships
    values: List["VariantAttributeValue"] = Relationship(back_populates="attribute")


class VariantAttributeCreate(SQLModel):
    """Variant Attribute creation schema"""
    code: str
    name: str
    type: str = "CUSTOM"
    displayOrder: int = 0
    isRequired: bool = False
    isFilterable: bool = True
    isVisible: bool = True


class VariantAttributeUpdate(SQLModel):
    """Variant Attribute update schema"""
    name: Optional[str] = None
    displayOrder: Optional[int] = None
    isRequired: Optional[bool] = None
    isFilterable: Optional[bool] = None
    isVisible: Optional[bool] = None


class VariantAttributeResponse(VariantAttributeBase):
    """Variant Attribute response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
    values: Optional[List["VariantAttributeValueResponse"]] = None


# ============================================================================
# Variant Attribute Value
# ============================================================================

class VariantAttributeValueBase(SQLModel):
    """Variant Attribute Value base fields"""
    attributeId: UUID = Field(foreign_key="VariantAttribute.id", index=True)
    value: str
    displayValue: Optional[str] = None
    colorCode: Optional[str] = None  # For color attributes
    imageUrl: Optional[str] = None
    displayOrder: int = Field(default=0)


class VariantAttributeValue(VariantAttributeValueBase, BaseModel, table=True):
    """Variant Attribute Value model"""
    __tablename__ = "VariantAttributeValue"

    # Relationships
    attribute: Optional["VariantAttribute"] = Relationship(back_populates="values")


class VariantAttributeValueCreate(SQLModel):
    """Variant Attribute Value creation schema"""
    value: str
    displayValue: Optional[str] = None
    colorCode: Optional[str] = None
    imageUrl: Optional[str] = None
    displayOrder: int = 0


class VariantAttributeValueResponse(VariantAttributeValueBase):
    """Variant Attribute Value response schema"""
    id: UUID


# ============================================================================
# SKU Variant
# ============================================================================

class SKUVariantBase(SQLModel):
    """SKU Variant base fields"""
    parentSkuId: UUID = Field(foreign_key="SKU.id", index=True)
    variantSkuId: UUID = Field(foreign_key="SKU.id", index=True)
    variantCode: str = Field(index=True)
    attributes: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    isDefault: bool = Field(default=False)
    displayOrder: int = Field(default=0)


class SKUVariant(SKUVariantBase, BaseModel, table=True):
    """SKU Variant model linking parent SKU to variant SKUs"""
    __tablename__ = "SKUVariant"

    # Relationships
    variantValues: List["SKUVariantValue"] = Relationship(back_populates="variant")


class SKUVariantCreate(SQLModel):
    """SKU Variant creation schema"""
    parentSkuId: UUID
    variantSkuId: UUID
    variantCode: str
    attributes: Optional[dict] = None
    isDefault: bool = False
    displayOrder: int = 0


class SKUVariantResponse(SKUVariantBase):
    """SKU Variant response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# SKU Variant Value
# ============================================================================

class SKUVariantValueBase(SQLModel):
    """SKU Variant Value base fields - links variant to specific attribute values"""
    variantId: UUID = Field(foreign_key="SKUVariant.id", index=True)
    attributeValueId: UUID = Field(foreign_key="VariantAttributeValue.id", index=True)


class SKUVariantValue(SKUVariantValueBase, BaseModel, table=True):
    """SKU Variant Value model"""
    __tablename__ = "SKUVariantValue"

    # Relationships
    variant: Optional["SKUVariant"] = Relationship(back_populates="variantValues")


class SKUVariantValueResponse(SKUVariantValueBase):
    """SKU Variant Value response schema"""
    id: UUID


# ============================================================================
# SKU Brand (mapping table)
# ============================================================================

class SKUBrandBase(SQLModel):
    """SKU Brand mapping base fields"""
    skuId: UUID = Field(foreign_key="SKU.id", index=True)
    brandId: UUID = Field(foreign_key="Brand.id", index=True)
    isPrimary: bool = Field(default=True)


class SKUBrand(SKUBrandBase, BaseModel, table=True):
    """SKU Brand mapping model"""
    __tablename__ = "SKUBrand"


class SKUBrandCreate(SQLModel):
    """SKU Brand creation schema"""
    skuId: UUID
    brandId: UUID
    isPrimary: bool = True


class SKUBrandResponse(SKUBrandBase):
    """SKU Brand response schema"""
    id: UUID
    createdAt: datetime
