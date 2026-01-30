"""
Token Manager
Manages OAuth tokens for marketplace connections with automatic refresh
"""
from typing import Optional, Tuple
from datetime import datetime, timedelta
from uuid import UUID
import logging
import asyncio
from contextlib import asynccontextmanager

from sqlmodel import Session, select

from app.models import (
    MarketplaceConnection,
    MarketplaceOAuthToken,
    MarketplaceOAuthTokenCreate,
    ConnectionStatus,
)
from app.core.database import get_session_context
from .base_adapter import AuthResult

logger = logging.getLogger(__name__)

# Token refresh buffer - refresh before actual expiry
TOKEN_REFRESH_BUFFER_MINUTES = 10


class TokenManager:
    """
    Manages OAuth tokens for marketplace connections.

    Features:
    - Automatic token refresh before expiry
    - Secure token storage
    - Connection status management
    - Refresh count tracking
    """

    def __init__(self, session: Optional[Session] = None):
        """
        Initialize TokenManager.

        Args:
            session: Optional database session. If not provided, creates one.
        """
        self._session = session
        self._refresh_locks: dict = {}

    @asynccontextmanager
    async def _get_session(self):
        """Get database session context."""
        if self._session:
            yield self._session
        else:
            with get_session_context() as session:
                yield session

    async def get_valid_token(
        self,
        connection_id: UUID,
        adapter=None
    ) -> Optional[str]:
        """
        Get a valid access token for a connection.

        If token is expired or near expiry, attempts to refresh it.

        Args:
            connection_id: MarketplaceConnection ID
            adapter: Optional adapter instance for refresh

        Returns:
            Valid access token or None
        """
        async with self._get_session() as session:
            token = await self._get_token_record(session, connection_id)

            if not token:
                logger.warning(f"No token found for connection: {connection_id}")
                return None

            if not token.isValid:
                logger.warning(f"Token is marked invalid for connection: {connection_id}")
                return None

            # Check if token needs refresh
            if self._needs_refresh(token):
                logger.info(f"Token needs refresh for connection: {connection_id}")

                if adapter:
                    refreshed = await self.refresh_token(connection_id, adapter)
                    if refreshed:
                        # Re-fetch after refresh
                        token = await self._get_token_record(session, connection_id)
                    else:
                        logger.error(f"Token refresh failed for connection: {connection_id}")
                        return None
                else:
                    logger.warning(
                        f"Token near expiry but no adapter provided for refresh: {connection_id}"
                    )

            return token.accessToken

    async def _get_token_record(
        self,
        session: Session,
        connection_id: UUID
    ) -> Optional[MarketplaceOAuthToken]:
        """Get the current valid token record."""
        return session.exec(
            select(MarketplaceOAuthToken)
            .where(MarketplaceOAuthToken.connectionId == connection_id)
            .where(MarketplaceOAuthToken.isValid == True)
        ).first()

    def _needs_refresh(self, token: MarketplaceOAuthToken) -> bool:
        """Check if token needs to be refreshed."""
        if not token.expiresAt:
            return False

        buffer = timedelta(minutes=TOKEN_REFRESH_BUFFER_MINUTES)
        return datetime.utcnow() >= (token.expiresAt - buffer)

    async def refresh_token(
        self,
        connection_id: UUID,
        adapter
    ) -> bool:
        """
        Refresh the access token for a connection.

        Uses a lock to prevent concurrent refresh attempts.

        Args:
            connection_id: MarketplaceConnection ID
            adapter: Marketplace adapter instance

        Returns:
            True if refresh successful
        """
        # Use lock to prevent concurrent refreshes
        lock_key = str(connection_id)
        if lock_key not in self._refresh_locks:
            self._refresh_locks[lock_key] = asyncio.Lock()

        async with self._refresh_locks[lock_key]:
            try:
                # Call adapter's refresh method
                result: AuthResult = await adapter.refresh_token()

                if not result.success:
                    logger.error(
                        f"Token refresh failed for {connection_id}: {result.error_message}"
                    )
                    await self._mark_token_invalid(connection_id, result.error_message)
                    return False

                # Store new tokens
                await self.store_token(
                    connection_id=connection_id,
                    access_token=result.access_token,
                    refresh_token=result.refresh_token,
                    expires_at=result.expires_at,
                    token_type=result.token_type,
                    scope=result.scope
                )

                logger.info(f"Token refreshed successfully for connection: {connection_id}")
                return True

            except Exception as e:
                logger.error(f"Token refresh error for {connection_id}: {e}", exc_info=True)
                await self._mark_token_invalid(connection_id, str(e))
                return False

    async def store_token(
        self,
        connection_id: UUID,
        access_token: str,
        refresh_token: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        refresh_expires_at: Optional[datetime] = None,
        token_type: str = "Bearer",
        scope: Optional[str] = None,
        token_metadata: Optional[dict] = None
    ) -> MarketplaceOAuthToken:
        """
        Store or update OAuth tokens for a connection.

        Invalidates previous tokens and creates a new record.

        Args:
            connection_id: MarketplaceConnection ID
            access_token: New access token
            refresh_token: New refresh token
            expires_at: Token expiry time
            refresh_expires_at: Refresh token expiry time
            token_type: Token type (usually "Bearer")
            scope: OAuth scope
            token_metadata: Additional metadata

        Returns:
            Created token record
        """
        async with self._get_session() as session:
            # Get connection to get company_id
            connection = session.exec(
                select(MarketplaceConnection)
                .where(MarketplaceConnection.id == connection_id)
            ).first()

            if not connection:
                raise ValueError(f"Connection not found: {connection_id}")

            # Get existing token to increment refresh count
            existing_token = await self._get_token_record(session, connection_id)
            refresh_count = (existing_token.refreshCount + 1) if existing_token else 0

            # Invalidate existing tokens
            await self._invalidate_tokens(session, connection_id)

            # Create new token
            token = MarketplaceOAuthToken(
                companyId=connection.companyId,
                connectionId=connection_id,
                accessToken=access_token,
                refreshToken=refresh_token,
                tokenType=token_type,
                expiresAt=expires_at,
                refreshExpiresAt=refresh_expires_at,
                scope=scope,
                tokenMetadata=token_metadata,
                isValid=True,
                lastRefreshedAt=datetime.utcnow(),
                refreshCount=refresh_count
            )

            session.add(token)

            # Update connection tokens as well (for backward compatibility)
            connection.accessToken = access_token
            connection.refreshToken = refresh_token
            connection.tokenExpiresAt = expires_at
            connection.status = ConnectionStatus.CONNECTED
            connection.errorMessage = None
            connection.errorAt = None
            session.add(connection)

            session.commit()
            session.refresh(token)

            logger.info(
                f"Token stored for connection {connection_id} "
                f"(refresh count: {refresh_count})"
            )

            return token

    async def _invalidate_tokens(
        self,
        session: Session,
        connection_id: UUID
    ):
        """Invalidate all existing tokens for a connection."""
        tokens = session.exec(
            select(MarketplaceOAuthToken)
            .where(MarketplaceOAuthToken.connectionId == connection_id)
            .where(MarketplaceOAuthToken.isValid == True)
        ).all()

        for token in tokens:
            token.isValid = False
            session.add(token)

    async def _mark_token_invalid(
        self,
        connection_id: UUID,
        error_message: Optional[str] = None
    ):
        """Mark token and connection as invalid/expired."""
        async with self._get_session() as session:
            # Mark token invalid
            token = await self._get_token_record(session, connection_id)
            if token:
                token.isValid = False
                session.add(token)

            # Update connection status
            connection = session.exec(
                select(MarketplaceConnection)
                .where(MarketplaceConnection.id == connection_id)
            ).first()

            if connection:
                connection.status = ConnectionStatus.EXPIRED
                connection.errorMessage = error_message
                connection.errorAt = datetime.utcnow()
                session.add(connection)

            session.commit()

    async def delete_tokens(self, connection_id: UUID):
        """Delete all tokens for a connection."""
        async with self._get_session() as session:
            tokens = session.exec(
                select(MarketplaceOAuthToken)
                .where(MarketplaceOAuthToken.connectionId == connection_id)
            ).all()

            for token in tokens:
                session.delete(token)

            session.commit()
            logger.info(f"Deleted all tokens for connection: {connection_id}")

    async def get_expiring_tokens(
        self,
        within_minutes: int = 30
    ) -> list:
        """
        Get connections with tokens expiring soon.

        Args:
            within_minutes: Time window to check

        Returns:
            List of connection IDs with expiring tokens
        """
        threshold = datetime.utcnow() + timedelta(minutes=within_minutes)

        async with self._get_session() as session:
            tokens = session.exec(
                select(MarketplaceOAuthToken)
                .where(MarketplaceOAuthToken.isValid == True)
                .where(MarketplaceOAuthToken.expiresAt != None)
                .where(MarketplaceOAuthToken.expiresAt <= threshold)
            ).all()

            return [token.connectionId for token in tokens]

    async def get_token_stats(self, connection_id: UUID) -> dict:
        """Get token statistics for a connection."""
        async with self._get_session() as session:
            token = await self._get_token_record(session, connection_id)

            if not token:
                return {
                    "has_token": False,
                    "is_valid": False
                }

            time_to_expiry = None
            if token.expiresAt:
                delta = token.expiresAt - datetime.utcnow()
                time_to_expiry = delta.total_seconds()

            return {
                "has_token": True,
                "is_valid": token.isValid,
                "token_type": token.tokenType,
                "expires_at": token.expiresAt.isoformat() if token.expiresAt else None,
                "seconds_to_expiry": time_to_expiry,
                "needs_refresh": self._needs_refresh(token),
                "refresh_count": token.refreshCount,
                "last_refreshed_at": token.lastRefreshedAt.isoformat() if token.lastRefreshedAt else None
            }
