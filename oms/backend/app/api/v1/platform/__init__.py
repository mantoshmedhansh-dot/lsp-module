"""
Platform API - SaaS subscription management, billing, onboarding, admin
"""
from fastapi import APIRouter

from .plans import router as plans_router
from .subscriptions import router as subscriptions_router
from .usage import router as usage_router
from .onboarding import router as onboarding_router
from .billing import router as billing_router
from .feature_flags import router as feature_flags_router
from .admin import router as admin_router
from .clients import router as clients_router

router = APIRouter(prefix="/platform", tags=["Platform"])

router.include_router(plans_router)
router.include_router(subscriptions_router)
router.include_router(usage_router)
router.include_router(onboarding_router)
router.include_router(billing_router)
router.include_router(feature_flags_router)
router.include_router(admin_router)
router.include_router(clients_router)
