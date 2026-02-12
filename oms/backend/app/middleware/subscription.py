"""
Subscription Middleware - Enforces module access and usage limits per tenant.
Runs after auth, checks if tenant's plan includes the required module.
Also enforces usage limits (orders/month, users, locations, SKUs) on POST requests.
SUPER_ADMIN bypasses all checks.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlmodel import Session, select, func

from app.core.database import engine

logger = logging.getLogger("subscription")

# Map POST endpoints to (limitKey, model_import_path, needs_monthly_filter)
# These are checked only on POST (create) requests
USAGE_LIMIT_MAP = {
    "/api/v1/orders": ("orders_per_month", "order.Order", True),
    "/api/v1/users": ("users", "user.User", False),
    "/api/v1/locations": ("locations", "company.Location", False),
    "/api/v1/skus": ("skus", "sku.SKU", False),
}

# Map API path prefixes to module keys
PATH_MODULE_MAP = {
    # OMS (core - all plans)
    "/api/v1/orders": "OMS",
    "/api/v1/customers": "OMS",
    "/api/v1/b2b": "OMS",
    "/api/v1/preorders": "OMS",
    "/api/v1/subscriptions": "OMS",
    "/api/v1/dashboard": "OMS",
    # WMS
    "/api/v1/goods-receipt": "WMS",
    "/api/v1/asn": "WMS",
    "/api/v1/inbound": "WMS",
    "/api/v1/inventory": "WMS",
    "/api/v1/waves": "WMS",
    "/api/v1/picklists": "WMS",
    "/api/v1/packing": "WMS",
    "/api/v1/putaway": "WMS",
    "/api/v1/allocation": "WMS",
    "/api/v1/qc": "WMS",
    "/api/v1/returns": "WMS",
    "/api/v1/zones": "WMS",
    "/api/v1/bins": "WMS",
    "/api/v1/wms": "WMS",
    "/api/v1/labor": "WMS",
    "/api/v1/slotting": "WMS",
    "/api/v1/voice": "WMS",
    "/api/v1/cross-dock": "WMS",
    "/api/v1/stock-transfer": "WMS",
    "/api/v1/reconciliation": "WMS",
    "/api/v1/mobile": "WMS",
    # LOGISTICS
    "/api/v1/shipments": "LOGISTICS",
    "/api/v1/transporters": "LOGISTICS",
    "/api/v1/logistics": "LOGISTICS",
    "/api/v1/ftl": "LOGISTICS",
    "/api/v1/ptl": "LOGISTICS",
    "/api/v1/allocation-config": "LOGISTICS",
    "/api/v1/b2b-logistics": "LOGISTICS",
    # CONTROL_TOWER
    "/api/v1/control-tower": "CONTROL_TOWER",
    "/api/v1/ndr": "CONTROL_TOWER",
    "/api/v1/detection-rules": "CONTROL_TOWER",
    "/api/v1/ai-actions": "CONTROL_TOWER",
    "/api/v1/sla": "CONTROL_TOWER",
    # FINANCE
    "/api/v1/finance": "FINANCE",
    "/api/v1/settlements": "FINANCE",
    # ANALYTICS
    "/api/v1/analytics": "ANALYTICS",
    # CHANNELS
    "/api/v1/channels": "CHANNELS",
    "/api/v1/marketplaces": "CHANNELS",
    "/api/v1/sku-mappings": "CHANNELS",
    "/api/v1/order-sync": "CHANNELS",
    "/api/v1/inventory-sync": "CHANNELS",
    "/api/v1/marketplace-returns": "CHANNELS",
    "/api/v1/scheduled-jobs": "CHANNELS",
    "/api/v1/webhooks": "CHANNELS",
}

# Paths that bypass subscription checks entirely
BYPASS_PATHS = {
    "/api/v1/auth",
    "/api/v1/platform",
    "/api/v1/users",
    "/api/v1/companies",
    "/api/v1/brands",
    "/api/v1/locations",
    "/api/v1/skus",
    "/api/v1/api-keys",
    "/api/v1/settings",
    "/api/v1/external-orders",
    "/api/v1/upload-batch",
    "/api/v1/communications",
    "/api/v1/system",
    "/api/v1/procurement",
}


def _get_required_module(path: str) -> Optional[str]:
    """Map an API path to the required module key."""
    for prefix, module in PATH_MODULE_MAP.items():
        if path.startswith(prefix):
            return module
    return None


def _get_usage_limit_config(path: str) -> Optional[Tuple[str, str, bool]]:
    """
    For a given path, return the usage limit config if this endpoint is limit-checked.
    Returns (limitKey, model_ref, needs_monthly_filter) or None.
    Only exact prefix matches (e.g. /api/v1/orders but not /api/v1/orders/123).
    """
    for prefix, config in USAGE_LIMIT_MAP.items():
        # Match the exact prefix or prefix + query string (not sub-paths like /orders/123)
        if path == prefix or path == prefix + "/":
            return config
    return None


def _get_model_class(model_ref: str):
    """Dynamically import and return the model class from app.models."""
    module_name, class_name = model_ref.split(".")
    import importlib
    mod = importlib.import_module(f"app.models.{module_name}")
    return getattr(mod, class_name)


class SubscriptionMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces subscription-based module access.
    - Checks if the tenant's plan includes the required module
    - SUPER_ADMIN bypasses all checks
    - Unauthenticated requests pass through (auth middleware handles them)
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        method = request.method

        # Skip non-API paths, health checks, docs
        if not path.startswith("/api/v1/"):
            return await call_next(request)

        # Get user info from request headers (set by auth)
        user_id = request.headers.get("X-User-Id")
        user_role = request.headers.get("X-User-Role")

        # If no user info, let auth handle it
        if not user_id:
            return await call_next(request)

        # SUPER_ADMIN bypasses all subscription checks
        if user_role == "SUPER_ADMIN":
            return await call_next(request)

        # Get company ID
        company_id = request.headers.get("X-Company-Id")
        if not company_id:
            return await call_next(request)

        # Determine if this is a bypass path (skip module check but may still need usage limit check)
        is_bypass = any(path.startswith(bp) for bp in BYPASS_PATHS)

        # Determine required module (only for non-bypass paths)
        required_module = None if is_bypass else _get_required_module(path)

        # If not a bypass path and no module mapping found, let it through
        if not is_bypass and not required_module:
            return await call_next(request)

        # Check subscription and module access
        try:
            with Session(engine) as session:
                from app.models.tenant_subscription import TenantSubscription
                from app.models.plan import Plan, PlanModule, PlanLimit

                # Get active subscription for company
                sub = session.exec(
                    select(TenantSubscription)
                    .where(TenantSubscription.companyId == company_id)
                    .where(TenantSubscription.status.in_(["active", "trialing"]))
                    .order_by(TenantSubscription.createdAt.desc())
                ).first()

                if not sub:
                    # For bypass paths, don't block on missing subscription
                    if is_bypass:
                        return await call_next(request)
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "no_subscription",
                            "message": "No active subscription found. Please subscribe to a plan.",
                            "upgradeUrl": "/settings/billing"
                        }
                    )

                # Check trial expiry (only for non-bypass paths)
                if not is_bypass and sub.status == "trialing" and sub.trialEndsAt:
                    if sub.trialEndsAt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                        return JSONResponse(
                            status_code=403,
                            content={
                                "error": "trial_expired",
                                "message": "Your free trial has expired. Please upgrade to continue.",
                                "upgradeUrl": "/settings/billing"
                            }
                        )

                # Check if plan includes the required module (skip for bypass paths)
                if required_module:
                    module_exists = session.exec(
                        select(PlanModule)
                        .where(PlanModule.planId == sub.planId)
                        .where(PlanModule.module == required_module)
                    ).first()

                    if not module_exists:
                        plan = session.exec(
                            select(Plan).where(Plan.id == sub.planId)
                        ).first()
                        return JSONResponse(
                            status_code=403,
                            content={
                                "error": "upgrade_required",
                                "message": f"The {required_module} module is not included in your {plan.name if plan else 'current'} plan.",
                                "module": required_module,
                                "currentPlan": plan.slug if plan else None,
                                "upgradeUrl": "/settings/billing"
                            }
                        )

                # ============================================================
                # Usage Limit Enforcement (POST requests only)
                # ============================================================
                if method == "POST":
                    limit_config = _get_usage_limit_config(path)
                    if limit_config:
                        limit_key, model_ref, needs_monthly_filter = limit_config

                        # Look up the plan limit for this key
                        plan_limit = session.exec(
                            select(PlanLimit)
                            .where(PlanLimit.planId == sub.planId)
                            .where(PlanLimit.limitKey == limit_key)
                        ).first()

                        # If no limit row exists or limitValue is -1, treat as unlimited
                        if plan_limit and plan_limit.limitValue != -1:
                            max_allowed = plan_limit.limitValue

                            # Get the actual model class for counting
                            ModelClass = _get_model_class(model_ref)

                            # Build the count query
                            count_query = (
                                select(func.count())
                                .select_from(ModelClass)
                                .where(ModelClass.companyId == company_id)
                            )

                            # For orders, filter by current month
                            if needs_monthly_filter:
                                now = datetime.now(timezone.utc)
                                month_start = now.replace(
                                    day=1, hour=0, minute=0, second=0, microsecond=0
                                )
                                count_query = count_query.where(
                                    ModelClass.createdAt >= month_start
                                )

                            current_count = session.exec(count_query).one()

                            if current_count >= max_allowed:
                                logger.info(
                                    f"Usage limit exceeded for company {company_id}: "
                                    f"{limit_key} = {current_count}/{max_allowed}"
                                )
                                return JSONResponse(
                                    status_code=403,
                                    content={
                                        "error": "limit_exceeded",
                                        "limitKey": limit_key,
                                        "current": current_count,
                                        "limit": max_allowed,
                                        "upgradeUrl": "/settings/billing"
                                    }
                                )

        except Exception as e:
            # Log error but don't block the request
            logger.warning(f"Subscription check failed for {path}: {e}")

        return await call_next(request)
