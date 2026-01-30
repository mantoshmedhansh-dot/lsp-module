"""
Enum Definitions for SQLModel
All enums used across the OMS system
"""
from enum import Enum


# ============================================================================
# User & Access Enums
# ============================================================================

class UserRole(str, Enum):
    """User roles for access control"""
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    OPERATOR = "OPERATOR"
    PICKER = "PICKER"
    PACKER = "PACKER"
    VIEWER = "VIEWER"
    CLIENT = "CLIENT"


class BrandUserRole(str, Enum):
    """Roles for brand portal users"""
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"


# ============================================================================
# Location & Warehouse Enums
# ============================================================================

class LocationType(str, Enum):
    """Types of fulfillment locations"""
    WAREHOUSE = "WAREHOUSE"
    STORE = "STORE"
    HUB = "HUB"
    VIRTUAL = "VIRTUAL"


class ZoneType(str, Enum):
    """Types of warehouse zones"""
    SALEABLE = "SALEABLE"
    DAMAGED = "DAMAGED"
    QC = "QC"
    RETURNS = "RETURNS"
    DISPATCH = "DISPATCH"
    RECEIVING = "RECEIVING"
    BULK = "BULK"
    PICK = "PICK"
    STAGING = "STAGING"
    COLD = "COLD"
    FROZEN = "FROZEN"
    HAZMAT = "HAZMAT"


class BinType(str, Enum):
    """Types of storage bins"""
    FLOOR = "FLOOR"
    SHELF = "SHELF"
    PALLET = "PALLET"
    PICK_FACE = "PICK_FACE"
    RESERVE = "RESERVE"
    STAGING = "STAGING"
    QC_HOLD = "QC_HOLD"


class TemperatureType(str, Enum):
    """Temperature classification for zones"""
    AMBIENT = "AMBIENT"
    COLD = "COLD"
    FROZEN = "FROZEN"


# ============================================================================
# Order & Fulfillment Enums
# ============================================================================

class Channel(str, Enum):
    """Sales channels"""
    AMAZON = "AMAZON"
    FLIPKART = "FLIPKART"
    MYNTRA = "MYNTRA"
    AJIO = "AJIO"
    MEESHO = "MEESHO"
    NYKAA = "NYKAA"
    TATA_CLIQ = "TATA_CLIQ"
    JIOMART = "JIOMART"
    SHOPIFY = "SHOPIFY"
    WOOCOMMERCE = "WOOCOMMERCE"
    WEBSITE = "WEBSITE"
    MANUAL = "MANUAL"
    B2B = "B2B"


class OrderType(str, Enum):
    """Order types"""
    B2C = "B2C"
    B2B = "B2B"


class PaymentMode(str, Enum):
    """Payment modes"""
    PREPAID = "PREPAID"
    COD = "COD"
    CREDIT = "CREDIT"


class OrderStatus(str, Enum):
    """Order lifecycle status"""
    CREATED = "CREATED"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    ALLOCATED = "ALLOCATED"
    PARTIALLY_ALLOCATED = "PARTIALLY_ALLOCATED"
    PICKLIST_GENERATED = "PICKLIST_GENERATED"
    PICKING = "PICKING"
    PICKED = "PICKED"
    PACKING = "PACKING"
    PACKED = "PACKED"
    INVOICED = "INVOICED"
    MANIFESTED = "MANIFESTED"
    SHIPPED = "SHIPPED"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    RTO_INITIATED = "RTO_INITIATED"
    RTO_IN_TRANSIT = "RTO_IN_TRANSIT"
    RTO_DELIVERED = "RTO_DELIVERED"
    CANCELLED = "CANCELLED"
    ON_HOLD = "ON_HOLD"


class ItemStatus(str, Enum):
    """Order item status"""
    PENDING = "PENDING"
    ALLOCATED = "ALLOCATED"
    PICKED = "PICKED"
    PACKED = "PACKED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    RETURNED = "RETURNED"


class DeliveryStatus(str, Enum):
    """Delivery/shipment status"""
    PENDING = "PENDING"
    PACKED = "PACKED"
    MANIFESTED = "MANIFESTED"
    SHIPPED = "SHIPPED"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    NDR = "NDR"
    RTO = "RTO"
    RTO_INITIATED = "RTO_INITIATED"
    RTO_IN_TRANSIT = "RTO_IN_TRANSIT"
    RTO_DELIVERED = "RTO_DELIVERED"
    CANCELLED = "CANCELLED"


# ============================================================================
# Inventory Enums
# ============================================================================

class InventoryValuationMethod(str, Enum):
    """Inventory valuation methods"""
    FIFO = "FIFO"
    LIFO = "LIFO"
    FEFO = "FEFO"
    WAC = "WAC"


class InboundType(str, Enum):
    """Inbound receipt types"""
    PURCHASE_ORDER = "PURCHASE_ORDER"
    RETURN = "RETURN"
    TRANSFER = "TRANSFER"
    ADJUSTMENT = "ADJUSTMENT"


class InboundStatus(str, Enum):
    """Inbound receipt status"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class GoodsReceiptStatus(str, Enum):
    """Goods receipt document status"""
    DRAFT = "DRAFT"
    RECEIVING = "RECEIVING"
    POSTED = "POSTED"
    REVERSED = "REVERSED"
    CANCELLED = "CANCELLED"


class PutawayTaskStatus(str, Enum):
    """Putaway task status"""
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class AllocationStatus(str, Enum):
    """Inventory allocation status"""
    ALLOCATED = "ALLOCATED"
    PICKED = "PICKED"
    CANCELLED = "CANCELLED"


class StockAdjustmentStatus(str, Enum):
    """Stock adjustment workflow status"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    POSTED = "POSTED"


class AdjustmentReasonCode(str, Enum):
    """Reason codes for stock adjustments"""
    CYCLE_COUNT = "CYCLE_COUNT"
    DAMAGE = "DAMAGE"
    THEFT = "THEFT"
    EXPIRED = "EXPIRED"
    FOUND = "FOUND"
    CORRECTION = "CORRECTION"
    WRITE_OFF = "WRITE_OFF"
    OTHER = "OTHER"


class MovementType(str, Enum):
    """Goods movement type codes"""
    GR_PURCHASE = "101"      # Goods Receipt from Purchase Order
    GR_REVERSAL = "102"      # Reversal of Goods Receipt
    GR_RETURN = "103"        # Goods Receipt from Return
    GI_SALES = "201"         # Goods Issue for Sales
    GI_REVERSAL = "202"      # Reversal of Goods Issue
    TRANSFER = "301"         # Stock Transfer between locations
    ADJUSTMENT_PLUS = "501"  # Positive Adjustment
    ADJUSTMENT_MINUS = "502" # Negative Adjustment


# ============================================================================
# Customer & B2B Enums
# ============================================================================

class CustomerType(str, Enum):
    """Customer types"""
    RETAIL = "RETAIL"
    WHOLESALE = "WHOLESALE"
    DISTRIBUTOR = "DISTRIBUTOR"
    FRANCHISE = "FRANCHISE"


class CustomerStatus(str, Enum):
    """Customer account status"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    BLOCKED = "BLOCKED"


class CreditStatus(str, Enum):
    """Credit status for B2B customers"""
    AVAILABLE = "AVAILABLE"
    EXHAUSTED = "EXHAUSTED"
    ON_HOLD = "ON_HOLD"
    OVERDUE = "OVERDUE"


class PaymentTermType(str, Enum):
    """Payment term types"""
    IMMEDIATE = "IMMEDIATE"
    NET_7 = "NET_7"
    NET_15 = "NET_15"
    NET_30 = "NET_30"
    NET_45 = "NET_45"
    NET_60 = "NET_60"
    CUSTOM = "CUSTOM"


class CreditTransactionType(str, Enum):
    """Credit transaction types"""
    CREDIT_LIMIT_SET = "CREDIT_LIMIT_SET"
    CREDIT_LIMIT_INCREASE = "CREDIT_LIMIT_INCREASE"
    CREDIT_LIMIT_DECREASE = "CREDIT_LIMIT_DECREASE"
    ORDER_PLACED = "ORDER_PLACED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    REFUND = "REFUND"


# ============================================================================
# NDR & Communication Enums
# ============================================================================

class NDRReason(str, Enum):
    """NDR (Non-Delivery Report) reasons"""
    CUSTOMER_UNAVAILABLE = "CUSTOMER_UNAVAILABLE"
    WRONG_ADDRESS = "WRONG_ADDRESS"
    INCOMPLETE_ADDRESS = "INCOMPLETE_ADDRESS"
    CUSTOMER_REFUSED = "CUSTOMER_REFUSED"
    COD_NOT_READY = "COD_NOT_READY"
    PHONE_UNREACHABLE = "PHONE_UNREACHABLE"
    DELIVERY_RESCHEDULED = "DELIVERY_RESCHEDULED"
    ADDRESS_NOT_FOUND = "ADDRESS_NOT_FOUND"
    AREA_NOT_SERVICEABLE = "AREA_NOT_SERVICEABLE"
    NATURAL_DISASTER = "NATURAL_DISASTER"
    OTHER = "OTHER"


class NDRStatus(str, Enum):
    """NDR resolution status"""
    OPEN = "OPEN"
    ACTION_REQUESTED = "ACTION_REQUESTED"
    REATTEMPT_SCHEDULED = "REATTEMPT_SCHEDULED"
    RESOLVED = "RESOLVED"
    RTO = "RTO"
    CLOSED = "CLOSED"


class NDRPriority(str, Enum):
    """NDR priority levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ResolutionType(str, Enum):
    """NDR resolution types"""
    REATTEMPT = "REATTEMPT"
    ADDRESS_UPDATED = "ADDRESS_UPDATED"
    PHONE_UPDATED = "PHONE_UPDATED"
    RESCHEDULE = "RESCHEDULE"
    RTO = "RTO"
    CUSTOMER_PICKUP = "CUSTOMER_PICKUP"


class OutreachChannel(str, Enum):
    """Communication channels"""
    SMS = "SMS"
    EMAIL = "EMAIL"
    WHATSAPP = "WHATSAPP"
    VOICE = "VOICE"
    IVR = "IVR"


class OutreachStatus(str, Enum):
    """Outreach attempt status"""
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    RESPONDED = "RESPONDED"
    FAILED = "FAILED"


class CommunicationTrigger(str, Enum):
    """Communication trigger events"""
    ORDER_CONFIRMED = "ORDER_CONFIRMED"
    ORDER_SHIPPED = "ORDER_SHIPPED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    NDR_FIRST_ATTEMPT = "NDR_FIRST_ATTEMPT"
    NDR_FOLLOWUP = "NDR_FOLLOWUP"
    RTO_INITIATED = "RTO_INITIATED"


# ============================================================================
# Wave & Fulfillment Enums
# ============================================================================

class WaveType(str, Enum):
    """Wave picking types"""
    BATCH_PICK = "BATCH_PICK"
    ZONE_PICK = "ZONE_PICK"
    CLUSTER_PICK = "CLUSTER_PICK"
    PRIORITY_PICK = "PRIORITY_PICK"


class WaveStatus(str, Enum):
    """Wave picking status"""
    DRAFT = "DRAFT"
    PLANNED = "PLANNED"
    RELEASED = "RELEASED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PicklistStatus(str, Enum):
    """Picklist status"""
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ManifestStatus(str, Enum):
    """Manifest status"""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    HANDED_OVER = "HANDED_OVER"
    CANCELLED = "CANCELLED"


# ============================================================================
# QC Enums
# ============================================================================

class QCType(str, Enum):
    """QC template types"""
    INBOUND = "INBOUND"
    RETURN = "RETURN"
    PRODUCTION = "PRODUCTION"
    CYCLE_COUNT = "CYCLE_COUNT"
    RANDOM_AUDIT = "RANDOM_AUDIT"


class QCStatus(str, Enum):
    """QC execution status"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    PASSED = "PASSED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"
    CONDITIONAL = "CONDITIONAL"


class QCParameterType(str, Enum):
    """QC parameter types"""
    VISUAL = "VISUAL"
    DIMENSIONAL = "DIMENSIONAL"
    WEIGHT = "WEIGHT"
    BARCODE = "BARCODE"
    FUNCTIONAL = "FUNCTIONAL"
    DOCUMENTATION = "DOCUMENTATION"


class SeverityLevel(str, Enum):
    """Defect severity levels"""
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"
    COSMETIC = "COSMETIC"


# ============================================================================
# Return Enums
# ============================================================================

class ReturnType(str, Enum):
    """Return types"""
    CUSTOMER_RETURN = "CUSTOMER_RETURN"
    RTO = "RTO"
    EXCHANGE = "EXCHANGE"


class ReturnStatus(str, Enum):
    """Return processing status"""
    INITIATED = "INITIATED"
    PICKUP_SCHEDULED = "PICKUP_SCHEDULED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    QC_PENDING = "QC_PENDING"
    QC_PASSED = "QC_PASSED"
    QC_FAILED = "QC_FAILED"
    PROCESSED = "PROCESSED"
    REFUND_INITIATED = "REFUND_INITIATED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ReturnReason(str, Enum):
    """Return reasons"""
    WRONG_PRODUCT = "WRONG_PRODUCT"
    DAMAGED = "DAMAGED"
    DEFECTIVE = "DEFECTIVE"
    SIZE_ISSUE = "SIZE_ISSUE"
    COLOR_MISMATCH = "COLOR_MISMATCH"
    NOT_AS_DESCRIBED = "NOT_AS_DESCRIBED"
    CHANGED_MIND = "CHANGED_MIND"
    LATE_DELIVERY = "LATE_DELIVERY"
    OTHER = "OTHER"


# ============================================================================
# Import & Sync Enums
# ============================================================================

class ImportStatus(str, Enum):
    """Import job status"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class SyncFrequency(str, Enum):
    """Channel sync frequency"""
    REALTIME = "REALTIME"
    EVERY_5_MINS = "EVERY_5_MINS"
    EVERY_15_MINS = "EVERY_15_MINS"
    EVERY_30_MINS = "EVERY_30_MINS"
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    MANUAL = "MANUAL"


# ============================================================================
# AI Action Enums
# ============================================================================

class AIActionType(str, Enum):
    """AI action types"""
    NDR_CLASSIFICATION = "NDR_CLASSIFICATION"
    NDR_RESOLUTION = "NDR_RESOLUTION"
    FRAUD_DETECTION = "FRAUD_DETECTION"
    DEMAND_FORECAST = "DEMAND_FORECAST"
    CARRIER_SELECTION = "CARRIER_SELECTION"


class AIActionStatus(str, Enum):
    """AI action status"""
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"


# ============================================================================
# Other Enums
# ============================================================================

class GatePassType(str, Enum):
    """Gate pass types"""
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
    VISITOR = "VISITOR"
    VEHICLE = "VEHICLE"


class GatePassStatus(str, Enum):
    """Gate pass status"""
    OPEN = "OPEN"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class CycleCountStatus(str, Enum):
    """Cycle count status"""
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class CODReconciliationStatus(str, Enum):
    """COD reconciliation status"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    RECONCILED = "RECONCILED"
    DISPUTED = "DISPUTED"
    CLOSED = "CLOSED"


class CODTransactionType(str, Enum):
    """COD transaction types"""
    COLLECTION = "COLLECTION"
    REMITTANCE = "REMITTANCE"
    ADJUSTMENT = "ADJUSTMENT"
    REFUND = "REFUND"


class POStatus(str, Enum):
    """Purchase order status"""
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    SENT = "SENT"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class TransporterType(str, Enum):
    """Transporter/carrier types"""
    COURIER = "COURIER"
    SELF = "SELF"
    AGGREGATOR = "AGGREGATOR"


# ============================================================================
# Logistics & Shipping Allocation Enums (Phase 1 - 2026-01-21)
# ============================================================================

class ShipmentType(str, Enum):
    """Shipment type for allocation engine"""
    FTL = "FTL"          # Full Truck Load
    B2B_PTL = "B2B_PTL"  # B2B Part Truck Load / LTL
    B2C = "B2C"          # B2C Courier/Express


class VehicleCategory(str, Enum):
    """FTL vehicle categories"""
    TATA_ACE = "TATA_ACE"         # 750 kg
    PICKUP_8FT = "PICKUP_8FT"     # 1 ton
    PICKUP_14FT = "PICKUP_14FT"   # 2.5 ton
    TAURUS_16FT = "TAURUS_16FT"   # 4 ton
    TRUCK_19FT = "TRUCK_19FT"     # 7 ton
    TRUCK_22FT = "TRUCK_22FT"     # 9 ton
    TRUCK_24FT = "TRUCK_24FT"     # 14 ton
    TRUCK_32FT = "TRUCK_32FT"     # 15 ton
    TRAILER_40FT = "TRAILER_40FT" # 21 ton
    CONTAINER_20FT = "CONTAINER_20FT"  # 20 ton
    CONTAINER_40FT = "CONTAINER_40FT"  # 26 ton


class AllocationMode(str, Enum):
    """Shipping allocation mode"""
    AUTO = "AUTO"        # Fully automatic based on CSR scoring
    MANUAL = "MANUAL"    # Manual carrier selection
    HYBRID = "HYBRID"    # Auto-suggest with manual confirmation


class FTLIndentStatus(str, Enum):
    """FTL Indent/Trip status"""
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    VEHICLE_ASSIGNED = "VEHICLE_ASSIGNED"
    LOADING = "LOADING"
    IN_TRANSIT = "IN_TRANSIT"
    UNLOADING = "UNLOADING"
    DELIVERED = "DELIVERED"
    POD_RECEIVED = "POD_RECEIVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PTLBookingStatus(str, Enum):
    """PTL/B2B Booking status"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PICKUP_SCHEDULED = "PICKUP_SCHEDULED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    POD_PENDING = "POD_PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class RateMatrixType(str, Enum):
    """Rate matrix types"""
    WEIGHT_BASED = "WEIGHT_BASED"      # Standard weight slab
    LANE_BASED = "LANE_BASED"          # Origin-Destination
    MATRIX = "MATRIX"                  # N×N O-D with weight slabs


class PerformanceMetricType(str, Enum):
    """Carrier performance metric types"""
    COST = "COST"                  # Cost efficiency
    SPEED = "SPEED"                # Delivery speed (TAT)
    RELIABILITY = "RELIABILITY"    # On-time delivery rate
    SUCCESS_RATE = "SUCCESS_RATE"  # Delivery success rate
    RTO_RATE = "RTO_RATE"          # Return to origin rate
    DAMAGE_RATE = "DAMAGE_RATE"    # Damage/loss rate


class AllocationDecisionReason(str, Enum):
    """Reason for allocation decision (audit trail)"""
    BEST_CSR_SCORE = "BEST_CSR_SCORE"
    LOWEST_COST = "LOWEST_COST"
    FASTEST_TAT = "FASTEST_TAT"
    HIGHEST_RELIABILITY = "HIGHEST_RELIABILITY"
    RULE_MATCHED = "RULE_MATCHED"
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"
    FALLBACK = "FALLBACK"
    ONLY_SERVICEABLE = "ONLY_SERVICEABLE"
