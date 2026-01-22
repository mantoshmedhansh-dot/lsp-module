"""
API v1 Router - All endpoints for version 1
"""
from fastapi import APIRouter

# Core routers
from .auth import router as auth_router
from .users import router as users_router
from .companies import router as companies_router
from .locations import router as locations_router
from .locations import zones_router, bins_router  # Direct zone/bin endpoints
from .skus import router as skus_router
from .inventory import router as inventory_router
from .orders import router as orders_router
from .customers import router as customers_router

# Business module routers
from .ndr import router as ndr_router
from .waves import router as waves_router
from .inbound import router as inbound_router
from .goods_receipt import router as goods_receipt_router
from .allocation import router as allocation_router
from .putaway import router as putaway_router
from .returns import router as returns_router
from .qc import router as qc_router
from .transporters import router as transporters_router

# Settings routers
from .settings import router as settings_router

# Extended module routers
from .procurement import router as procurement_router
from .b2b import router as b2b_router
from .wms_extended import router as wms_extended_router
from .finance import router as finance_router
from .logistics import router as logistics_router
from .channels import router as channels_router
from .communications import router as communications_router
from .analytics import router as analytics_router
from .system import router as system_router
from .dashboard import router as dashboard_router
from .ai_actions import router as ai_actions_router
from .sla import router as sla_router
from .control_tower import router as control_tower_router
from .detection_rules import router as detection_rules_router
from .shipments import router as shipments_router
from .b2b_logistics import router as b2b_logistics_router
from .channel_inventory import router as channel_inventory_router
from .packing import router as packing_router
from .ftl import router as ftl_router
from .ptl import router as ptl_router
from .allocation_config import router as allocation_config_router

# Main v1 router
router = APIRouter(prefix="/v1")

# Include core routers
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(companies_router)
router.include_router(locations_router)
router.include_router(zones_router)  # Direct /zones endpoints
router.include_router(bins_router)   # Direct /bins endpoints
router.include_router(skus_router)
router.include_router(inventory_router)
router.include_router(orders_router)
router.include_router(customers_router)

# Include business module routers
router.include_router(ndr_router)
router.include_router(waves_router)
router.include_router(inbound_router)
router.include_router(goods_receipt_router)
router.include_router(allocation_router)
router.include_router(putaway_router)
router.include_router(returns_router)
router.include_router(qc_router)
router.include_router(transporters_router)

# Include settings routers
router.include_router(settings_router)

# Include extended module routers
router.include_router(procurement_router)
router.include_router(b2b_router)
router.include_router(wms_extended_router)
router.include_router(finance_router)
router.include_router(logistics_router)
router.include_router(channels_router)
router.include_router(communications_router)
router.include_router(analytics_router)
router.include_router(system_router)
router.include_router(dashboard_router)
router.include_router(ai_actions_router)
router.include_router(sla_router)
router.include_router(control_tower_router)
router.include_router(detection_rules_router)
router.include_router(shipments_router)
router.include_router(b2b_logistics_router)
router.include_router(channel_inventory_router)
router.include_router(packing_router)
router.include_router(ftl_router)
router.include_router(ptl_router)
router.include_router(allocation_config_router)
