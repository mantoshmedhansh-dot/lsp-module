"""
Token Refresh Job
Periodic job to refresh expiring OAuth tokens for marketplace connections
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from sqlmodel import Session, select

from app.core.database import get_session
from app.models import (
    MarketplaceConnection,
    ConnectionStatus,
)
from app.services.marketplaces import TokenManager, AdapterFactory

logger = logging.getLogger(__name__)


class TokenRefreshJob:
    """Token refresh job handler"""

    def __init__(self, session: Session):
        self.session = session
        self.token_manager = TokenManager(session)

    async def refresh_connection(self, connection: MarketplaceConnection) -> dict:
        """Refresh token for a single connection"""
        try:
            logger.info(f"Checking token for {connection.connectionName} ({connection.id})")

            # Get the adapter and attempt to refresh
            adapter = AdapterFactory.create_from_connection(connection, self.session)

            # Check if token needs refresh
            token = await self.token_manager.get_valid_token(connection.id)

            if token is None:
                # No valid token, attempt to refresh
                success = await adapter.refresh_token()

                if success:
                    logger.info(f"Token refreshed for {connection.connectionName}")
                    return {
                        "success": True,
                        "action": "refreshed",
                        "connection_id": str(connection.id)
                    }
                else:
                    logger.warning(f"Token refresh failed for {connection.connectionName}")
                    return {
                        "success": False,
                        "action": "refresh_failed",
                        "connection_id": str(connection.id)
                    }
            else:
                logger.debug(f"Token still valid for {connection.connectionName}")
                return {
                    "success": True,
                    "action": "still_valid",
                    "connection_id": str(connection.id)
                }

        except Exception as e:
            logger.error(f"Token refresh failed for {connection.connectionName}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "connection_id": str(connection.id)
            }

    async def refresh_all(self) -> List[dict]:
        """Refresh tokens for all connections that need it"""
        results = []

        # Get expiring tokens (within 1 hour)
        expiring_tokens = await self.token_manager.get_expiring_tokens(minutes=60)

        if not expiring_tokens:
            logger.info("No tokens expiring within the next hour")
            return results

        logger.info(f"Found {len(expiring_tokens)} tokens expiring soon")

        # Get connections for expiring tokens
        connection_ids = [t.connectionId for t in expiring_tokens]
        connections = self.session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.id.in_(connection_ids))
            .where(MarketplaceConnection.isActive == True)
        ).all()

        for connection in connections:
            result = await self.refresh_connection(connection)
            results.append({
                "connection_id": str(connection.id),
                "connection_name": connection.connectionName,
                "marketplace": connection.marketplace.value,
                **result
            })

        return results


async def run_token_refresh():
    """Entry point for scheduled token refresh job"""
    logger.info("Running scheduled token refresh job")

    session_gen = get_session()
    session = next(session_gen)

    try:
        job = TokenRefreshJob(session)
        results = await job.refresh_all()

        if results:
            refreshed = len([r for r in results if r.get("action") == "refreshed"])
            failed = len([r for r in results if not r.get("success", False)])
            logger.info(f"Token refresh job completed: {refreshed} refreshed, {failed} failed")
        else:
            logger.info("Token refresh job completed: no tokens needed refresh")

    except Exception as e:
        logger.error(f"Token refresh job failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass


async def run_token_refresh_connection(connection_id: str):
    """Force token refresh for a specific connection"""
    from uuid import UUID

    logger.info(f"Running token refresh for connection {connection_id}")

    session_gen = get_session()
    session = next(session_gen)

    try:
        connection = session.exec(
            select(MarketplaceConnection)
            .where(MarketplaceConnection.id == UUID(connection_id))
        ).first()

        if not connection:
            logger.error(f"Connection not found: {connection_id}")
            return

        job = TokenRefreshJob(session)
        result = await job.refresh_connection(connection)

        logger.info(f"Token refresh completed for {connection.connectionName}: {result}")

    except Exception as e:
        logger.error(f"Token refresh failed: {str(e)}")

    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass
