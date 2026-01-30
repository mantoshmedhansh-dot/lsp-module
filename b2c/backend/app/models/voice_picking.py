"""
Voice Picking Models for Warehouse Operations
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .base import BaseModel


class VoiceSessionStatus(str, Enum):
    """Voice session status"""
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    TERMINATED = "TERMINATED"


class VoiceCommandType(str, Enum):
    """Types of voice commands"""
    CONFIRM = "CONFIRM"
    SKIP = "SKIP"
    SHORT = "SHORT"
    DAMAGE = "DAMAGE"
    HELP = "HELP"
    REPEAT = "REPEAT"
    NEXT = "NEXT"
    BACK = "BACK"
    LOGOUT = "LOGOUT"
    QUANTITY = "QUANTITY"
    LOCATION = "LOCATION"
    CHECK_DIGIT = "CHECK_DIGIT"


class VoiceLanguage(str, Enum):
    """Supported voice languages"""
    ENGLISH = "en"
    HINDI = "hi"
    TAMIL = "ta"
    TELUGU = "te"
    KANNADA = "kn"
    MARATHI = "mr"


# Database Models
class VoiceProfile(BaseModel, table=True):
    """User voice settings"""
    __tablename__ = "voice_profiles"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, unique=True, index=True)
    )
    language: VoiceLanguage = Field(default=VoiceLanguage.ENGLISH)
    speechRate: float = Field(default=1.0)  # 0.5 to 2.0
    volume: float = Field(default=1.0)  # 0.0 to 1.0
    pitchOffset: float = Field(default=0.0)  # -1.0 to 1.0
    confirmationRequired: bool = Field(default=True)
    checkDigitLength: int = Field(default=2)
    feedbackEnabled: bool = Field(default=True)
    trainingCompleted: bool = Field(default=False)
    trainingCompletedAt: Optional[datetime] = Field(default=None)
    customVocabulary: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    preferences: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class VoiceCommand(BaseModel, table=True):
    """Command definitions"""
    __tablename__ = "voice_commands"

    commandType: VoiceCommandType = Field(index=True)
    language: VoiceLanguage = Field(index=True)
    phrase: str = Field(max_length=100)
    aliases: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    responseTemplate: str = Field(max_length=500)
    requiresConfirmation: bool = Field(default=False)
    requiresParameter: bool = Field(default=False)
    parameterType: Optional[str] = Field(default=None, max_length=20)
    isActive: bool = Field(default=True)
    description: Optional[str] = Field(default=None, max_length=255)


class VoiceSession(BaseModel, table=True):
    """Active voice sessions"""
    __tablename__ = "voice_sessions"

    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    deviceId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    warehouseId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    taskId: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True, index=True)
    )
    status: VoiceSessionStatus = Field(default=VoiceSessionStatus.ACTIVE)
    language: VoiceLanguage = Field(default=VoiceLanguage.ENGLISH)
    startedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    endedAt: Optional[datetime] = Field(default=None)
    lastActivityAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    currentLineNumber: int = Field(default=0)
    completedLines: int = Field(default=0)
    totalLines: int = Field(default=0)
    pickedUnits: int = Field(default=0)
    skippedLines: int = Field(default=0)
    shortedLines: int = Field(default=0)
    errorCount: int = Field(default=0)
    sessionData: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class VoiceInteraction(BaseModel, table=True):
    """Log of voice interactions for analytics"""
    __tablename__ = "voice_interactions"

    sessionId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    userId: UUID = Field(
        sa_column=Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    )
    commandType: Optional[VoiceCommandType] = Field(default=None)
    spokenText: Optional[str] = Field(default=None, max_length=500)
    recognizedText: Optional[str] = Field(default=None, max_length=500)
    confidence: Optional[float] = Field(default=None)
    responseText: str = Field(max_length=500)
    wasSuccessful: bool = Field(default=True)
    errorReason: Optional[str] = Field(default=None, max_length=255)
    processingTimeMs: Optional[int] = Field(default=None)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    extraData: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))


# Request/Response Schemas
class VoiceSessionStartRequest(SQLModel):
    """Request to start voice session"""
    userId: UUID
    warehouseId: UUID
    taskId: Optional[UUID] = None
    deviceId: Optional[UUID] = None
    language: VoiceLanguage = VoiceLanguage.ENGLISH


class VoiceSessionResponse(SQLModel):
    """Response for voice session"""
    id: UUID
    userId: UUID
    warehouseId: UUID
    taskId: Optional[UUID]
    status: VoiceSessionStatus
    language: VoiceLanguage
    startedAt: datetime
    currentLineNumber: int
    completedLines: int
    totalLines: int
    pickedUnits: int


class VoiceCommandRequest(SQLModel):
    """Request to process voice command"""
    sessionId: UUID
    spokenText: str
    confidence: Optional[float] = None


class VoiceCommandResponse(SQLModel):
    """Response for voice command"""
    success: bool
    commandType: Optional[VoiceCommandType]
    responseText: str
    requiresConfirmation: bool = False
    nextInstruction: Optional[str] = None
    data: Optional[dict] = None


class VoiceInstructionResponse(SQLModel):
    """Response for next pick instruction"""
    sessionId: UUID
    lineNumber: int
    totalLines: int
    instruction: str
    locationCode: str
    checkDigits: Optional[str] = None
    sku: str
    itemName: Optional[str]
    quantity: int
    uom: str
    specialInstructions: Optional[str] = None


class VoiceConfirmRequest(SQLModel):
    """Request to confirm a pick"""
    sessionId: UUID
    checkDigits: Optional[str] = None
    quantity: int
    shortReason: Optional[str] = None


class VoiceConfirmResponse(SQLModel):
    """Response for pick confirmation"""
    success: bool
    message: str
    pickedQuantity: int
    remainingQuantity: int
    nextInstruction: Optional[str] = None


class VoiceProfileResponse(SQLModel):
    """Response for voice profile"""
    id: UUID
    userId: UUID
    language: VoiceLanguage
    speechRate: float
    volume: float
    confirmationRequired: bool
    trainingCompleted: bool


class VoiceProfileUpdate(SQLModel):
    """Schema for updating voice profile"""
    language: Optional[VoiceLanguage] = None
    speechRate: Optional[float] = None
    volume: Optional[float] = None
    pitchOffset: Optional[float] = None
    confirmationRequired: Optional[bool] = None
    feedbackEnabled: Optional[bool] = None
