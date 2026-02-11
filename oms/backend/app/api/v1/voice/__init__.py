"""
Voice Picking API v1 - Voice-directed warehouse operations
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func

from app.core.database import get_session
from app.core.deps import get_current_user, require_manager, CompanyFilter
from app.models import (
    User,
    VoiceProfile, VoiceProfileCreate, VoiceProfileResponse,
    VoiceCommand, VoiceCommandCreate, VoiceCommandResponse,
    VoiceSession, VoiceSessionResponse,
    VoiceInteraction, VoiceInteractionResponse,
    VoiceSessionStatus, VoiceCommandType,
)


router = APIRouter(prefix="/voice", tags=["Voice Picking"])


# ============================================================================
# Voice Profiles
# ============================================================================

@router.get("/profiles", response_model=List[VoiceProfileResponse])
def list_profiles(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List voice profiles"""
    query = select(VoiceProfile)

    query = company_filter.apply_filter(query, VoiceProfile.companyId)

    profiles = session.exec(query).all()
    return profiles


@router.get("/profiles/me", response_model=VoiceProfileResponse)
def get_my_profile(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get current user's voice profile"""
    query = select(VoiceProfile).where(VoiceProfile.userId == current_user.id)
    query = company_filter.apply_filter(query, VoiceProfile.companyId)

    profile = session.exec(query).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    return profile


@router.post("/profiles", response_model=VoiceProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(
    data: VoiceProfileCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create a voice profile for a user"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Check if profile exists
    existing = session.exec(
        select(VoiceProfile)
        .where(VoiceProfile.userId == data.userId)
        .where(VoiceProfile.companyId == company_filter.company_id)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Profile already exists for this user")

    from uuid import uuid4
    profile = VoiceProfile(
        id=uuid4(),
        companyId=company_filter.company_id,
        **data.model_dump()
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.patch("/profiles/{profile_id}", response_model=VoiceProfileResponse)
def update_profile(
    profile_id: UUID,
    speech_rate: Optional[float] = None,
    volume: Optional[float] = None,
    language: Optional[str] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update voice profile settings"""
    query = select(VoiceProfile).where(VoiceProfile.id == profile_id)
    query = company_filter.apply_filter(query, VoiceProfile.companyId)

    profile = session.exec(query).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if speech_rate is not None:
        profile.speechRate = speech_rate
    if volume is not None:
        profile.volume = volume
    if language is not None:
        profile.language = language

    profile.updatedAt = datetime.utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


# ============================================================================
# Voice Commands
# ============================================================================

@router.get("/commands", response_model=List[VoiceCommandResponse])
def list_commands(
    category: Optional[str] = None,
    is_active: bool = True,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List available voice commands"""
    query = select(VoiceCommand).where(VoiceCommand.isActive == is_active)

    query = company_filter.apply_filter(query, VoiceCommand.companyId)
    if category:
        query = query.where(VoiceCommand.category == category)

    commands = session.exec(query).all()
    return commands


@router.post("/commands", response_model=VoiceCommandResponse, status_code=status.HTTP_201_CREATED)
def create_command(
    data: VoiceCommandCreate,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_manager())
):
    """Create a custom voice command"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    from uuid import uuid4
    command = VoiceCommand(
        id=uuid4(),
        companyId=company_filter.company_id,
        **data.model_dump()
    )
    session.add(command)
    session.commit()
    session.refresh(command)
    return command


# ============================================================================
# Voice Sessions
# ============================================================================

@router.post("/session/start", response_model=VoiceSessionResponse)
def start_voice_session(
    device_id: Optional[UUID] = None,
    task_type: str = "PICKING",
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Start a new voice session"""
    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Check for active session
    active = session.exec(
        select(VoiceSession)
        .where(VoiceSession.userId == current_user.id)
        .where(VoiceSession.companyId == company_filter.company_id)
        .where(VoiceSession.status == VoiceSessionStatus.ACTIVE)
    ).first()

    if active:
        raise HTTPException(status_code=400, detail="Already have an active session")

    from uuid import uuid4
    voice_session = VoiceSession(
        id=uuid4(),
        companyId=company_filter.company_id,
        userId=current_user.id,
        deviceId=device_id,
        taskType=task_type,
        status=VoiceSessionStatus.ACTIVE,
        startedAt=datetime.utcnow()
    )
    session.add(voice_session)
    session.commit()
    session.refresh(voice_session)
    return voice_session


@router.post("/session/end", response_model=VoiceSessionResponse)
def end_voice_session(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """End the current voice session"""
    active = session.exec(
        select(VoiceSession)
        .where(VoiceSession.userId == current_user.id)
        .where(VoiceSession.status == VoiceSessionStatus.ACTIVE)
    ).first()

    if not active:
        raise HTTPException(status_code=400, detail="No active session")

    active.status = VoiceSessionStatus.COMPLETED
    active.endedAt = datetime.utcnow()
    active.updatedAt = datetime.utcnow()
    session.add(active)
    session.commit()
    session.refresh(active)
    return active


@router.get("/session/current", response_model=VoiceSessionResponse)
def get_current_session(
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get current active voice session"""
    active = session.exec(
        select(VoiceSession)
        .where(VoiceSession.userId == current_user.id)
        .where(VoiceSession.status == VoiceSessionStatus.ACTIVE)
    ).first()

    if not active:
        raise HTTPException(status_code=404, detail="No active session")
    return active


@router.get("/sessions", response_model=List[VoiceSessionResponse])
def list_sessions(
    user_id: Optional[UUID] = None,
    status: Optional[VoiceSessionStatus] = None,
    limit: int = Query(50, ge=1, le=200),
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List voice sessions"""
    query = select(VoiceSession)

    query = company_filter.apply_filter(query, VoiceSession.companyId)
    if user_id:
        query = query.where(VoiceSession.userId == user_id)
    if status:
        query = query.where(VoiceSession.status == status)

    query = query.order_by(VoiceSession.startedAt.desc()).limit(limit)
    sessions = session.exec(query).all()
    return sessions


# ============================================================================
# Voice Commands Processing
# ============================================================================

@router.post("/command")
def process_voice_command(
    command_text: str,
    session_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Process a voice command"""
    from uuid import uuid4

    if not company_filter.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    # Find or create session
    voice_session = None
    if session_id:
        voice_session = session.exec(
            select(VoiceSession).where(VoiceSession.id == session_id)
        ).first()
    else:
        voice_session = session.exec(
            select(VoiceSession)
            .where(VoiceSession.userId == current_user.id)
            .where(VoiceSession.status == VoiceSessionStatus.ACTIVE)
        ).first()

    if not voice_session:
        raise HTTPException(status_code=400, detail="No active session. Start a session first.")

    # Log the interaction
    interaction = VoiceInteraction(
        id=uuid4(),
        companyId=company_filter.company_id,
        sessionId=voice_session.id,
        interactionType=VoiceCommandType.COMMAND,
        inputText=command_text,
        timestamp=datetime.utcnow()
    )

    # Process command (placeholder logic)
    response_text = "Command received"
    action = None

    command_lower = command_text.lower()
    if "next" in command_lower:
        action = "NEXT_PICK"
        response_text = "Moving to next pick"
    elif "confirm" in command_lower or "done" in command_lower:
        action = "CONFIRM"
        response_text = "Pick confirmed"
    elif "skip" in command_lower:
        action = "SKIP"
        response_text = "Pick skipped"
    elif "repeat" in command_lower:
        action = "REPEAT"
        response_text = "Repeating last instruction"
    elif "help" in command_lower:
        action = "HELP"
        response_text = "Available commands: next, confirm, skip, repeat, help, end"
    elif "end" in command_lower or "quit" in command_lower:
        action = "END_SESSION"
        response_text = "Ending session"
        voice_session.status = VoiceSessionStatus.COMPLETED
        voice_session.endedAt = datetime.utcnow()
        session.add(voice_session)

    interaction.responseText = response_text
    interaction.isSuccessful = True
    session.add(interaction)

    # Update session stats
    voice_session.totalInteractions = (voice_session.totalInteractions or 0) + 1
    session.add(voice_session)

    session.commit()

    return {
        "success": True,
        "action": action,
        "response": response_text,
        "sessionId": str(voice_session.id)
    }


@router.get("/next-instruction")
def get_next_instruction(
    session_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get the next pick instruction for voice guidance"""
    voice_session = None
    if session_id:
        voice_session = session.exec(
            select(VoiceSession).where(VoiceSession.id == session_id)
        ).first()
    else:
        voice_session = session.exec(
            select(VoiceSession)
            .where(VoiceSession.userId == current_user.id)
            .where(VoiceSession.status == VoiceSessionStatus.ACTIVE)
        ).first()

    if not voice_session:
        raise HTTPException(status_code=400, detail="No active session")

    # Placeholder - would fetch from picking queue
    return {
        "instruction": "Go to aisle A, bin 101. Pick 5 units of SKU ABC123.",
        "location": "A-101",
        "sku": "ABC123",
        "quantity": 5,
        "checkDigit": "47",
        "sessionId": str(voice_session.id)
    }


@router.post("/confirm")
def confirm_pick(
    check_digit: str,
    quantity: int,
    session_id: Optional[UUID] = None,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Confirm a pick with check digit"""
    from uuid import uuid4

    voice_session = None
    if session_id:
        voice_session = session.exec(
            select(VoiceSession).where(VoiceSession.id == session_id)
        ).first()
    else:
        voice_session = session.exec(
            select(VoiceSession)
            .where(VoiceSession.userId == current_user.id)
            .where(VoiceSession.status == VoiceSessionStatus.ACTIVE)
        ).first()

    if not voice_session:
        raise HTTPException(status_code=400, detail="No active session")

    # Validate check digit (placeholder)
    is_valid = check_digit == "47"  # Would validate against actual bin check digit

    # Log interaction
    interaction = VoiceInteraction(
        id=uuid4(),
        companyId=voice_session.companyId,
        sessionId=voice_session.id,
        interactionType=VoiceCommandType.CONFIRMATION,
        inputText=f"Check digit: {check_digit}, Quantity: {quantity}",
        isSuccessful=is_valid,
        timestamp=datetime.utcnow()
    )

    if is_valid:
        interaction.responseText = f"Confirmed {quantity} units"
        voice_session.successfulPicks = (voice_session.successfulPicks or 0) + 1
    else:
        interaction.responseText = "Invalid check digit. Please try again."

    voice_session.totalInteractions = (voice_session.totalInteractions or 0) + 1

    session.add(interaction)
    session.add(voice_session)
    session.commit()

    return {
        "success": is_valid,
        "message": interaction.responseText,
        "nextAction": "NEXT_PICK" if is_valid else "RETRY"
    }


# ============================================================================
# Session Stats
# ============================================================================

@router.get("/session/{session_id}/stats")
def get_session_stats(
    session_id: UUID,
    company_filter: CompanyFilter = Depends(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get statistics for a voice session"""
    voice_session = session.exec(
        select(VoiceSession).where(VoiceSession.id == session_id)
    ).first()

    if not voice_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Calculate duration
    duration_minutes = 0
    if voice_session.startedAt:
        end_time = voice_session.endedAt or datetime.utcnow()
        duration_minutes = int((end_time - voice_session.startedAt).total_seconds() / 60)

    return {
        "sessionId": str(session_id),
        "status": voice_session.status.value,
        "taskType": voice_session.taskType,
        "durationMinutes": duration_minutes,
        "totalInteractions": voice_session.totalInteractions or 0,
        "successfulPicks": voice_session.successfulPicks or 0,
        "startedAt": voice_session.startedAt.isoformat() if voice_session.startedAt else None,
        "endedAt": voice_session.endedAt.isoformat() if voice_session.endedAt else None
    }
