"""API v1 Routes"""
from fastapi import APIRouter

from .auth import router as auth_router
from .ws import router as ws_router
from .mobile import router as mobile_router
from .labor import router as labor_router
from .slotting import router as slotting_router
from .voice import router as voice_router
from .cross_dock import router as cross_dock_router
from .preorders import router as preorders_router
from .subscriptions import router as subscriptions_router
from .reconciliation import router as reconciliation_router
from .marketplaces import router as marketplaces_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
router.include_router(ws_router, prefix="/ws", tags=["WebSocket"])
router.include_router(mobile_router, prefix="/mobile", tags=["Mobile WMS"])
router.include_router(labor_router, prefix="/labor", tags=["Labor Management"])
router.include_router(slotting_router, prefix="/slotting", tags=["Slotting Optimization"])
router.include_router(voice_router, prefix="/voice", tags=["Voice Picking"])
router.include_router(cross_dock_router, prefix="/cross-dock", tags=["Cross-Docking"])
router.include_router(preorders_router, prefix="/preorders", tags=["Pre-orders"])
router.include_router(subscriptions_router, prefix="/subscriptions", tags=["Subscriptions"])
router.include_router(reconciliation_router, prefix="/reconciliation", tags=["Payment Reconciliation"])
router.include_router(marketplaces_router, prefix="/marketplaces", tags=["Marketplace Integrations"])
