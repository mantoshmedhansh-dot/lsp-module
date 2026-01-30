"""
Voice Command Processing Service
Handles voice command recognition and response generation
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID, uuid4
from sqlmodel import Session, select
from sqlalchemy import and_

from app.models.voice_picking import (
    VoiceProfile, VoiceCommand, VoiceSession, VoiceInteraction,
    VoiceSessionStatus, VoiceCommandType, VoiceLanguage,
    VoiceCommandResponse, VoiceInstructionResponse
)
from app.models.mobile_session import MobileTask, MobileTaskLine, TaskStatus


class VoiceCommandService:
    """
    Service for processing voice commands and generating responses.
    """

    # Command patterns for recognition
    COMMAND_PATTERNS = {
        VoiceLanguage.ENGLISH: {
            "confirm": ["confirm", "yes", "correct", "done", "picked"],
            "skip": ["skip", "skip item", "next item", "can't find"],
            "short": ["short", "shortage", "not enough", "partial"],
            "damage": ["damage", "damaged", "broken"],
            "help": ["help", "what", "repeat that"],
            "repeat": ["repeat", "say again", "what was that"],
            "next": ["next", "continue", "go on"],
            "back": ["back", "previous", "go back"],
            "logout": ["logout", "log out", "sign out", "end session"],
        },
        VoiceLanguage.HINDI: {
            "confirm": ["haan", "sahi", "confirm", "ho gaya"],
            "skip": ["skip", "chhod do", "agla"],
            "short": ["kam", "shortage", "poora nahi"],
            "help": ["madad", "help", "kya"],
            "repeat": ["dobara", "fir se bolo"],
            "logout": ["logout", "band karo"],
        }
    }

    # Response templates
    RESPONSE_TEMPLATES = {
        VoiceLanguage.ENGLISH: {
            "welcome": "Welcome {name}. You have {count} picks to complete.",
            "go_to_location": "Go to location {location}. Check digits {check_digits}.",
            "pick_item": "Pick {quantity} {uom} of {item}.",
            "confirm_success": "Confirmed. {remaining} items remaining.",
            "pick_complete": "Pick complete. Moving to next item.",
            "task_complete": "All picks complete. Great job!",
            "short_recorded": "Shortage recorded. {picked} of {requested} picked.",
            "skip_recorded": "Item skipped. Moving to next.",
            "invalid_check": "Check digits do not match. Please verify location.",
            "help": "Say confirm to pick, skip to skip item, or short for shortage.",
            "session_end": "Session ended. {total} items picked.",
            "error": "Sorry, I didn't understand. Please try again.",
        },
        VoiceLanguage.HINDI: {
            "welcome": "Swagat hai {name}. Aapke paas {count} picks hain.",
            "go_to_location": "Location {location} par jaiye. Check digits {check_digits}.",
            "pick_item": "{item} ke {quantity} {uom} uthayein.",
            "confirm_success": "Confirmed. {remaining} items baki hain.",
            "task_complete": "Sab picks complete. Bahut accha!",
            "error": "Maaf kijiye, samajh nahi aaya. Dobara boliye.",
        }
    }

    def __init__(self):
        self.active_sessions: Dict[UUID, dict] = {}

    async def start_session(
        self,
        db: Session,
        user_id: UUID,
        warehouse_id: UUID,
        task_id: Optional[UUID] = None,
        device_id: Optional[UUID] = None,
        language: VoiceLanguage = VoiceLanguage.ENGLISH
    ) -> VoiceSession:
        """Start a new voice picking session."""
        # End any existing active sessions
        existing_stmt = select(VoiceSession).where(
            and_(
                VoiceSession.userId == user_id,
                VoiceSession.status == VoiceSessionStatus.ACTIVE
            )
        )
        existing = db.exec(existing_stmt).all()
        for session in existing:
            session.status = VoiceSessionStatus.TERMINATED
            session.endedAt = datetime.now(timezone.utc)
            db.add(session)

        # Get task line count
        total_lines = 0
        if task_id:
            lines_stmt = select(MobileTaskLine).where(
                and_(
                    MobileTaskLine.taskId == task_id,
                    MobileTaskLine.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED])
                )
            )
            lines = db.exec(lines_stmt).all()
            total_lines = len(lines)

        # Create new session
        session = VoiceSession(
            userId=user_id,
            warehouseId=warehouse_id,
            taskId=task_id,
            deviceId=device_id,
            status=VoiceSessionStatus.ACTIVE,
            language=language,
            totalLines=total_lines
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        return session

    async def process_command(
        self,
        db: Session,
        session_id: UUID,
        spoken_text: str,
        confidence: Optional[float] = None
    ) -> VoiceCommandResponse:
        """Process a voice command and return response."""
        # Get session
        session_stmt = select(VoiceSession).where(VoiceSession.id == session_id)
        session = db.exec(session_stmt).first()

        if not session or session.status != VoiceSessionStatus.ACTIVE:
            return VoiceCommandResponse(
                success=False,
                commandType=None,
                responseText="Session not found or inactive."
            )

        # Recognize command
        command_type = await self._recognize_command(spoken_text, session.language)

        # Process based on command type
        if command_type == VoiceCommandType.CONFIRM:
            response = await self._handle_confirm(db, session)
        elif command_type == VoiceCommandType.SKIP:
            response = await self._handle_skip(db, session)
        elif command_type == VoiceCommandType.SHORT:
            response = await self._handle_short(db, session)
        elif command_type == VoiceCommandType.HELP:
            response = await self._handle_help(session)
        elif command_type == VoiceCommandType.REPEAT:
            response = await self._handle_repeat(db, session)
        elif command_type == VoiceCommandType.LOGOUT:
            response = await self._handle_logout(db, session)
        else:
            # Check if it's a check digit or quantity
            if spoken_text.isdigit():
                response = await self._handle_numeric_input(db, session, spoken_text)
            else:
                response = VoiceCommandResponse(
                    success=False,
                    commandType=None,
                    responseText=self.RESPONSE_TEMPLATES[session.language]["error"]
                )

        # Log interaction
        interaction = VoiceInteraction(
            sessionId=session_id,
            userId=session.userId,
            commandType=command_type,
            spokenText=spoken_text,
            recognizedText=spoken_text,
            confidence=confidence,
            responseText=response.responseText,
            wasSuccessful=response.success
        )
        db.add(interaction)
        db.commit()

        return response

    async def _recognize_command(
        self,
        text: str,
        language: VoiceLanguage
    ) -> Optional[VoiceCommandType]:
        """Recognize command from spoken text."""
        text_lower = text.lower().strip()
        patterns = self.COMMAND_PATTERNS.get(language, self.COMMAND_PATTERNS[VoiceLanguage.ENGLISH])

        for cmd_name, phrases in patterns.items():
            for phrase in phrases:
                if phrase in text_lower:
                    return VoiceCommandType[cmd_name.upper()]

        return None

    async def _handle_confirm(
        self,
        db: Session,
        session: VoiceSession
    ) -> VoiceCommandResponse:
        """Handle confirm command."""
        if not session.taskId:
            return VoiceCommandResponse(
                success=False,
                commandType=VoiceCommandType.CONFIRM,
                responseText="No active task."
            )

        # Get current task line
        line = await self._get_current_line(db, session)
        if not line:
            return VoiceCommandResponse(
                success=True,
                commandType=VoiceCommandType.CONFIRM,
                responseText=self.RESPONSE_TEMPLATES[session.language]["task_complete"]
            )

        # Mark line as complete
        line.status = TaskStatus.COMPLETED
        line.completedQuantity = line.requestedQuantity
        line.completedAt = datetime.now(timezone.utc)
        line.completedBy = session.userId
        db.add(line)

        # Update session
        session.completedLines += 1
        session.pickedUnits += line.requestedQuantity
        session.currentLineNumber += 1
        session.lastActivityAt = datetime.now(timezone.utc)
        db.add(session)
        db.commit()

        # Get next instruction
        remaining = session.totalLines - session.completedLines
        next_instruction = await self._get_next_instruction(db, session)

        if next_instruction:
            response_text = self.RESPONSE_TEMPLATES[session.language]["confirm_success"].format(
                remaining=remaining
            ) + " " + next_instruction
        else:
            response_text = self.RESPONSE_TEMPLATES[session.language]["task_complete"]

        return VoiceCommandResponse(
            success=True,
            commandType=VoiceCommandType.CONFIRM,
            responseText=response_text,
            nextInstruction=next_instruction
        )

    async def _handle_skip(
        self,
        db: Session,
        session: VoiceSession
    ) -> VoiceCommandResponse:
        """Handle skip command."""
        session.skippedLines += 1
        session.currentLineNumber += 1
        session.lastActivityAt = datetime.now(timezone.utc)
        db.add(session)
        db.commit()

        next_instruction = await self._get_next_instruction(db, session)

        return VoiceCommandResponse(
            success=True,
            commandType=VoiceCommandType.SKIP,
            responseText=self.RESPONSE_TEMPLATES[session.language]["skip_recorded"],
            nextInstruction=next_instruction
        )

    async def _handle_short(
        self,
        db: Session,
        session: VoiceSession
    ) -> VoiceCommandResponse:
        """Handle short command."""
        session.shortedLines += 1
        session.lastActivityAt = datetime.now(timezone.utc)
        db.add(session)
        db.commit()

        return VoiceCommandResponse(
            success=True,
            commandType=VoiceCommandType.SHORT,
            responseText="Say the quantity picked.",
            requiresConfirmation=True
        )

    async def _handle_help(
        self,
        session: VoiceSession
    ) -> VoiceCommandResponse:
        """Handle help command."""
        return VoiceCommandResponse(
            success=True,
            commandType=VoiceCommandType.HELP,
            responseText=self.RESPONSE_TEMPLATES[session.language]["help"]
        )

    async def _handle_repeat(
        self,
        db: Session,
        session: VoiceSession
    ) -> VoiceCommandResponse:
        """Handle repeat command."""
        instruction = await self._get_next_instruction(db, session)
        return VoiceCommandResponse(
            success=True,
            commandType=VoiceCommandType.REPEAT,
            responseText=instruction or "No current instruction.",
            nextInstruction=instruction
        )

    async def _handle_logout(
        self,
        db: Session,
        session: VoiceSession
    ) -> VoiceCommandResponse:
        """Handle logout command."""
        session.status = VoiceSessionStatus.COMPLETED
        session.endedAt = datetime.now(timezone.utc)
        db.add(session)
        db.commit()

        return VoiceCommandResponse(
            success=True,
            commandType=VoiceCommandType.LOGOUT,
            responseText=self.RESPONSE_TEMPLATES[session.language]["session_end"].format(
                total=session.pickedUnits
            )
        )

    async def _handle_numeric_input(
        self,
        db: Session,
        session: VoiceSession,
        number: str
    ) -> VoiceCommandResponse:
        """Handle numeric input (check digit or quantity)."""
        # This would validate check digits or record quantity
        return VoiceCommandResponse(
            success=True,
            commandType=VoiceCommandType.QUANTITY,
            responseText=f"Recorded {number}."
        )

    async def _get_current_line(
        self,
        db: Session,
        session: VoiceSession
    ) -> Optional[MobileTaskLine]:
        """Get current task line."""
        if not session.taskId:
            return None

        stmt = select(MobileTaskLine).where(
            and_(
                MobileTaskLine.taskId == session.taskId,
                MobileTaskLine.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
            )
        ).order_by(MobileTaskLine.lineNumber).limit(1)

        return db.exec(stmt).first()

    async def _get_next_instruction(
        self,
        db: Session,
        session: VoiceSession
    ) -> Optional[str]:
        """Generate next pick instruction."""
        line = await self._get_current_line(db, session)
        if not line:
            return None

        templates = self.RESPONSE_TEMPLATES[session.language]
        location_instruction = templates["go_to_location"].format(
            location=line.sourceLocation or "unknown",
            check_digits="12"  # Would be generated from location
        )
        pick_instruction = templates["pick_item"].format(
            quantity=line.requestedQuantity,
            uom=line.uom,
            item=line.itemName or line.sku
        )

        return f"{location_instruction} {pick_instruction}"

    async def get_next_instruction(
        self,
        db: Session,
        session_id: UUID
    ) -> Optional[VoiceInstructionResponse]:
        """Get the next pick instruction for a session."""
        session_stmt = select(VoiceSession).where(VoiceSession.id == session_id)
        session = db.exec(session_stmt).first()

        if not session or session.status != VoiceSessionStatus.ACTIVE:
            return None

        line = await self._get_current_line(db, session)
        if not line:
            return None

        return VoiceInstructionResponse(
            sessionId=session_id,
            lineNumber=session.currentLineNumber + 1,
            totalLines=session.totalLines,
            instruction=await self._get_next_instruction(db, session) or "",
            locationCode=line.sourceLocation or "",
            checkDigits="12",  # Would be generated
            sku=line.sku,
            itemName=line.itemName,
            quantity=line.requestedQuantity,
            uom=line.uom
        )

    async def end_session(
        self,
        db: Session,
        session_id: UUID
    ) -> bool:
        """End a voice session."""
        session_stmt = select(VoiceSession).where(VoiceSession.id == session_id)
        session = db.exec(session_stmt).first()

        if not session:
            return False

        session.status = VoiceSessionStatus.COMPLETED
        session.endedAt = datetime.now(timezone.utc)
        db.add(session)
        db.commit()

        return True


# Global service instance
voice_command_service = VoiceCommandService()
