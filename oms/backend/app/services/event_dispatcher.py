"""
EventDispatcher — Lightweight in-process event bus for CJDQuick OMS.

Design:
- Singleton registry of event_type → handler functions
- Handlers run in background (via BackgroundTasks or thread pool)
- Each handler gets its OWN DB session (isolated from endpoint transaction)
- Errors in one handler never crash the endpoint or other handlers
- No external infrastructure required (no Redis/RabbitMQ)

Usage:
    from app.services.event_dispatcher import dispatch, dispatch_sync, on

    @on("order.confirmed")
    def handle_order_confirmed(payload: dict):
        # payload has orderId, companyId, etc.
        ...

    # In an endpoint, after commit:
    dispatch("order.confirmed", {"orderId": str(order.id), "companyId": str(order.companyId)})
"""
import logging
import threading
from typing import Callable, Dict, List, Any

logger = logging.getLogger("event_dispatcher")

# ── Global Registry ──────────────────────────────────────────────────────
_handlers: Dict[str, List[Callable]] = {}


def on(event_type: str):
    """Decorator to register a handler for an event type."""
    def decorator(fn: Callable):
        if event_type not in _handlers:
            _handlers[event_type] = []
        _handlers[event_type].append(fn)
        logger.debug(f"Registered handler {fn.__name__} for event '{event_type}'")
        return fn
    return decorator


def _safe_run_handler(handler: Callable, event_type: str, payload: dict):
    """Run a single handler with its own DB session, isolated error handling."""
    from app.core.database import engine
    from sqlmodel import Session

    handler_name = handler.__name__
    try:
        with Session(engine) as session:
            handler(payload, session)
            session.commit()
        logger.info(f"[{event_type}] {handler_name} completed")
    except Exception as e:
        logger.error(f"[{event_type}] {handler_name} FAILED: {e}", exc_info=True)


def dispatch(event_type: str, payload: dict):
    """
    Dispatch an event asynchronously (fire-and-forget via threads).
    Called from endpoints after session.commit().
    """
    handlers = _handlers.get(event_type, [])
    if not handlers:
        logger.debug(f"No handlers for event '{event_type}'")
        return

    logger.info(f"Dispatching '{event_type}' to {len(handlers)} handler(s)")
    for handler in handlers:
        thread = threading.Thread(
            target=_safe_run_handler,
            args=(handler, event_type, payload),
            daemon=True,
        )
        thread.start()


def dispatch_sync(event_type: str, payload: dict):
    """
    Dispatch an event synchronously (blocking).
    Used from scheduler jobs that already run in a background thread.
    """
    handlers = _handlers.get(event_type, [])
    if not handlers:
        return

    logger.info(f"Dispatching (sync) '{event_type}' to {len(handlers)} handler(s)")
    for handler in handlers:
        _safe_run_handler(handler, event_type, payload)


def get_registered_events() -> Dict[str, List[str]]:
    """Return all registered events and their handler names (for debug endpoint)."""
    return {
        event_type: [h.__name__ for h in handlers]
        for event_type, handlers in _handlers.items()
    }
