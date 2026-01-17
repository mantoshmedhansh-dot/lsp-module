"""
Communication Models: Templates, Proactive Communication
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON

from .base import BaseModel
from .enums import CommunicationTrigger, OutreachChannel, OutreachStatus


# ============================================================================
# Communication Template
# ============================================================================

class CommunicationTemplateBase(SQLModel):
    """Communication Template base fields"""
    name: str
    description: Optional[str] = None
    trigger: CommunicationTrigger = Field(index=True)
    channel: OutreachChannel = Field(index=True)
    language: str = Field(default="en")
    subject: Optional[str] = None
    template: str
    variables: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    whatsappTemplateId: Optional[str] = None
    whatsappTemplateName: Optional[str] = None
    sentiment: Optional[str] = None
    isActive: bool = Field(default=True)
    isDefault: bool = Field(default=False)
    companyId: UUID = Field(foreign_key="Company.id", index=True)


class CommunicationTemplate(CommunicationTemplateBase, BaseModel, table=True):
    """Communication Template model"""
    __tablename__ = "CommunicationTemplate"


class CommunicationTemplateCreate(SQLModel):
    """Communication Template creation schema"""
    name: str
    description: Optional[str] = None
    trigger: CommunicationTrigger
    channel: OutreachChannel
    language: str = "en"
    subject: Optional[str] = None
    template: str
    variables: Optional[List[str]] = None
    whatsappTemplateId: Optional[str] = None
    whatsappTemplateName: Optional[str] = None
    sentiment: Optional[str] = None
    isDefault: bool = False


class CommunicationTemplateUpdate(SQLModel):
    """Communication Template update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    template: Optional[str] = None
    variables: Optional[List[str]] = None
    whatsappTemplateId: Optional[str] = None
    whatsappTemplateName: Optional[str] = None
    sentiment: Optional[str] = None
    isActive: Optional[bool] = None
    isDefault: Optional[bool] = None


class CommunicationTemplateResponse(CommunicationTemplateBase):
    """Communication Template response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# Proactive Communication
# ============================================================================

class ProactiveCommunicationBase(SQLModel):
    """Proactive Communication base fields"""
    communicationNo: str = Field(unique=True, index=True)
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    orderId: Optional[UUID] = Field(default=None, foreign_key="Order.id", index=True)
    deliveryId: Optional[UUID] = Field(default=None, foreign_key="Delivery.id")
    customerId: Optional[UUID] = Field(default=None, foreign_key="Customer.id")
    trigger: CommunicationTrigger = Field(index=True)
    channel: OutreachChannel = Field(index=True)
    templateId: Optional[UUID] = Field(default=None, foreign_key="CommunicationTemplate.id")
    status: OutreachStatus = Field(default=OutreachStatus.PENDING, index=True)
    recipient: str
    subject: Optional[str] = None
    content: str
    scheduledAt: Optional[datetime] = None
    sentAt: Optional[datetime] = None
    deliveredAt: Optional[datetime] = None
    readAt: Optional[datetime] = None
    respondedAt: Optional[datetime] = None
    response: Optional[str] = None
    sentiment: Optional[str] = None
    sentimentScore: Optional[float] = None
    providerMessageId: Optional[str] = None
    providerStatus: Optional[str] = None
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    retryCount: int = Field(default=0)
    extraData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class ProactiveCommunication(ProactiveCommunicationBase, BaseModel, table=True):
    """Proactive Communication model"""
    __tablename__ = "ProactiveCommunication"


class ProactiveCommunicationCreate(SQLModel):
    """Proactive Communication creation schema"""
    orderId: Optional[UUID] = None
    deliveryId: Optional[UUID] = None
    customerId: Optional[UUID] = None
    trigger: CommunicationTrigger
    channel: OutreachChannel
    templateId: Optional[UUID] = None
    recipient: str
    subject: Optional[str] = None
    content: str
    scheduledAt: Optional[datetime] = None


class ProactiveCommunicationUpdate(SQLModel):
    """Proactive Communication update schema"""
    status: Optional[OutreachStatus] = None
    response: Optional[str] = None
    sentiment: Optional[str] = None
    sentimentScore: Optional[float] = None


class ProactiveCommunicationResponse(ProactiveCommunicationBase):
    """Proactive Communication response schema"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime
