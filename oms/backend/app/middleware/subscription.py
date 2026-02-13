"""
Subscription Middleware - Enforces module access and usage limits per tenant.
Runs after auth, checks if tenant's plan includes the required module.
Also enforces usage limits (orders/month, users, locations, SKUs) on POST requests.
SUPER_ADMIN bypasses all checks.

Performance: subscription/module lookups are cached in-memory (5-min TTL)
to avoid hitting the database on every API request.
"""
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlmodel import Session, select, func

from app.core.database import engine

logger = logging.getLogger("subscription")

# ── In-memory TTL cache for subscription lookups ──────────────────────
# Key: company_id → { "data": {...}, "expires": timestamp }
_sub_cache: Dict[str, Dict[str, Any]] = {}
_SUB_CACHE_TTL = 300  # 5 minutes


def _cache_get(company_id: str) -> Optional[Dict[str, Any]]:
    """Get cached subscription data if not expired."""
    entry = _sub_cache.get(company_id)
    if entry and entry["expires"] > time.monotonic():
        return entry["data"]
    # Expired or missing — evict
    _sub_cache.pop(company_id, None)
    return None


def _cache_set(company_id: str, data: Dict[str, Any]) -> None:
    """Cache subscription data with TTL."""
    _sub_cache[company_id] = {
        "data": data,
        "expires": time.monotonic() + _SUB_CACHE_TTL,
    }
    # Lazy eviction: if cache grows large, drop expired entries
    if len(_sub_cache) > 500:
        now = time.monotonic()
        expired = [k for k, v in _sub_cache.items() if v["expires"] <= now]
        for k in expired:
            del _sub_cache[k]

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
    # CHANNELS & MARKETPLACE (part of OMS — order lifecycle)
    "/api/v1/channels": "OMS",
    "/api/v1/marketplaces": "OMS",
    "/api/v1/sku-mappings": "OMS",
    "/api/v1/order-sync": "OMS",
    "/api/v1/inventory-sync": "OMS",
    "/api/v1/marketplace-returns": "OMS",
    "/api/v1/scheduled-jobs": "OMS",
    "/api/v1/webhooks": "OMS",
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

        # ── Try cached subscription data first (avoids DB hit) ────────
        cached = _cache_get(company_id)
        if cached is not None:
            # Use cached result for module checks
            if cached.get("no_subscription") and not is_bypass:
                return JSONResponse(status_code=403, content=cached["response"])
            if cached.get("trial_expired") and not is_bypass:
                return JSONResponse(status_code=403, content=cached["response"])
            if required_module and required_module not in cached.get("modules", set()):
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "upgrade_required",
                        "message": f"The {required_module} module is not included in your {cached.get('plan_name', 'current')} plan.",
                        "module": required_module,
                        "currentPlan": cached.get("plan_slug"),
                        "upgradeUrl": "/settings/billing",
                    },
                )
            # Cached and allowed — skip usage limit check for GET (only POST needs it)
            if method != "POST":
                return await call_next(request)

        # ── Cache miss or POST request needing usage check — hit DB ───
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
                    resp = {
                        "error": "no_subscription",
                        "message": "No active subscription found. Please subscribe to a plan.",
                        "upgradeUrl": "/settings/billing",
                    }
                    _cache_set(company_id, {"no_subscription": True, "response": resp})
                    if is_bypass:
                        return await call_next(request)
                    return JSONResponse(status_code=403, content=resp)

                # Check trial expiry
                trial_expired = False
                if sub.status == "trialing" and sub.trialEndsAt:
                    if sub.trialEndsAt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                        trial_expired = True

                if trial_expired and not is_bypass:
                    resp = {
                        "error": "trial_expired",
                        "message": "Your free trial has expired. Please upgrade to continue.",
                        "upgradeUrl": "/settings/billing",
                    }
                    _cache_set(company_id, {"trial_expired": True, "response": resp})
                    return JSONResponse(status_code=403, content=resp)

                # Load all modules for this plan (single query, then cache)
                plan_modules = session.exec(
                    select(PlanModule.module)
                    .where(PlanModule.planId == sub.planId)
                ).all()
                module_set = set(plan_modules)

                # Get plan name for error messages
                plan = session.exec(
                    select(Plan).where(Plan.id == sub.planId)
                ).first()

                # Cache the subscription + modules
                _cache_set(company_id, {
                    "modules": module_set,
                    "plan_id": str(sub.planId),
                    "plan_name": plan.name if plan else "current",
                    "plan_slug": plan.slug if plan else None,
                    "status": sub.status,
                })

                # Check module access
                if required_module and required_module not in module_set:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "upgrade_required",
                            "message": f"The {required_module} module is not included in your {plan.name if plan else 'current'} plan.",
                            "module": required_module,
                            "currentPlan": plan.slug if plan else None,
                            "upgradeUrl": "/settings/billing",
                        },
                    )

                # ── Usage Limit Enforcement (POST requests only) ──────
                if method == "POST":
                    limit_config = _get_usage_limit_config(path)
                    if limit_config:
                        limit_key, model_ref, needs_monthly_filter = limit_config

                        plan_limit = session.exec(
                            select(PlanLimit)
                            .where(PlanLimit.planId == sub.planId)
                            .where(PlanLimit.limitKey == limit_key)
                        ).first()

                        if plan_limit and plan_limit.limitValue != -1:
                            max_allowed = plan_limit.limitValue
                            ModelClass = _get_model_class(model_ref)

                            count_query = (
                                select(func.count())
                                .select_from(ModelClass)
                                .where(ModelClass.companyId == company_id)
                            )

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
                                        "upgradeUrl": "/settings/billing",
                                    },
                                )

        except Exception as e:
            # Log error but don't block the request
            logger.warning(f"Subscription check failed for {path}: {e}")

        return await call_next(request)
