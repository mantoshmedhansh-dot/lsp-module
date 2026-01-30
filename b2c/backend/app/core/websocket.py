"""
WebSocket Connection Manager for Real-time Operations
"""
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set, Optional, List, Any
from uuid import UUID, uuid4
from fastapi import WebSocket, WebSocketDisconnect
from sqlmodel import Session, select

from app.models.ws_connection import (
    WSConnection, WSSubscription, WSEvent,
    WSConnectionStatus, WSEventType, WSTopicType, WSMessage
)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates.
    Handles connection lifecycle, subscriptions, and message broadcasting.
    """

    def __init__(self):
        # Active connections: user_id -> set of (connection_id, websocket)
        self.active_connections: Dict[str, Set[tuple]] = {}
        # Topic subscriptions: topic -> set of connection_ids
        self.topic_subscriptions: Dict[WSTopicType, Set[str]] = {
            topic: set() for topic in WSTopicType
        }
        # Connection to WebSocket mapping
        self.connection_websockets: Dict[str, WebSocket] = {}
        # Connection to user mapping
        self.connection_users: Dict[str, str] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        db: Optional[Session] = None
    ) -> str:
        """
        Accept a new WebSocket connection.
        Returns the connection_id.
        """
        await websocket.accept()
        connection_id = str(uuid4())

        async with self._lock:
            # Add to active connections
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add((connection_id, websocket))

            # Store mappings
            self.connection_websockets[connection_id] = websocket
            self.connection_users[connection_id] = user_id

            # Auto-subscribe to ALL topic
            self.topic_subscriptions[WSTopicType.ALL].add(connection_id)

        # Persist to database
        if db:
            ws_connection = WSConnection(
                userId=UUID(user_id),
                connectionId=connection_id,
                clientIp=client_ip,
                userAgent=user_agent,
                status=WSConnectionStatus.CONNECTED,
                connectedAt=datetime.now(timezone.utc)
            )
            db.add(ws_connection)
            db.commit()

        # Send connection confirmation
        await self.send_personal_message(
            connection_id,
            WSMessage(
                type="connected",
                data={"connectionId": connection_id, "userId": user_id}
            )
        )

        return connection_id

    async def disconnect(
        self,
        connection_id: str,
        db: Optional[Session] = None
    ):
        """Remove a WebSocket connection."""
        async with self._lock:
            user_id = self.connection_users.get(connection_id)

            if user_id and user_id in self.active_connections:
                # Remove from user's connections
                self.active_connections[user_id] = {
                    (cid, ws) for cid, ws in self.active_connections[user_id]
                    if cid != connection_id
                }
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

            # Remove from topic subscriptions
            for topic in self.topic_subscriptions.values():
                topic.discard(connection_id)

            # Remove from mappings
            self.connection_websockets.pop(connection_id, None)
            self.connection_users.pop(connection_id, None)

        # Update database
        if db:
            statement = select(WSConnection).where(
                WSConnection.connectionId == connection_id
            )
            result = db.exec(statement).first()
            if result:
                result.status = WSConnectionStatus.DISCONNECTED
                result.disconnectedAt = datetime.now(timezone.utc)
                db.add(result)
                db.commit()

    async def subscribe(
        self,
        connection_id: str,
        topic: WSTopicType,
        filters: Optional[dict] = None,
        db: Optional[Session] = None
    ) -> bool:
        """Subscribe a connection to a topic."""
        if connection_id not in self.connection_websockets:
            return False

        async with self._lock:
            self.topic_subscriptions[topic].add(connection_id)

        # Persist subscription
        if db:
            # Find the connection record
            conn_stmt = select(WSConnection).where(
                WSConnection.connectionId == connection_id
            )
            conn_record = db.exec(conn_stmt).first()
            if conn_record:
                subscription = WSSubscription(
                    connectionId=conn_record.id,
                    topic=topic,
                    filters=filters,
                    isActive=True
                )
                db.add(subscription)
                db.commit()

        # Confirm subscription
        await self.send_personal_message(
            connection_id,
            WSMessage(
                type="subscribed",
                topic=topic,
                data={"topic": topic.value, "filters": filters}
            )
        )

        return True

    async def unsubscribe(
        self,
        connection_id: str,
        topic: WSTopicType,
        db: Optional[Session] = None
    ) -> bool:
        """Unsubscribe a connection from a topic."""
        async with self._lock:
            self.topic_subscriptions[topic].discard(connection_id)

        # Update database
        if db:
            conn_stmt = select(WSConnection).where(
                WSConnection.connectionId == connection_id
            )
            conn_record = db.exec(conn_stmt).first()
            if conn_record:
                sub_stmt = select(WSSubscription).where(
                    WSSubscription.connectionId == conn_record.id,
                    WSSubscription.topic == topic,
                    WSSubscription.isActive == True
                )
                subscription = db.exec(sub_stmt).first()
                if subscription:
                    subscription.isActive = False
                    db.add(subscription)
                    db.commit()

        return True

    async def send_personal_message(
        self,
        connection_id: str,
        message: WSMessage
    ):
        """Send a message to a specific connection."""
        websocket = self.connection_websockets.get(connection_id)
        if websocket:
            try:
                await websocket.send_json(message.model_dump(mode='json'))
            except Exception:
                await self.disconnect(connection_id)

    async def send_to_user(
        self,
        user_id: str,
        message: WSMessage
    ):
        """Send a message to all connections of a user."""
        connections = self.active_connections.get(user_id, set())
        for connection_id, websocket in list(connections):
            try:
                await websocket.send_json(message.model_dump(mode='json'))
            except Exception:
                await self.disconnect(connection_id)

    async def broadcast_to_topic(
        self,
        topic: WSTopicType,
        message: WSMessage,
        exclude_connections: Optional[Set[str]] = None,
        db: Optional[Session] = None
    ):
        """Broadcast a message to all subscribers of a topic."""
        exclude_connections = exclude_connections or set()

        # Get subscribers for the specific topic and ALL topic
        subscribers = (
            self.topic_subscriptions[topic] |
            self.topic_subscriptions[WSTopicType.ALL]
        )

        # Log event
        if db and message.event:
            event = WSEvent(
                eventType=message.event,
                topic=topic,
                payload=message.data or {},
                broadcastedAt=datetime.now(timezone.utc)
            )
            db.add(event)
            db.commit()

        # Send to all subscribers
        for connection_id in list(subscribers):
            if connection_id not in exclude_connections:
                websocket = self.connection_websockets.get(connection_id)
                if websocket:
                    try:
                        await websocket.send_json(message.model_dump(mode='json'))
                    except Exception:
                        await self.disconnect(connection_id)

    async def broadcast_to_all(
        self,
        message: WSMessage,
        exclude_users: Optional[Set[str]] = None
    ):
        """Broadcast a message to all connected users."""
        exclude_users = exclude_users or set()

        for user_id, connections in list(self.active_connections.items()):
            if user_id not in exclude_users:
                for connection_id, websocket in list(connections):
                    try:
                        await websocket.send_json(message.model_dump(mode='json'))
                    except Exception:
                        await self.disconnect(connection_id)

    async def update_ping(
        self,
        connection_id: str,
        db: Optional[Session] = None
    ):
        """Update the last ping time for a connection."""
        if db:
            statement = select(WSConnection).where(
                WSConnection.connectionId == connection_id
            )
            result = db.exec(statement).first()
            if result:
                result.lastPingAt = datetime.now(timezone.utc)
                db.add(result)
                db.commit()

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self.connection_websockets)

    def get_user_connection_count(self, user_id: str) -> int:
        """Get number of connections for a specific user."""
        return len(self.active_connections.get(user_id, set()))

    def get_topic_subscriber_count(self, topic: WSTopicType) -> int:
        """Get number of subscribers for a topic."""
        return len(self.topic_subscriptions[topic])

    def get_connected_users(self) -> List[str]:
        """Get list of all connected user IDs."""
        return list(self.active_connections.keys())


# Global connection manager instance
manager = ConnectionManager()


async def notify_order_update(
    order_id: str,
    event_type: WSEventType,
    order_data: dict,
    db: Optional[Session] = None
):
    """Helper function to notify about order updates."""
    message = WSMessage(
        type="order_update",
        event=event_type,
        topic=WSTopicType.ORDERS,
        data={"orderId": order_id, **order_data}
    )
    await manager.broadcast_to_topic(WSTopicType.ORDERS, message, db=db)


async def notify_inventory_update(
    item_id: str,
    event_type: WSEventType,
    inventory_data: dict,
    db: Optional[Session] = None
):
    """Helper function to notify about inventory updates."""
    message = WSMessage(
        type="inventory_update",
        event=event_type,
        topic=WSTopicType.INVENTORY,
        data={"itemId": item_id, **inventory_data}
    )
    await manager.broadcast_to_topic(WSTopicType.INVENTORY, message, db=db)


async def notify_picking_update(
    task_id: str,
    event_type: WSEventType,
    picking_data: dict,
    user_id: Optional[str] = None,
    db: Optional[Session] = None
):
    """Helper function to notify about picking task updates."""
    message = WSMessage(
        type="picking_update",
        event=event_type,
        topic=WSTopicType.PICKING,
        data={"taskId": task_id, **picking_data}
    )

    # Send to specific user if provided, otherwise broadcast
    if user_id:
        await manager.send_to_user(user_id, message)
    else:
        await manager.broadcast_to_topic(WSTopicType.PICKING, message, db=db)


async def notify_dashboard_metrics(
    metrics: dict,
    db: Optional[Session] = None
):
    """Helper function to broadcast dashboard metrics update."""
    message = WSMessage(
        type="dashboard_update",
        event=WSEventType.DASHBOARD_METRICS_UPDATE,
        topic=WSTopicType.DASHBOARD,
        data=metrics
    )
    await manager.broadcast_to_topic(WSTopicType.DASHBOARD, message, db=db)
