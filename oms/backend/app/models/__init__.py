"""
SQLModel Models for CJDQuick OMS
All database models and their request/response schemas
"""

# Base classes and utilities
from .base import (
    BaseModel,
    TimestampMixin,
    UUIDMixin,
    ActiveMixin,
    CompanyMixin,
    ResponseBase,
    CreateBase,
    UpdateBase,
)

# Enums
from .enums import (
    UserRole,
    BrandUserRole,
    LocationType,
    ZoneType,
    Channel,
    OrderType,
    PaymentMode,
    OrderStatus,
    ItemStatus,
    DeliveryStatus,
    InventoryValuationMethod,
    InboundType,
    InboundStatus,
    CustomerType,
    CustomerStatus,
    CreditStatus,
    PaymentTermType,
    CreditTransactionType,
    NDRReason,
    NDRStatus,
    NDRPriority,
    ResolutionType,
    OutreachChannel,
    OutreachStatus,
    CommunicationTrigger,
    WaveType,
    WaveStatus,
    PicklistStatus,
    ManifestStatus,
    QCType,
    QCStatus,
    QCParameterType,
    SeverityLevel,
    ReturnType,
    ReturnStatus,
    ReturnReason,
    ImportStatus,
    SyncFrequency,
    AIActionType,
    AIActionStatus,
    GatePassType,
    GatePassStatus,
    CycleCountStatus,
    CODReconciliationStatus,
    CODTransactionType,
    POStatus,
    TransporterType,
)

# User model and schemas
from .user import (
    User,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserBrief,
    UserLogin,
    UserLoginResponse,
)

# Company, Location, Zone, Bin models and schemas
from .company import (
    Company,
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyBrief,
    Location,
    LocationCreate,
    LocationUpdate,
    LocationResponse,
    LocationBrief,
    Zone,
    ZoneCreate,
    ZoneUpdate,
    ZoneResponse,
    Bin,
    BinCreate,
    BinUpdate,
    BinResponse,
)

# Brand model and schemas
from .brand import (
    Brand,
    BrandCreate,
    BrandUpdate,
    BrandResponse,
    BrandBrief,
)

# SKU model and schemas
from .sku import (
    SKU,
    SKUCreate,
    SKUUpdate,
    SKUResponse,
    SKUBrief,
)

# Inventory model and schemas
from .inventory import (
    Inventory,
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
    InventoryAdjustment,
    InventoryTransfer,
    InventorySummary,
)

# Order, OrderItem, Delivery models and schemas
from .order import (
    Order,
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderBrief,
    OrderItem,
    OrderItemCreate,
    OrderItemUpdate,
    OrderItemResponse,
    Delivery,
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryResponse,
)

# Customer, CustomerGroup models and schemas
from .customer import (
    Customer,
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerBrief,
    CustomerCreditUpdate,
    CustomerGroup,
    CustomerGroupCreate,
    CustomerGroupUpdate,
    CustomerGroupResponse,
    CustomerGroupBrief,
)

# NDR, NDROutreach, AIActionLog models and schemas
from .ndr import (
    NDR,
    NDRCreate,
    NDRUpdate,
    NDRResponse,
    NDRBrief,
    NDRSummary,
    NDRListItem,
    NDRListResponse,
    NDROrderInfo,
    NDRDeliveryInfo,
    NDROutreach,
    NDROutreachCreate,
    NDROutreachUpdate,
    NDROutreachResponse,
    AIActionLog,
    AIActionLogCreate,
    AIActionLogUpdate,
    AIActionLogResponse,
    OutreachSummary,
)

# Transporter and Manifest models and schemas
from .transporter import (
    Transporter,
    TransporterCreate,
    TransporterUpdate,
    TransporterResponse,
    TransporterBrief,
    TransporterConfig,
    TransporterConfigCreate,
    TransporterConfigUpdate,
    TransporterConfigResponse,
    Manifest,
    ManifestCreate,
    ManifestUpdate,
    ManifestResponse,
    ManifestBrief,
    TransporterSummary,
    ManifestSummary,
)

# QC models and schemas
from .qc import (
    QCTemplate,
    QCTemplateCreate,
    QCTemplateUpdate,
    QCTemplateResponse,
    QCParameter,
    QCParameterCreate,
    QCParameterUpdate,
    QCParameterResponse,
    QCExecution,
    QCExecutionCreate,
    QCExecutionUpdate,
    QCExecutionResponse,
    QCResult,
    QCResultCreate,
    QCResultUpdate,
    QCResultResponse,
    QCDefect,
    QCDefectCreate,
    QCDefectUpdate,
    QCDefectResponse,
    QCSummary,
)

# Return models and schemas
from .returns import (
    Return,
    ReturnCreate,
    ReturnUpdate,
    ReturnResponse,
    ReturnBrief,
    ReturnItem,
    ReturnItemCreate,
    ReturnItemUpdate,
    ReturnItemResponse,
    ReturnSummary,
)

# Inbound models and schemas
from .inbound import (
    Inbound,
    InboundCreate,
    InboundUpdate,
    InboundResponse,
    InboundBrief,
    InboundItem,
    InboundItemCreate,
    InboundItemUpdate,
    InboundItemResponse,
    InboundSummary,
)

# Wave, WaveItem, WaveOrder, Picklist models and schemas
from .wave import (
    Wave,
    WaveCreate,
    WaveUpdate,
    WaveResponse,
    WaveBrief,
    WaveSummary,
    WaveItem,
    WaveItemCreate,
    WaveItemUpdate,
    WaveItemResponse,
    WaveItemDistribution,
    WaveOrder,
    WaveOrderCreate,
    WaveOrderUpdate,
    WaveOrderResponse,
    Picklist,
    PicklistCreate,
    PicklistUpdate,
    PicklistResponse,
    PicklistItem,
    PicklistItemCreate,
    PicklistItemUpdate,
    PicklistItemResponse,
    PicklistSummary,
)

# Procurement models and schemas
from .procurement import (
    Vendor,
    VendorCreate,
    VendorUpdate,
    VendorResponse,
    VendorBrief,
    PurchaseOrder,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderResponse,
    POItem,
    POItemCreate,
    POItemUpdate,
    POItemResponse,
)

# B2B models and schemas
from .b2b import (
    PriceList,
    PriceListCreate,
    PriceListUpdate,
    PriceListResponse,
    PriceListItem,
    PriceListItemCreate,
    PriceListItemUpdate,
    PriceListItemResponse,
    PricingTier,
    PricingTierCreate,
    PricingTierResponse,
    Quotation,
    QuotationCreate,
    QuotationUpdate,
    QuotationResponse,
    QuotationItem,
    QuotationItemCreate,
    QuotationItemResponse,
    B2BCreditTransaction,
    B2BCreditTransactionCreate,
    B2BCreditTransactionResponse,
)

# WMS Extended models and schemas
from .wms_extended import (
    CycleCount,
    CycleCountCreate,
    CycleCountUpdate,
    CycleCountResponse,
    CycleCountItem,
    CycleCountItemCreate,
    CycleCountItemUpdate,
    CycleCountItemResponse,
    GatePass,
    GatePassCreate,
    GatePassUpdate,
    GatePassResponse,
    GatePassItem,
    GatePassItemCreate,
    GatePassItemResponse,
    StockAdjustment,
    StockAdjustmentCreate,
    StockAdjustmentResponse,
    StockAdjustmentItem,
    StockAdjustmentItemCreate,
    StockAdjustmentItemResponse,
    InventoryMovement,
    InventoryMovementCreate,
    InventoryMovementResponse,
    VirtualInventory,
    VirtualInventoryCreate,
    VirtualInventoryUpdate,
    VirtualInventoryResponse,
)

# Finance models and schemas
from .finance import (
    CODReconciliation,
    CODReconciliationCreate,
    CODReconciliationUpdate,
    CODReconciliationResponse,
    CODTransaction,
    CODTransactionCreate,
    CODTransactionResponse,
)

# Logistics Extended models and schemas
from .logistics_extended import (
    RateCard,
    RateCardCreate,
    RateCardUpdate,
    RateCardResponse,
    RateCardSlab,
    RateCardSlabCreate,
    RateCardSlabResponse,
    ShippingRule,
    ShippingRuleCreate,
    ShippingRuleUpdate,
    ShippingRuleResponse,
    ShippingRuleCondition,
    ShippingRuleConditionCreate,
    ShippingRuleConditionResponse,
    ServicePincode,
    ServicePincodeCreate,
    ServicePincodeUpdate,
    ServicePincodeResponse,
    AWB,
    AWBCreate,
    AWBResponse,
)

# SKU Extended models and schemas
from .sku_extended import (
    SKUBundle,
    SKUBundleCreate,
    SKUBundleUpdate,
    SKUBundleResponse,
    BundleItem,
    BundleItemCreate,
    BundleItemResponse,
    VariantAttribute,
    VariantAttributeCreate,
    VariantAttributeUpdate,
    VariantAttributeResponse,
    VariantAttributeValue,
    VariantAttributeValueCreate,
    VariantAttributeValueResponse,
    SKUVariant,
    SKUVariantCreate,
    SKUVariantResponse,
    SKUVariantValue,
    SKUVariantValueResponse,
    SKUBrand,
    SKUBrandCreate,
    SKUBrandResponse,
)

# Channel models and schemas
from .channels import (
    ChannelConfig,
    ChannelConfigCreate,
    ChannelConfigUpdate,
    ChannelConfigResponse,
    OrderImport,
    OrderImportCreate,
    OrderImportUpdate,
    OrderImportResponse,
    OrderImportSummary,
)

# Communication models and schemas
from .communications import (
    CommunicationTemplate,
    CommunicationTemplateCreate,
    CommunicationTemplateUpdate,
    CommunicationTemplateResponse,
    ProactiveCommunication,
    ProactiveCommunicationCreate,
    ProactiveCommunicationUpdate,
    ProactiveCommunicationResponse,
)

# Analytics models and schemas
from .analytics import (
    AnalyticsSnapshot,
    AnalyticsSnapshotCreate,
    AnalyticsSnapshotResponse,
    DemandForecast,
    DemandForecastCreate,
    DemandForecastResponse,
    ScheduledReport,
    ScheduledReportCreate,
    ScheduledReportUpdate,
    ScheduledReportResponse,
    ReportExecution,
    ReportExecutionCreate,
    ReportExecutionResponse,
)

# System models and schemas
from .system import (
    AuditLog,
    AuditLogCreate,
    AuditLogResponse,
    Exception,
    ExceptionCreate,
    ExceptionUpdate,
    ExceptionResponse,
    Sequence,
    SequenceCreate,
    SequenceResponse,
    Session,
    SessionCreate,
    SessionResponse,
    BrandUser,
    BrandUserCreate,
    BrandUserUpdate,
    BrandUserResponse,
)

# Detection Rule models and schemas
from .detection_rule import (
    DetectionRule,
    DetectionRuleCreate,
    DetectionRuleUpdate,
    DetectionRuleResponse,
    DetectionRuleBrief,
    RuleType,
    EntityType,
    Operator,
    AIActionType as RuleAIActionType,
)

__all__ = [
    # Base
    "BaseModel",
    "TimestampMixin",
    "UUIDMixin",
    "ActiveMixin",
    "CompanyMixin",
    "ResponseBase",
    "CreateBase",
    "UpdateBase",
    # Enums (all)
    "UserRole",
    "BrandUserRole",
    "LocationType",
    "ZoneType",
    "Channel",
    "OrderType",
    "PaymentMode",
    "OrderStatus",
    "ItemStatus",
    "DeliveryStatus",
    "InventoryValuationMethod",
    "InboundType",
    "InboundStatus",
    "CustomerType",
    "CustomerStatus",
    "CreditStatus",
    "PaymentTermType",
    "CreditTransactionType",
    "NDRReason",
    "NDRStatus",
    "NDRPriority",
    "ResolutionType",
    "OutreachChannel",
    "OutreachStatus",
    "CommunicationTrigger",
    "WaveType",
    "WaveStatus",
    "PicklistStatus",
    "ManifestStatus",
    "QCType",
    "QCStatus",
    "QCParameterType",
    "SeverityLevel",
    "ReturnType",
    "ReturnStatus",
    "ReturnReason",
    "ImportStatus",
    "SyncFrequency",
    "AIActionType",
    "AIActionStatus",
    "GatePassType",
    "GatePassStatus",
    "CycleCountStatus",
    "CODReconciliationStatus",
    "CODTransactionType",
    "POStatus",
    "TransporterType",
    # User
    "User",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserBrief",
    "UserLogin",
    "UserLoginResponse",
    # Company
    "Company",
    "CompanyCreate",
    "CompanyUpdate",
    "CompanyResponse",
    "CompanyBrief",
    # Location
    "Location",
    "LocationCreate",
    "LocationUpdate",
    "LocationResponse",
    "LocationBrief",
    # Zone
    "Zone",
    "ZoneCreate",
    "ZoneUpdate",
    "ZoneResponse",
    # Bin
    "Bin",
    "BinCreate",
    "BinUpdate",
    "BinResponse",
    # Brand
    "Brand",
    "BrandCreate",
    "BrandUpdate",
    "BrandResponse",
    "BrandBrief",
    # SKU
    "SKU",
    "SKUCreate",
    "SKUUpdate",
    "SKUResponse",
    "SKUBrief",
    # Inventory
    "Inventory",
    "InventoryCreate",
    "InventoryUpdate",
    "InventoryResponse",
    "InventoryAdjustment",
    "InventoryTransfer",
    "InventorySummary",
    # Order
    "Order",
    "OrderCreate",
    "OrderUpdate",
    "OrderResponse",
    "OrderBrief",
    # OrderItem
    "OrderItem",
    "OrderItemCreate",
    "OrderItemUpdate",
    "OrderItemResponse",
    # Delivery
    "Delivery",
    "DeliveryCreate",
    "DeliveryUpdate",
    "DeliveryResponse",
    # Customer
    "Customer",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    "CustomerBrief",
    "CustomerCreditUpdate",
    # CustomerGroup
    "CustomerGroup",
    "CustomerGroupCreate",
    "CustomerGroupUpdate",
    "CustomerGroupResponse",
    "CustomerGroupBrief",
    # NDR
    "NDR",
    "NDRCreate",
    "NDRUpdate",
    "NDRResponse",
    "NDRBrief",
    "NDRSummary",
    # NDROutreach
    "NDROutreach",
    "NDROutreachCreate",
    "NDROutreachUpdate",
    "NDROutreachResponse",
    "OutreachSummary",
    # AIActionLog
    "AIActionLog",
    "AIActionLogCreate",
    "AIActionLogUpdate",
    "AIActionLogResponse",
    # Transporter
    "Transporter",
    "TransporterCreate",
    "TransporterUpdate",
    "TransporterResponse",
    "TransporterBrief",
    "TransporterSummary",
    # TransporterConfig
    "TransporterConfig",
    "TransporterConfigCreate",
    "TransporterConfigUpdate",
    "TransporterConfigResponse",
    # Manifest
    "Manifest",
    "ManifestCreate",
    "ManifestUpdate",
    "ManifestResponse",
    "ManifestBrief",
    "ManifestSummary",
    # QCTemplate
    "QCTemplate",
    "QCTemplateCreate",
    "QCTemplateUpdate",
    "QCTemplateResponse",
    # QCParameter
    "QCParameter",
    "QCParameterCreate",
    "QCParameterUpdate",
    "QCParameterResponse",
    # QCExecution
    "QCExecution",
    "QCExecutionCreate",
    "QCExecutionUpdate",
    "QCExecutionResponse",
    # QCResult
    "QCResult",
    "QCResultCreate",
    "QCResultUpdate",
    "QCResultResponse",
    # QCDefect
    "QCDefect",
    "QCDefectCreate",
    "QCDefectUpdate",
    "QCDefectResponse",
    "QCSummary",
    # Return
    "Return",
    "ReturnCreate",
    "ReturnUpdate",
    "ReturnResponse",
    "ReturnBrief",
    "ReturnSummary",
    # ReturnItem
    "ReturnItem",
    "ReturnItemCreate",
    "ReturnItemUpdate",
    "ReturnItemResponse",
    # Inbound
    "Inbound",
    "InboundCreate",
    "InboundUpdate",
    "InboundResponse",
    "InboundBrief",
    "InboundSummary",
    # InboundItem
    "InboundItem",
    "InboundItemCreate",
    "InboundItemUpdate",
    "InboundItemResponse",
    # Wave
    "Wave",
    "WaveCreate",
    "WaveUpdate",
    "WaveResponse",
    "WaveBrief",
    "WaveSummary",
    # WaveItem
    "WaveItem",
    "WaveItemCreate",
    "WaveItemUpdate",
    "WaveItemResponse",
    "WaveItemDistribution",
    # WaveOrder
    "WaveOrder",
    "WaveOrderCreate",
    "WaveOrderUpdate",
    "WaveOrderResponse",
    # Picklist
    "Picklist",
    "PicklistCreate",
    "PicklistUpdate",
    "PicklistResponse",
    "PicklistSummary",
    # PicklistItem
    "PicklistItem",
    "PicklistItemCreate",
    "PicklistItemUpdate",
    "PicklistItemResponse",
    # Vendor
    "Vendor",
    "VendorCreate",
    "VendorUpdate",
    "VendorResponse",
    "VendorBrief",
    # PurchaseOrder
    "PurchaseOrder",
    "PurchaseOrderCreate",
    "PurchaseOrderUpdate",
    "PurchaseOrderResponse",
    # POItem
    "POItem",
    "POItemCreate",
    "POItemUpdate",
    "POItemResponse",
    # PriceList
    "PriceList",
    "PriceListCreate",
    "PriceListUpdate",
    "PriceListResponse",
    # PriceListItem
    "PriceListItem",
    "PriceListItemCreate",
    "PriceListItemUpdate",
    "PriceListItemResponse",
    # PricingTier
    "PricingTier",
    "PricingTierCreate",
    "PricingTierResponse",
    # Quotation
    "Quotation",
    "QuotationCreate",
    "QuotationUpdate",
    "QuotationResponse",
    # QuotationItem
    "QuotationItem",
    "QuotationItemCreate",
    "QuotationItemResponse",
    # B2BCreditTransaction
    "B2BCreditTransaction",
    "B2BCreditTransactionCreate",
    "B2BCreditTransactionResponse",
    # CycleCount
    "CycleCount",
    "CycleCountCreate",
    "CycleCountUpdate",
    "CycleCountResponse",
    # CycleCountItem
    "CycleCountItem",
    "CycleCountItemCreate",
    "CycleCountItemUpdate",
    "CycleCountItemResponse",
    # GatePass
    "GatePass",
    "GatePassCreate",
    "GatePassUpdate",
    "GatePassResponse",
    # GatePassItem
    "GatePassItem",
    "GatePassItemCreate",
    "GatePassItemResponse",
    # StockAdjustment
    "StockAdjustment",
    "StockAdjustmentCreate",
    "StockAdjustmentResponse",
    # StockAdjustmentItem
    "StockAdjustmentItem",
    "StockAdjustmentItemCreate",
    "StockAdjustmentItemResponse",
    # InventoryMovement
    "InventoryMovement",
    "InventoryMovementCreate",
    "InventoryMovementResponse",
    # VirtualInventory
    "VirtualInventory",
    "VirtualInventoryCreate",
    "VirtualInventoryUpdate",
    "VirtualInventoryResponse",
    # CODReconciliation
    "CODReconciliation",
    "CODReconciliationCreate",
    "CODReconciliationUpdate",
    "CODReconciliationResponse",
    # CODTransaction
    "CODTransaction",
    "CODTransactionCreate",
    "CODTransactionResponse",
    # RateCard
    "RateCard",
    "RateCardCreate",
    "RateCardUpdate",
    "RateCardResponse",
    # RateCardSlab
    "RateCardSlab",
    "RateCardSlabCreate",
    "RateCardSlabResponse",
    # ShippingRule
    "ShippingRule",
    "ShippingRuleCreate",
    "ShippingRuleUpdate",
    "ShippingRuleResponse",
    # ShippingRuleCondition
    "ShippingRuleCondition",
    "ShippingRuleConditionCreate",
    "ShippingRuleConditionResponse",
    # ServicePincode
    "ServicePincode",
    "ServicePincodeCreate",
    "ServicePincodeUpdate",
    "ServicePincodeResponse",
    # AWB
    "AWB",
    "AWBCreate",
    "AWBResponse",
    # SKUBundle
    "SKUBundle",
    "SKUBundleCreate",
    "SKUBundleUpdate",
    "SKUBundleResponse",
    # BundleItem
    "BundleItem",
    "BundleItemCreate",
    "BundleItemResponse",
    # VariantAttribute
    "VariantAttribute",
    "VariantAttributeCreate",
    "VariantAttributeUpdate",
    "VariantAttributeResponse",
    # VariantAttributeValue
    "VariantAttributeValue",
    "VariantAttributeValueCreate",
    "VariantAttributeValueResponse",
    # SKUVariant
    "SKUVariant",
    "SKUVariantCreate",
    "SKUVariantResponse",
    # SKUVariantValue
    "SKUVariantValue",
    "SKUVariantValueResponse",
    # SKUBrand
    "SKUBrand",
    "SKUBrandCreate",
    "SKUBrandResponse",
    # ChannelConfig
    "ChannelConfig",
    "ChannelConfigCreate",
    "ChannelConfigUpdate",
    "ChannelConfigResponse",
    # OrderImport
    "OrderImport",
    "OrderImportCreate",
    "OrderImportUpdate",
    "OrderImportResponse",
    "OrderImportSummary",
    # CommunicationTemplate
    "CommunicationTemplate",
    "CommunicationTemplateCreate",
    "CommunicationTemplateUpdate",
    "CommunicationTemplateResponse",
    # ProactiveCommunication
    "ProactiveCommunication",
    "ProactiveCommunicationCreate",
    "ProactiveCommunicationUpdate",
    "ProactiveCommunicationResponse",
    # AnalyticsSnapshot
    "AnalyticsSnapshot",
    "AnalyticsSnapshotCreate",
    "AnalyticsSnapshotResponse",
    # DemandForecast
    "DemandForecast",
    "DemandForecastCreate",
    "DemandForecastResponse",
    # ScheduledReport
    "ScheduledReport",
    "ScheduledReportCreate",
    "ScheduledReportUpdate",
    "ScheduledReportResponse",
    # ReportExecution
    "ReportExecution",
    "ReportExecutionCreate",
    "ReportExecutionResponse",
    # AuditLog
    "AuditLog",
    "AuditLogCreate",
    "AuditLogResponse",
    # Exception
    "Exception",
    "ExceptionCreate",
    "ExceptionUpdate",
    "ExceptionResponse",
    # Sequence
    "Sequence",
    "SequenceCreate",
    "SequenceResponse",
    # Session
    "Session",
    "SessionCreate",
    "SessionResponse",
    # BrandUser
    "BrandUser",
    "BrandUserCreate",
    "BrandUserUpdate",
    "BrandUserResponse",
]
