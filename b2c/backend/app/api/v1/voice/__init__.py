"""
Voice Picking API Endpoints
"""
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import and_

from app.core.database import get_session
from app.models.voice_picking import (
    VoiceProfile, VoiceCommand, VoiceSession,
    VoiceSessionStatus, VoiceCommandType, VoiceLanguage,
    VoiceSessionStartRequest, VoiceSessionResponse,
    VoiceCommandRequest, VoiceCommandResponse,
    VoiceInstructionResponse,
    VoiceConfirmRequest, VoiceConfirmResponse,
    VoiceProfileResponse, VoiceProfileUpdate
)
from app.services.voice_commands import voice_command_service

router = APIRouter()


# ==================== Session Management ====================

@router.post("/session/start", response_model=VoiceSessionResponse)
async def start_voice_session(
    request: VoiceSessionStartRequest,
    db: Session = Depends(get_session)
):
    """Start a new voice picking session."""
    session = await voice_command_service.start_session(
        db=db,
        user_id=request.userId,
        warehouse_id=request.warehouseId,
        task_id=request.taskId,
        device_id=request.deviceId,
        language=request.language
    )
    return session


@router.get("/session/{session_id}", response_model=VoiceSessionResponse)
async def get_voice_session(
    session_id: UUID,
    db: Session = Depends(get_session)
):
    """Get voice session details."""
    statement = select(VoiceSession).where(VoiceSession.id == session_id)
    session = db.exec(statement).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


@router.post("/session/end")
async def end_voice_session(
    session_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """End a voice picking session."""
    success = await voice_command_service.end_session(db, session_id)

    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"message": "Session ended", "sessionId": str(session_id)}


@router.get("/sessions", response_model=List[VoiceSessionResponse])
async def list_voice_sessions(
    user_id: Optional[UUID] = None,
    warehouse_id: Optional[UUID] = None,
    status: Optional[VoiceSessionStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_session)
):
    """List voice sessions."""
    statement = select(VoiceSession)

    if user_id:
        statement = statement.where(VoiceSession.userId == user_id)
    if warehouse_id:
        statement = statement.where(VoiceSession.warehouseId == warehouse_id)
    if status:
        statement = statement.where(VoiceSession.status == status)

    statement = statement.order_by(VoiceSession.startedAt.desc()).limit(limit)
    results = db.exec(statement).all()
    return results


# ==================== Command Processing ====================

@router.post("/command", response_model=VoiceCommandResponse)
async def process_voice_command(
    request: VoiceCommandRequest,
    db: Session = Depends(get_session)
):
    """Process a voice command."""
    return await voice_command_service.process_command(
        db=db,
        session_id=request.sessionId,
        spoken_text=request.spokenText,
        confidence=request.confidence
    )


@router.get("/next-instruction", response_model=VoiceInstructionResponse)
async def get_next_instruction(
    session_id: UUID = Query(...),
    db: Session = Depends(get_session)
):
    """Get the next pick instruction."""
    instruction = await voice_command_service.get_next_instruction(
        db=db,
        session_id=session_id
    )

    if not instruction:
        raise HTTPException(
            status_code=404,
            detail="No more instructions or session not found"
        )

    return instruction


@router.post("/confirm", response_model=VoiceConfirmResponse)
async def confirm_pick(
    request: VoiceConfirmRequest,
    db: Session = Depends(get_session)
):
    """Confirm a pick by voice."""
    # Get session
    session_stmt = select(VoiceSession).where(VoiceSession.id == request.sessionId)
    session = db.exec(session_stmt).first()

    if not session or session.status != VoiceSessionStatus.ACTIVE:
        raise HTTPException(status_code=404, detail="Active session not found")

    # Validate check digits if provided
    if request.checkDigits:
        # In real implementation, validate against location
        pass

    # Process confirmation
    response = await voice_command_service.process_command(
        db=db,
        session_id=request.sessionId,
        spoken_text=f"confirm {request.quantity}"
    )

    next_instruction = None
    if response.success:
        instruction = await voice_command_service.get_next_instruction(db, request.sessionId)
        if instruction:
            next_instruction = instruction.instruction

    return VoiceConfirmResponse(
        success=response.success,
        message=response.responseText,
        pickedQuantity=request.quantity,
        remainingQuantity=0,  # Would be calculated
        nextInstruction=next_instruction
    )


# ==================== Profile Management ====================

@router.get("/profile/{user_id}", response_model=VoiceProfileResponse)
async def get_voice_profile(
    user_id: UUID,
    db: Session = Depends(get_session)
):
    """Get voice profile for a user."""
    statement = select(VoiceProfile).where(VoiceProfile.userId == user_id)
    profile = db.exec(statement).first()

    if not profile:
        # Create default profile
        profile = VoiceProfile(userId=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


@router.put("/profile/{user_id}", response_model=VoiceProfileResponse)
async def update_voice_profile(
    user_id: UUID,
    update: VoiceProfileUpdate,
    db: Session = Depends(get_session)
):
    """Update voice profile settings."""
    statement = select(VoiceProfile).where(VoiceProfile.userId == user_id)
    profile = db.exec(statement).first()

    if not profile:
        profile = VoiceProfile(userId=user_id)

    if update.language is not None:
        profile.language = update.language
    if update.speechRate is not None:
        profile.speechRate = max(0.5, min(2.0, update.speechRate))
    if update.volume is not None:
        profile.volume = max(0.0, min(1.0, update.volume))
    if update.pitchOffset is not None:
        profile.pitchOffset = max(-1.0, min(1.0, update.pitchOffset))
    if update.confirmationRequired is not None:
        profile.confirmationRequired = update.confirmationRequired
    if update.feedbackEnabled is not None:
        profile.feedbackEnabled = update.feedbackEnabled

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


# ==================== Command Definitions ====================

@router.get("/commands", response_model=List[dict])
async def list_voice_commands(
    language: VoiceLanguage = VoiceLanguage.ENGLISH,
    db: Session = Depends(get_session)
):
    """List available voice commands for a language."""
    statement = select(VoiceCommand).where(
        and_(
            VoiceCommand.language == language,
            VoiceCommand.isActive == True
        )
    )
    results = db.exec(statement).all()

    # If no custom commands, return default patterns
    if not results:
        from app.services.voice_commands import VoiceCommandService
        patterns = VoiceCommandService.COMMAND_PATTERNS.get(
            language,
            VoiceCommandService.COMMAND_PATTERNS[VoiceLanguage.ENGLISH]
        )
        return [
            {"command": cmd, "phrases": phrases}
            for cmd, phrases in patterns.items()
        ]

    return [
        {
            "command": cmd.commandType.value,
            "phrase": cmd.phrase,
            "aliases": cmd.aliases,
            "description": cmd.description
        }
        for cmd in results
    ]


# ==================== Analytics ====================

@router.get("/analytics/session/{session_id}")
async def get_session_analytics(
    session_id: UUID,
    db: Session = Depends(get_session)
):
    """Get analytics for a voice session."""
    session_stmt = select(VoiceSession).where(VoiceSession.id == session_id)
    session = db.exec(session_stmt).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Calculate session duration
    end_time = session.endedAt or datetime.now(timezone.utc)
    duration_minutes = (end_time - session.startedAt).total_seconds() / 60

    # Calculate picks per hour
    picks_per_hour = (session.pickedUnits / duration_minutes * 60) if duration_minutes > 0 else 0

    return {
        "sessionId": str(session_id),
        "userId": str(session.userId),
        "durationMinutes": round(duration_minutes, 2),
        "totalLines": session.totalLines,
        "completedLines": session.completedLines,
        "skippedLines": session.skippedLines,
        "shortedLines": session.shortedLines,
        "pickedUnits": session.pickedUnits,
        "errorCount": session.errorCount,
        "completionRate": round(session.completedLines / session.totalLines * 100, 2) if session.totalLines > 0 else 0,
        "picksPerHour": round(picks_per_hour, 2),
        "status": session.status.value
    }
