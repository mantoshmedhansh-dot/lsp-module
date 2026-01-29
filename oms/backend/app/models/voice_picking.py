"""
Voice Picking Models: Voice profiles, Commands, Sessions, Interactions
For voice-directed warehouse operations
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON, Text

from .base import BaseModel


# ============================================================================
# Enums
# ============================================================================

class VoiceLanguage(str, Enum):
    """Supported voice languages"""
    EN_US = "EN_US"
    EN_IN = "EN_IN"
    HI_IN = "HI_IN"
    TA_IN = "TA_IN"
    TE_IN = "TE_IN"
    KN_IN = "KN_IN"
    MR_IN = "MR_IN"
    BN_IN = "BN_IN"


class VoiceCommandType(str, Enum):
    """Voice command types"""
    CONFIRM = "CONFIRM"
    QUANTITY = "QUANTITY"
    LOCATION = "LOCATION"
    SKU = "SKU"
    REPEAT = "REPEAT"
    SKIP = "SKIP"
    SHORT = "SHORT"
    DAMAGE = "DAMAGE"
    HELP = "HELP"
    CANCEL = "CANCEL"
    NEXT = "NEXT"
    PREVIOUS = "PREVIOUS"


class VoiceSessionStatus(str, Enum):
    """Voice session status"""
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# ============================================================================
# VoiceProfile
# ============================================================================

class VoiceProfileBase(SQLModel):
    """Voice profile base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    userId: UUID = Field(foreign_key="User.id", unique=True, index=True)
    language: VoiceLanguage = Field(default=VoiceLanguage.EN_US)
    speechRate: int = Field(default=100)  # percent
    volume: int = Field(default=80)  # percent
    confirmationMode: str = Field(default="digit", max_length=20)  # digit, word, none
    repeatCount: int = Field(default=2)
    timeoutSeconds: int = Field(default=10)
    isTrainingComplete: bool = Field(default=False)
    trainingCompletedAt: Optional[datetime] = None
    voiceModelData: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    customVocabulary: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    preferences: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class VoiceProfile(VoiceProfileBase, BaseModel, table=True):
    """Voice profile model"""
    __tablename__ = "VoiceProfile"


class VoiceProfileCreate(SQLModel):
    """Schema for profile creation"""
    userId: UUID
    language: VoiceLanguage = VoiceLanguage.EN_US
    speechRate: int = 100
    volume: int = 80
    confirmationMode: str = "digit"


class VoiceProfileUpdate(SQLModel):
    """Schema for profile update"""
    language: Optional[VoiceLanguage] = None
    speechRate: Optional[int] = None
    volume: Optional[int] = None
    confirmationMode: Optional[str] = None
    repeatCount: Optional[int] = None
    timeoutSeconds: Optional[int] = None
    customVocabulary: Optional[dict] = None
    preferences: Optional[dict] = None


class VoiceProfileResponse(VoiceProfileBase):
    """Response schema for profile"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# VoiceCommand
# ============================================================================

class VoiceCommandBase(SQLModel):
    """Voice command definition base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    commandType: VoiceCommandType = Field(index=True)
    language: VoiceLanguage = Field(index=True)
    spokenPhrases: List[str] = Field(default=[], sa_column=Column(JSON))
    responseTemplate: str = Field(sa_column=Column(Text))
    confirmationRequired: bool = Field(default=False)
    parameters: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    isActive: bool = Field(default=True)


class VoiceCommand(VoiceCommandBase, BaseModel, table=True):
    """Voice command model"""
    __tablename__ = "VoiceCommand"


class VoiceCommandCreate(SQLModel):
    """Schema for command creation"""
    commandType: VoiceCommandType
    language: VoiceLanguage
    spokenPhrases: List[str]
    responseTemplate: str
    confirmationRequired: bool = False
    parameters: Optional[dict] = None


class VoiceCommandResponse(VoiceCommandBase):
    """Response schema for command"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# VoiceSession
# ============================================================================

class VoiceSessionBase(SQLModel):
    """Voice picking session base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    userId: UUID = Field(foreign_key="User.id", index=True)
    deviceId: UUID = Field(foreign_key="MobileDevice.id", index=True)
    locationId: UUID = Field(foreign_key="Location.id", index=True)
    sessionToken: str = Field(max_length=500, unique=True, index=True)
    status: VoiceSessionStatus = Field(default=VoiceSessionStatus.ACTIVE, index=True)
    taskId: Optional[UUID] = Field(default=None, foreign_key="MobileTask.id")
    picklistId: Optional[UUID] = Field(default=None, foreign_key="Picklist.id")
    language: VoiceLanguage = Field(default=VoiceLanguage.EN_US)
    startedAt: datetime = Field(default_factory=datetime.utcnow)
    endedAt: Optional[datetime] = None
    totalCommands: int = Field(default=0)
    successfulCommands: int = Field(default=0)
    errorCommands: int = Field(default=0)
    totalPicks: int = Field(default=0)
    completedPicks: int = Field(default=0)
    avgResponseTime: Optional[Decimal] = None
    sessionData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class VoiceSession(VoiceSessionBase, BaseModel, table=True):
    """Voice session model"""
    __tablename__ = "VoiceSession"


class VoiceSessionCreate(SQLModel):
    """Schema for session creation"""
    deviceId: UUID
    locationId: UUID
    taskId: Optional[UUID] = None
    picklistId: Optional[UUID] = None
    language: VoiceLanguage = VoiceLanguage.EN_US


class VoiceSessionResponse(VoiceSessionBase):
    """Response schema for session"""
    id: UUID
    createdAt: datetime
    updatedAt: datetime


# ============================================================================
# VoiceInteraction
# ============================================================================

class VoiceInteractionBase(SQLModel):
    """Voice interaction log base fields"""
    companyId: UUID = Field(foreign_key="Company.id", index=True)
    sessionId: UUID = Field(foreign_key="VoiceSession.id", index=True)
    sequenceNo: int
    commandType: Optional[VoiceCommandType] = None
    spokenInput: Optional[str] = Field(default=None, sa_column=Column(Text))
    recognizedText: Optional[str] = Field(default=None, sa_column=Column(Text))
    confidence: Optional[Decimal] = None
    systemResponse: Optional[str] = Field(default=None, sa_column=Column(Text))
    isSuccessful: bool = Field(default=True)
    errorType: Optional[str] = Field(default=None, max_length=50)
    responseTimeMs: Optional[int] = None
    context: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)


class VoiceInteraction(VoiceInteractionBase, BaseModel, table=True):
    """Voice interaction model"""
    __tablename__ = "VoiceInteraction"


class VoiceInteractionResponse(VoiceInteractionBase):
    """Response schema for interaction"""
    id: UUID
    createdAt: datetime


# ============================================================================
# Request/Response Schemas
# ============================================================================

class VoiceCommandRequest(SQLModel):
    """Request for voice command processing"""
    sessionId: UUID
    audioData: Optional[str] = None  # base64 encoded
    text: Optional[str] = None
    context: Optional[dict] = None


class VoiceCommandProcessResponse(SQLModel):
    """Response for voice command processing"""
    commandType: Optional[VoiceCommandType]
    recognizedText: Optional[str]
    confidence: Optional[Decimal]
    response: str
    audioResponse: Optional[str] = None  # base64 encoded
    nextAction: Optional[str] = None
    context: Optional[dict] = None


class VoiceInstructionResponse(SQLModel):
    """Response for next pick instruction"""
    instruction: str
    audioInstruction: Optional[str] = None  # base64 encoded
    location: str
    sku: str
    skuName: Optional[str]
    quantity: int
    checkDigit: Optional[str]
    confirmationRequired: bool
    context: Optional[dict] = None
