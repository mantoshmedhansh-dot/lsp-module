"""
WebSocket API Endpoints for Real-time Operations
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, status
from sqlmodel import Session, select
import json

from app.core.database import get_session
from app.core.websocket import manager
from app.models.ws_connection import (
    WSConnection, WSSubscription, WSEvent,
    WSConnectionResponse, WSSubscriptionCreate, WSSubscriptionResponse,
    WSEventCreate, WSEventResponse, WSMessage,
    WSConnectionStatus, WSEventType, WSTopicType
)

router = APIRouter()


async def get_current_user_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
) -> Optional[str]:
    """
    Authenticate WebSocket connection.
    In production, validate the JWT token and return user_id.
    """
    # For now, accept token as user_id for simplicity
    # TODO: Implement proper JWT validation
    if token:
        return token
    return None


@router.websocket("/connect")
async def websocket_connect(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_session)
):
    """
    Main WebSocket connection endpoint.
    Connect with: ws://host/api/v1/ws/connect?token=<user_id>
    """
    user_id = await get_current_user_ws(websocket, token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    # Get client info
    client_ip = websocket.client.host if websocket.client else None
    user_agent = websocket.headers.get("user-agent")

    # Connect and get connection_id
    connection_id = await manager.connect(
        websocket=websocket,
        user_id=user_id,
        client_ip=client_ip,
        user_agent=user_agent,
        db=db
    )

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "ping":
                    # Handle ping/pong for keepalive
                    await manager.update_ping(connection_id, db)
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })

                elif msg_type == "subscribe":
                    # Subscribe to a topic
                    topic_str = message.get("topic")
                    filters = message.get("filters")
                    if topic_str:
                        try:
                            topic = WSTopicType(topic_str)
                            await manager.subscribe(
                                connection_id, topic, filters, db
                            )
                        except ValueError:
                            await websocket.send_json({
                                "type": "error",
                                "message": f"Invalid topic: {topic_str}"
                            })

                elif msg_type == "unsubscribe":
                    # Unsubscribe from a topic
                    topic_str = message.get("topic")
                    if topic_str:
                        try:
                            topic = WSTopicType(topic_str)
                            await manager.unsubscribe(connection_id, topic, db)
                            await websocket.send_json({
                                "type": "unsubscribed",
                                "topic": topic_str
                            })
                        except ValueError:
                            await websocket.send_json({
                                "type": "error",
                                "message": f"Invalid topic: {topic_str}"
                            })

                elif msg_type == "broadcast":
                    # Admin broadcast (should add permission check)
                    topic_str = message.get("topic", "all")
                    event_data = message.get("data", {})
                    try:
                        topic = WSTopicType(topic_str)
                        await manager.broadcast_to_topic(
                            topic,
                            WSMessage(
                                type="broadcast",
                                topic=topic,
                                data=event_data
                            ),
                            db=db
                        )
                    except ValueError:
                        pass

                else:
                    # Echo unknown messages back
                    await websocket.send_json({
                        "type": "echo",
                        "original": message
                    })

            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON"
                })

    except WebSocketDisconnect:
        await manager.disconnect(connection_id, db)


@router.websocket("/orders")
async def websocket_orders(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_session)
):
    """
    WebSocket endpoint for order status updates.
    Auto-subscribes to ORDERS topic.
    """
    user_id = await get_current_user_ws(websocket, token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    client_ip = websocket.client.host if websocket.client else None
    user_agent = websocket.headers.get("user-agent")

    connection_id = await manager.connect(
        websocket=websocket,
        user_id=user_id,
        client_ip=client_ip,
        user_agent=user_agent,
        db=db
    )

    # Auto-subscribe to orders topic
    await manager.subscribe(connection_id, WSTopicType.ORDERS, db=db)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await manager.update_ping(connection_id, db)
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

    except WebSocketDisconnect:
        await manager.disconnect(connection_id, db)


@router.websocket("/inventory")
async def websocket_inventory(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_session)
):
    """
    WebSocket endpoint for inventory/stock level changes.
    Auto-subscribes to INVENTORY topic.
    """
    user_id = await get_current_user_ws(websocket, token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    client_ip = websocket.client.host if websocket.client else None
    user_agent = websocket.headers.get("user-agent")

    connection_id = await manager.connect(
        websocket=websocket,
        user_id=user_id,
        client_ip=client_ip,
        user_agent=user_agent,
        db=db
    )

    await manager.subscribe(connection_id, WSTopicType.INVENTORY, db=db)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await manager.update_ping(connection_id, db)
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

    except WebSocketDisconnect:
        await manager.disconnect(connection_id, db)


@router.websocket("/picking")
async def websocket_picking(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_session)
):
    """
    WebSocket endpoint for picking task updates.
    Auto-subscribes to PICKING topic.
    """
    user_id = await get_current_user_ws(websocket, token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    client_ip = websocket.client.host if websocket.client else None
    user_agent = websocket.headers.get("user-agent")

    connection_id = await manager.connect(
        websocket=websocket,
        user_id=user_id,
        client_ip=client_ip,
        user_agent=user_agent,
        db=db
    )

    await manager.subscribe(connection_id, WSTopicType.PICKING, db=db)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await manager.update_ping(connection_id, db)
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

    except WebSocketDisconnect:
        await manager.disconnect(connection_id, db)


@router.websocket("/dashboard")
async def websocket_dashboard(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_session)
):
    """
    WebSocket endpoint for dashboard metrics.
    Auto-subscribes to DASHBOARD topic.
    """
    user_id = await get_current_user_ws(websocket, token)
    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    client_ip = websocket.client.host if websocket.client else None
    user_agent = websocket.headers.get("user-agent")

    connection_id = await manager.connect(
        websocket=websocket,
        user_id=user_id,
        client_ip=client_ip,
        user_agent=user_agent,
        db=db
    )

    await manager.subscribe(connection_id, WSTopicType.DASHBOARD, db=db)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await manager.update_ping(connection_id, db)
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

    except WebSocketDisconnect:
        await manager.disconnect(connection_id, db)


# REST endpoints for WebSocket management

@router.get("/connections", response_model=list[WSConnectionResponse])
async def list_connections(
    db: Session = Depends(get_session)
):
    """List all active WebSocket connections."""
    statement = select(WSConnection).where(
        WSConnection.status == WSConnectionStatus.CONNECTED
    )
    results = db.exec(statement).all()
    return results


@router.get("/connections/stats")
async def connection_stats():
    """Get WebSocket connection statistics."""
    return {
        "totalConnections": manager.get_connection_count(),
        "connectedUsers": len(manager.get_connected_users()),
        "topicSubscribers": {
            topic.value: manager.get_topic_subscriber_count(topic)
            for topic in WSTopicType
        }
    }


@router.get("/events", response_model=list[WSEventResponse])
async def list_events(
    topic: Optional[WSTopicType] = None,
    event_type: Optional[WSEventType] = None,
    limit: int = 100,
    db: Session = Depends(get_session)
):
    """List recent WebSocket events."""
    statement = select(WSEvent).order_by(WSEvent.broadcastedAt.desc()).limit(limit)

    if topic:
        statement = statement.where(WSEvent.topic == topic)
    if event_type:
        statement = statement.where(WSEvent.eventType == event_type)

    results = db.exec(statement).all()
    return results


@router.post("/events/broadcast", response_model=WSEventResponse)
async def broadcast_event(
    event: WSEventCreate,
    db: Session = Depends(get_session)
):
    """Broadcast a custom event to subscribers."""
    # Create and store event
    ws_event = WSEvent(
        eventType=event.eventType,
        topic=event.topic,
        payload=event.payload,
        targetUserIds=event.targetUserIds,
        expiresAt=event.expiresAt,
        broadcastedAt=datetime.now(timezone.utc)
    )
    db.add(ws_event)
    db.commit()
    db.refresh(ws_event)

    # Broadcast to subscribers
    message = WSMessage(
        type="event",
        event=event.eventType,
        topic=event.topic,
        data=event.payload
    )

    if event.targetUserIds:
        # Send to specific users
        for user_id in event.targetUserIds:
            await manager.send_to_user(user_id, message)
    else:
        # Broadcast to topic
        await manager.broadcast_to_topic(event.topic, message)

    return ws_event
