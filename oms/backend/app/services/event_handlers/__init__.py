"""
Event Handlers — Auto-registers all @on() handlers at import time.

Import this package in main.py lifespan to activate all event-driven triggers.
"""
from . import order_fulfillment
from . import returns_wms
from . import finance_automation
from . import ndr_comms
from . import marketplace_sync
from . import inventory_alerts
from . import saas_lifecycle
