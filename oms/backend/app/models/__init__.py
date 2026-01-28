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
    BinType,
    TemperatureType,
    Channel,
    OrderType,
    PaymentMode,
    OrderStatus,
    ItemStatus,
    DeliveryStatus,
    InventoryValuationMethod,
    InboundType,
    InboundStatus,
    GoodsReceiptStatus,
    PutawayTaskStatus,
    AllocationStatus,
    StockAdjustmentStatus,
    AdjustmentReasonCode,
    MovementType,
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
    # Logistics Allocation Enums (Phase 1)
    ShipmentType,
    VehicleCategory,
    AllocationMode,
    FTLIndentStatus,
    PTLBookingStatus,
    RateMatrixType,
    PerformanceMetricType,
    AllocationDecisionReason,
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
    ZoneBrief,
    Bin,
    BinCreate,
    BinUpdate,
    BinResponse,
    BinBrief,
    BinBulkCreate,
    BinCapacityResponse,
)

# Brand model and schemas
from .brand import (
    Brand,
    BrandCreate,
    BrandUpdate,
    BrandResponse,
    BrandBrief,
)

# API Key model and schemas
from .api_key import (
    APIKey,
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyResponse,
    APIKeyCreatedResponse,
)

# External Order schemas
from .external_order import (
    ExternalOrderCreate,
    ExternalOrderResponse,
    ExternalOrderError,
    ExternalBulkOrderCreate,
    ExternalBulkOrderResponse,
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
    # Phase 4: WMS Integration
    ReturnZoneRouting,
    ReturnReceiveRequest,
    ReturnItemReceive,
    ReturnQCRequest,
    ReturnItemQC,
    ReturnRestockRequest,
    ReturnItemRestock,
    ReturnZoneRoutingCreate,
    ReturnZoneRoutingResponse,
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

# Goods Receipt models and schemas
from .goods_receipt import (
    GoodsReceipt,
    GoodsReceiptCreate,
    GoodsReceiptUpdate,
    GoodsReceiptResponse,
    GoodsReceiptBrief,
    GoodsReceiptWithItems,
    GoodsReceiptItem,
    GoodsReceiptItemCreate,
    GoodsReceiptItemUpdate,
    GoodsReceiptItemResponse,
    # Phase 2: Create from source schemas
    GRNFromExternalPOCreate,
    GRNFromASNCreate,
    GRNFromReturnCreate,
    GRNFromSTOCreate,
)

# Inventory Allocation models and schemas
from .inventory_allocation import (
    InventoryAllocation,
    InventoryAllocationCreate,
    InventoryAllocationUpdate,
    InventoryAllocationResponse,
    InventoryAllocationBrief,
    AllocationRequest,
    AllocationResult,
    BulkAllocationRequest,
    BulkAllocationResult,
    DeallocationRequest,
    ConfirmPickRequest,
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

# Shipment models and schemas (B2C Courier)
from .shipment import (
    Shipment,
    ShipmentCreate,
    ShipmentUpdate,
    ShipmentResponse,
    ShipmentBrief,
    ShipmentStats,
)

# B2B Logistics models and schemas
from .b2b_logistics import (
    # Enums
    LRStatus,
    VehicleType,
    FreightPaymentMode,
    BookingType,
    BookingStatus,
    ProductType,
    # Models
    B2BConsignee,
    LorryReceipt,
    B2BBooking,
    # Schemas
    B2BConsigneeCreate,
    B2BConsigneeUpdate,
    B2BConsigneeResponse,
    LorryReceiptCreate,
    LorryReceiptUpdate,
    LorryReceiptResponse,
    LorryReceiptBrief,
    B2BBookingCreate,
    B2BBookingUpdate,
    B2BBookingResponse,
    B2BLogisticsStats,
)

# Putaway models and schemas
from .putaway import (
    PutawayTask,
    PutawayTaskCreate,
    PutawayTaskUpdate,
    PutawayTaskAssign,
    PutawayTaskComplete,
    PutawayTaskCancel,
    PutawayTaskResponse,
    PutawayTaskBrief,
    BinSuggestion,
    BinSuggestionRequest,
    BinSuggestionResponse,
    BulkPutawayTaskCreate,
    BulkPutawayTaskResponse,
)

# Channel Inventory models and schemas
from .channel_inventory import (
    ChannelInventoryRule,
    ChannelInventoryRuleCreate,
    ChannelInventoryRuleUpdate,
    ChannelInventoryRuleResponse,
    ChannelInventory,
    ChannelInventoryCreate,
    ChannelInventoryUpdate,
    ChannelInventoryResponse,
    ChannelInventorySummary,
    ChannelAllocationItem,
    GRNChannelAllocationRequest,
)

# External PO models and schemas (WMS Inbound Phase 1)
from .external_po import (
    ExternalPurchaseOrder,
    ExternalPurchaseOrderCreate,
    ExternalPurchaseOrderUpdate,
    ExternalPurchaseOrderRead,
    ExternalPOItem,
    ExternalPOItemCreate,
    ExternalPOItemUpdate,
    ExternalPOItemRead,
)

# ASN models and schemas (WMS Inbound Phase 1)
from .asn import (
    AdvanceShippingNotice,
    AdvanceShippingNoticeCreate,
    AdvanceShippingNoticeUpdate,
    AdvanceShippingNoticeRead,
    ASNItem,
    ASNItemCreate,
    ASNItemUpdate,
    ASNItemRead,
)

# Upload Batch models and schemas (WMS Inbound Phase 1)
from .upload_batch import (
    UploadBatch,
    UploadBatchCreate,
    UploadBatchUpdate,
    UploadBatchRead,
    UploadError,
    ExternalPOUploadRow,
    ASNUploadRow,
    OpeningStockUploadRow,
    UploadResult,
)

# Stock Transfer Order models and schemas (WMS Inbound Phase 3)
from .stock_transfer import (
    StockTransferOrder,
    StockTransferOrderCreate,
    StockTransferOrderUpdate,
    StockTransferOrderRead,
    STOItem,
    STOItemCreate,
    STOItemUpdate,
    STOItemRead,
    STOApproveRequest,
    STOShipRequest,
    STOReceiveRequest,
    STOItemReceive,
)

# Shipping Allocation models and schemas (Phase 1 - Logistics)
from .shipping_allocation import (
    # FTL Models
    FTLVehicleTypeMaster,
    FTLVendor,
    FTLLaneRate,
    FTLIndent,
    # PTL/B2B Models
    PTLRateMatrix,
    PTLTATMatrix,
    # Performance Models
    CarrierPerformance,
    PincodePerformance,
    LanePerformance,
    # Allocation Engine Models
    CSRScoreConfig,
    ShippingAllocationRule,
    AllocationAudit,
    # FTL Response Schemas
    FTLVehicleTypeMasterResponse,
    FTLVendorResponse,
    FTLLaneRateResponse,
    # FTL Create/Update Schemas
    FTLVehicleTypeMasterCreate,
    FTLVehicleTypeMasterUpdate,
    FTLVendorCreate,
    FTLVendorUpdate,
    FTLLaneRateCreate,
    FTLLaneRateUpdate,
    # PTL Response Schemas
    PTLRateMatrixResponse,
    PTLTATMatrixResponse,
    # PTL Create/Update Schemas
    PTLRateMatrixCreate,
    PTLRateMatrixUpdate,
    PTLTATMatrixCreate,
    PTLTATMatrixUpdate,
    # Allocation Response Schemas
    CSRScoreConfigResponse,
    AllocationAuditResponse,
    ShippingAllocationRuleResponse,
    # Allocation Create/Update Schemas
    CSRScoreConfigCreate,
    CSRScoreConfigUpdate,
    ShippingAllocationRuleCreate,
    ShippingAllocationRuleUpdate,
    # Performance Response Schemas
    CarrierPerformanceResponse,
    PincodePerformanceResponse,
    LanePerformanceResponse,
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
    "ZoneBrief",
    # Bin
    "Bin",
    "BinCreate",
    "BinUpdate",
    "BinResponse",
    "BinBrief",
    "BinBulkCreate",
    "BinCapacityResponse",
    # WMS Enums
    "BinType",
    "TemperatureType",
    "GoodsReceiptStatus",
    "PutawayTaskStatus",
    "AllocationStatus",
    "StockAdjustmentStatus",
    "AdjustmentReasonCode",
    "MovementType",
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
    # GoodsReceipt
    "GoodsReceipt",
    "GoodsReceiptCreate",
    "GoodsReceiptUpdate",
    "GoodsReceiptResponse",
    "GoodsReceiptBrief",
    "GoodsReceiptWithItems",
    # GoodsReceiptItem
    "GoodsReceiptItem",
    "GoodsReceiptItemCreate",
    "GoodsReceiptItemUpdate",
    "GoodsReceiptItemResponse",
    # GRN from Source (Phase 2)
    "GRNFromExternalPOCreate",
    "GRNFromASNCreate",
    "GRNFromReturnCreate",
    "GRNFromSTOCreate",
    # InventoryAllocation
    "InventoryAllocation",
    "InventoryAllocationCreate",
    "InventoryAllocationUpdate",
    "InventoryAllocationResponse",
    "InventoryAllocationBrief",
    "AllocationRequest",
    "AllocationResult",
    "BulkAllocationRequest",
    "BulkAllocationResult",
    "DeallocationRequest",
    "ConfirmPickRequest",
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
    # Shipment (B2C Courier)
    "Shipment",
    "ShipmentCreate",
    "ShipmentUpdate",
    "ShipmentResponse",
    "ShipmentBrief",
    "ShipmentStats",
    # B2B Logistics Enums
    "LRStatus",
    "VehicleType",
    "FreightPaymentMode",
    "BookingType",
    "BookingStatus",
    "ProductType",
    # B2BConsignee
    "B2BConsignee",
    "B2BConsigneeCreate",
    "B2BConsigneeUpdate",
    "B2BConsigneeResponse",
    # LorryReceipt
    "LorryReceipt",
    "LorryReceiptCreate",
    "LorryReceiptUpdate",
    "LorryReceiptResponse",
    "LorryReceiptBrief",
    # B2BBooking
    "B2BBooking",
    "B2BBookingCreate",
    "B2BBookingUpdate",
    "B2BBookingResponse",
    # B2B Logistics Stats
    "B2BLogisticsStats",
    # PutawayTask
    "PutawayTask",
    "PutawayTaskCreate",
    "PutawayTaskUpdate",
    "PutawayTaskAssign",
    "PutawayTaskComplete",
    "PutawayTaskCancel",
    "PutawayTaskResponse",
    "PutawayTaskBrief",
    # Bin Suggestion
    "BinSuggestion",
    "BinSuggestionRequest",
    "BinSuggestionResponse",
    "BulkPutawayTaskCreate",
    "BulkPutawayTaskResponse",
    # ChannelInventoryRule
    "ChannelInventoryRule",
    "ChannelInventoryRuleCreate",
    "ChannelInventoryRuleUpdate",
    "ChannelInventoryRuleResponse",
    # ChannelInventory
    "ChannelInventory",
    "ChannelInventoryCreate",
    "ChannelInventoryUpdate",
    "ChannelInventoryResponse",
    "ChannelInventorySummary",
    # Channel Allocation
    "ChannelAllocationItem",
    "GRNChannelAllocationRequest",
    # Logistics Allocation Enums (Phase 1)
    "ShipmentType",
    "VehicleCategory",
    "AllocationMode",
    "FTLIndentStatus",
    "PTLBookingStatus",
    "RateMatrixType",
    "PerformanceMetricType",
    "AllocationDecisionReason",
    # FTL Models
    "FTLVehicleTypeMaster",
    "FTLVendor",
    "FTLLaneRate",
    "FTLIndent",
    # PTL/B2B Models
    "PTLRateMatrix",
    "PTLTATMatrix",
    # Performance Models
    "CarrierPerformance",
    "PincodePerformance",
    "LanePerformance",
    # Allocation Engine Models
    "CSRScoreConfig",
    "ShippingAllocationRule",
    "AllocationAudit",
    # FTL Response Schemas
    "FTLVehicleTypeMasterResponse",
    "FTLVendorResponse",
    "FTLLaneRateResponse",
    # FTL Create/Update Schemas
    "FTLVehicleTypeMasterCreate",
    "FTLVehicleTypeMasterUpdate",
    "FTLVendorCreate",
    "FTLVendorUpdate",
    "FTLLaneRateCreate",
    "FTLLaneRateUpdate",
    # PTL Response Schemas
    "PTLRateMatrixResponse",
    "PTLTATMatrixResponse",
    # PTL Create/Update Schemas
    "PTLRateMatrixCreate",
    "PTLRateMatrixUpdate",
    "PTLTATMatrixCreate",
    "PTLTATMatrixUpdate",
    # Allocation Response Schemas
    "CSRScoreConfigResponse",
    "AllocationAuditResponse",
    "ShippingAllocationRuleResponse",
    # Allocation Create/Update Schemas
    "CSRScoreConfigCreate",
    "CSRScoreConfigUpdate",
    "ShippingAllocationRuleCreate",
    "ShippingAllocationRuleUpdate",
    # Performance Response Schemas
    "CarrierPerformanceResponse",
    "PincodePerformanceResponse",
    "LanePerformanceResponse",
    # External PO (WMS Inbound Phase 1)
    "ExternalPurchaseOrder",
    "ExternalPurchaseOrderCreate",
    "ExternalPurchaseOrderUpdate",
    "ExternalPurchaseOrderRead",
    "ExternalPOItem",
    "ExternalPOItemCreate",
    "ExternalPOItemUpdate",
    "ExternalPOItemRead",
    # ASN (WMS Inbound Phase 1)
    "AdvanceShippingNotice",
    "AdvanceShippingNoticeCreate",
    "AdvanceShippingNoticeUpdate",
    "AdvanceShippingNoticeRead",
    "ASNItem",
    "ASNItemCreate",
    "ASNItemUpdate",
    "ASNItemRead",
    # Upload Batch (WMS Inbound Phase 1)
    "UploadBatch",
    "UploadBatchCreate",
    "UploadBatchUpdate",
    "UploadBatchRead",
    "UploadError",
    "ExternalPOUploadRow",
    "ASNUploadRow",
    "OpeningStockUploadRow",
    "UploadResult",
    # Stock Transfer Order (WMS Inbound Phase 3)
    "StockTransferOrder",
    "StockTransferOrderCreate",
    "StockTransferOrderUpdate",
    "StockTransferOrderRead",
    "STOItem",
    "STOItemCreate",
    "STOItemUpdate",
    "STOItemRead",
    "STOApproveRequest",
    "STOShipRequest",
    "STOReceiveRequest",
    "STOItemReceive",
]
