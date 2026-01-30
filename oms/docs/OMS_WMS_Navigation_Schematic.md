# OMS/WMS Navigation & Module Connection Schematic

**Generated:** 2026-01-30
**Purpose:** System architecture visualization, duplicate identification, and module interconnections

---

## 1. MASTER NAVIGATION STRUCTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OMS/WMS FRONTEND NAVIGATION                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐    │
│  │   COMMAND CENTER    │   │   ORDER LIFECYCLE   │   │ WAREHOUSE OPERATIONS│    │
│  │   ───────────────   │   │   ───────────────   │   │   ───────────────   │    │
│  │  • Dashboard        │   │  • Orders           │   │  • Inbound          │    │
│  │  • Control Tower ⭐ │   │  • B2B Sales        │   │  • Inventory        │    │
│  │  • NDR Management   │   │                     │   │  • Fulfillment      │    │
│  └─────────────────────┘   └─────────────────────┘   │  • Returns          │    │
│                                                       └─────────────────────┘    │
│  ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐    │
│  │ LOGISTICS & DELIVERY│   │    PROCUREMENT      │   │  FINANCE & REPORTS  │    │
│  │   ───────────────   │   │   ───────────────   │   │   ───────────────   │    │
│  │  • Shipments        │   │  • Purchase Orders⚠️│   │  • Finance          │    │
│  │  • FTL              │   │  • Vendors          │   │  • Reports          │    │
│  │  • PTL              │   │  • Performance      │   │  • Analytics        │    │
│  │  • B2C/Courier      │   └─────────────────────┘   └─────────────────────┘    │
│  │  • Allocation Engine│                                                         │
│  │  • Analytics        │   ┌─────────────────────────────────────────────────┐  │
│  └─────────────────────┘   │               CONFIGURATION                     │  │
│                            │  Masters | Warehouse | Logistics | Channels     │  │
│                            │  QC | Workflows | Billing | Integrations        │  │
│                            └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘

⭐ = Central Intelligence Hub     ⚠️ = Duplicate Detected
```

---

## 2. DUPLICATE PAGES IDENTIFICATION

### CRITICAL DUPLICATES

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ⚠️ DUPLICATE #1: PURCHASE ORDERS                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   LOCATION 1:                          LOCATION 2:                              │
│   /inbound/purchase-orders             /procurement/purchase-orders             │
│   ─────────────────────────            ─────────────────────────                │
│   • Context: Receiving goods           • Context: Creating POs                  │
│   • Focus: Track expected arrivals     • Focus: Vendor management               │
│   • API: Same endpoints                • API: Same endpoints                    │
│                                                                                  │
│   RESOLUTION: Single page at /procurement/purchase-orders                       │
│               Add "Pending Receipts" filter for inbound context                 │
│               Redirect /inbound/purchase-orders → /procurement/purchase-orders  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ⚠️ DUPLICATE #2: NDR MANAGEMENT                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   LOCATION 1:                          LOCATION 2:                              │
│   /ndr                                 /control-tower/ndr                       │
│   ─────────────────────────            ─────────────────────────                │
│   • Basic NDR queue                    • AI-powered NDR command center          │
│   • Manual outreach only               • Rule-based detection                   │
│   • Simple status tracking             • Automated actions                      │
│   • No predictions                     • Predictive insights                    │
│                                                                                  │
│   RESOLUTION: Keep /control-tower/ndr as PRIMARY                                │
│               /ndr becomes simplified operational view (read-only queue)        │
│               OR redirect /ndr → /control-tower/ndr                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ⚠️ DUPLICATE #3: ALLOCATION RULES                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   LOCATION 1:                          LOCATION 2:                              │
│   /setup/allocation-rules              /logistics/allocation/rules              │
│   ─────────────────────────            ─────────────────────────                │
│   • In Configuration section           • In Logistics section                   │
│   • Same functionality                 • Same functionality                     │
│                                                                                  │
│   RESOLUTION: Keep /logistics/allocation/rules only                             │
│               Remove /setup/allocation-rules                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CONTROL TOWER - CENTRAL INTELLIGENCE HUB

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ⭐ CONTROL TOWER DATA FLOW                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              ┌─────────────────┐                                │
│                              │  CONTROL TOWER  │                                │
│                              │  ─────────────  │                                │
│                              │  • Dashboard    │                                │
│                              │  • AI Insights  │                                │
│                              │  • Predictions  │                                │
│                              └────────┬────────┘                                │
│                                       │                                          │
│         ┌─────────────────────────────┼─────────────────────────────┐           │
│         │                             │                             │           │
│         ▼                             ▼                             ▼           │
│  ┌─────────────┐              ┌─────────────┐              ┌─────────────┐      │
│  │   ORDERS    │              │  SHIPMENTS  │              │  INVENTORY  │      │
│  │ ─────────── │              │ ─────────── │              │ ─────────── │      │
│  │ /api/v1/    │              │ /api/v1/    │              │ /api/v1/    │      │
│  │ orders      │              │ shipments   │              │ inventory   │      │
│  └──────┬──────┘              └──────┬──────┘              └──────┬──────┘      │
│         │                             │                             │           │
│         └─────────────────────────────┼─────────────────────────────┘           │
│                                       │                                          │
│                                       ▼                                          │
│                        ┌──────────────────────────┐                             │
│                        │    CONTROL TOWER APIS    │                             │
│                        │    ──────────────────    │                             │
│                        │ GET /api/v1/control-tower│                             │
│                        │ GET /api/v1/control-tower/insights                     │
│                        │ GET /api/v1/control-tower/capacity                     │
│                        │ GET /api/v1/control-tower/ndr-summary                  │
│                        │ GET /api/v1/control-tower/exceptions                   │
│                        │ GET /api/v1/control-tower/ai-actions                   │
│                        └──────────────────────────┘                             │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  METRICS PULLED FROM:                                                           │
│  ─────────────────────                                                          │
│  • Orders: Total, Pending, D0/D1/D2 performance, SLA breaches                  │
│  • Shipments: In-transit, Delivered, Failed, Carrier performance               │
│  • Inventory: Stock levels, Low stock alerts, Aging inventory                  │
│  • NDR: Open cases, Resolution rate, Escalations                               │
│  • Warehouse: Capacity utilization, Processing velocity                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. NDR (NON-DELIVERY REPORT) DATA FLOW

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           NDR MODULE DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   SHIPMENT TRACKING                    NDR CREATION                             │
│   ─────────────────                    ────────────                              │
│                                                                                  │
│   ┌─────────────┐     Delivery       ┌─────────────┐                           │
│   │  SHIPMENT   │───── Failed ──────▶│     NDR     │                           │
│   │  DISPATCHED │                     │   CREATED   │                           │
│   └─────────────┘                     └──────┬──────┘                           │
│                                              │                                   │
│                                              ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐       │
│   │                         NDR PROCESSING                               │       │
│   │                         ──────────────                               │       │
│   │                                                                      │       │
│   │   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │       │
│   │   │   /ndr        │    │/control-tower │    │  OUTREACH     │       │       │
│   │   │  (Basic)      │    │    /ndr       │    │  CHANNELS     │       │       │
│   │   │               │    │  (AI Hub)     │    │               │       │       │
│   │   │ • View queue  │    │ • AI detect   │    │ • WhatsApp    │       │       │
│   │   │ • Manual act  │    │ • Auto rules  │    │ • SMS         │       │       │
│   │   │               │    │ • Predictions │    │ • AI Voice    │       │       │
│   │   └───────────────┘    └───────────────┘    │ • Email       │       │       │
│   │                                              └───────────────┘       │       │
│   └─────────────────────────────────────────────────────────────────────┘       │
│                                              │                                   │
│                                              ▼                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐       │
│   │                         NDR RESOLUTION                               │       │
│   │   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │       │
│   │   │   REATTEMPT   │    │    RTO        │    │  DELIVERED    │       │       │
│   │   │   Scheduled   │    │   (Return)    │    │   (Success)   │       │       │
│   │   └───────────────┘    └───────────────┘    └───────────────┘       │       │
│   └─────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  NDR APIS:                                                                      │
│  ─────────                                                                      │
│  GET  /api/v1/ndr                    - List NDR cases                          │
│  GET  /api/v1/ndr/summary            - NDR statistics                          │
│  GET  /api/v1/ndr/{id}               - NDR detail                              │
│  POST /api/v1/ndr/{id}/outreach      - Send outreach (WhatsApp/SMS/Voice)      │
│  POST /api/v1/ndr/{id}/reattempt     - Schedule reattempt                      │
│  POST /api/v1/ndr/{id}/rto           - Mark for return                         │
│  GET  /api/v1/control-tower/ndr-summary - AI-enhanced NDR summary              │
│  POST /api/v1/control-tower/ndr-action/execute - Execute AI action             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. ALLOCATION ENGINE DATA FLOW

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ALLOCATION ENGINE DATA FLOW                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ORDER CREATED                                                                  │
│  ─────────────                                                                  │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │                     ALLOCATION ENGINE                                │        │
│  │                     ─────────────────                                │        │
│  │                                                                      │        │
│  │  INPUTS:                          PROCESS:                           │        │
│  │  ────────                         ────────                           │        │
│  │  ┌─────────────┐                  1. Read allocation rules          │        │
│  │  │   ORDER     │                  2. Check inventory by location    │        │
│  │  │ • SKUs      │                  3. Match CSR (Carrier-Service-    │        │
│  │  │ • Qty       │                     Route) configuration           │        │
│  │  │ • Ship-to   │                  4. Calculate optimal allocation   │        │
│  │  └─────────────┘                  5. Reserve inventory              │        │
│  │                                   6. Assign carrier                 │        │
│  │  ┌─────────────┐                                                    │        │
│  │  │  INVENTORY  │                  RULES EVALUATED:                  │        │
│  │  │ • Stock     │                  ─────────────────                 │        │
│  │  │ • Location  │                  • Zone-based routing              │        │
│  │  │ • Channel   │                  • Carrier SLA match               │        │
│  │  └─────────────┘                  • Cost optimization               │        │
│  │                                   • Stock availability              │        │
│  │  ┌─────────────┐                  • Channel priority                │        │
│  │  │   RULES     │                                                    │        │
│  │  │ • Priority  │                                                    │        │
│  │  │ • Zones     │                                                    │        │
│  │  │ • Carriers  │                                                    │        │
│  │  └─────────────┘                                                    │        │
│  │                                                                      │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│       │                                                                          │
│       ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐        │
│  │                      ALLOCATION OUTPUT                               │        │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │        │
│  │  │  LOCATION   │    │  INVENTORY  │    │   CARRIER   │              │        │
│  │  │  ASSIGNED   │    │  RESERVED   │    │  SELECTED   │              │        │
│  │  └─────────────┘    └─────────────┘    └─────────────┘              │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
│       │                                                                          │
│       ▼                                                                          │
│  ORDER STATUS: ALLOCATED → Ready for Fulfillment                                │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ALLOCATION APIS:                                                               │
│  ────────────────                                                               │
│  POST /api/v1/orders/{id}/allocate   - Allocate single order                   │
│  POST /api/v1/orders/bulk-allocate   - Allocate multiple orders                │
│  GET  /api/v1/allocation/rules       - List allocation rules                   │
│  POST /api/v1/allocation/rules       - Create rule                             │
│  GET  /api/v1/allocation/audit       - Allocation decision history             │
│  GET  /api/v1/allocation/csr-config  - Carrier-Service-Route config            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. COMPLETE SYSTEM INTERCONNECTION MAP

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE OMS/WMS MODULE INTERCONNECTION                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                           ┌─────────────────────┐                               │
│                           │    CONTROL TOWER    │◀────── Aggregates All Data    │
│                           │   (Intelligence)    │                               │
│                           └──────────┬──────────┘                               │
│                                      │                                           │
│            ┌─────────────────────────┼─────────────────────────┐                │
│            │                         │                         │                │
│            ▼                         ▼                         ▼                │
│     ┌─────────────┐          ┌─────────────┐          ┌─────────────┐          │
│     │     NDR     │◀─────────│  SHIPMENTS  │──────────▶│  LOGISTICS  │          │
│     │ Management  │ Failed   │             │ Dispatch  │  Allocation │          │
│     └─────────────┘ Delivery └──────┬──────┘           └──────┬──────┘          │
│                                     │                         │                 │
│                                     │                         │                 │
│                              ┌──────┴──────┐                  │                 │
│                              │             │                  │                 │
│                              ▼             │                  │                 │
│  ┌─────────────┐      ┌─────────────┐     │           ┌──────┴──────┐          │
│  │ PROCUREMENT │      │   ORDERS    │◀────┼───────────│  INVENTORY  │          │
│  │             │      │             │     │           │             │          │
│  │ • POs       │      │ • Create    │     │           │ • Stock     │          │
│  │ • Vendors   │      │ • Allocate  │     │           │ • Reserve   │          │
│  └──────┬──────┘      │ • Fulfill   │     │           │ • Adjust    │          │
│         │             └──────┬──────┘     │           └──────┬──────┘          │
│         │                    │            │                  │                 │
│         │                    │            │                  │                 │
│         ▼                    ▼            ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐       │
│  │                           INBOUND                                    │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │       │
│  │  │    ASN      │  │  External   │  │    GRN      │  │   Putaway   │ │       │
│  │  │             │──▶│    PO      │──▶│  (Receipt)  │──▶│             │ │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │       │
│  │                                            │                         │       │
│  │                                            ▼                         │       │
│  │                                     Creates INVENTORY                │       │
│  └─────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  LEGEND:                                                                        │
│  ───────                                                                        │
│  ──────▶  Data Flow Direction                                                   │
│  ◀──────  Feedback/Status Update                                                │
│                                                                                  │
│  KEY RELATIONSHIPS:                                                             │
│  ──────────────────                                                             │
│  1. Procurement → Inbound: POs trigger ASN/GRN creation                        │
│  2. Inbound → Inventory: GRN posting creates inventory                         │
│  3. Orders → Inventory: Allocation reserves stock                              │
│  4. Orders → Allocation: Rules determine fulfillment location                  │
│  5. Orders → Shipments: Dispatch creates shipments                             │
│  6. Shipments → NDR: Failed deliveries create NDR cases                        │
│  7. Control Tower → All: Aggregates metrics from all modules                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. INBOUND FLOW DETAIL (GRN as Source of Truth)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    INBOUND FLOW - GRN AS INVENTORY SOURCE                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  SOURCES OF INVENTORY                                                           │
│  ────────────────────                                                           │
│                                                                                  │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                   │
│  │  EXTERNAL PO  │    │     ASN       │    │ SALES RETURN  │                   │
│  │  (Procurement)│    │ (Vendor Ship) │    │  (Customer)   │                   │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘                   │
│          │                    │                    │                            │
│          │                    │                    │                            │
│  ┌───────┴───────┐            │            ┌───────┴───────┐                   │
│  │ STOCK TRANSFER│            │            │    MANUAL     │                   │
│  │    (STO)      │            │            │    ENTRY      │                   │
│  └───────┬───────┘            │            └───────┬───────┘                   │
│          │                    │                    │                            │
│          └────────────────────┼────────────────────┘                            │
│                               │                                                  │
│                               ▼                                                  │
│                    ┌─────────────────────┐                                      │
│                    │        GRN          │                                      │
│                    │   (Goods Receipt)   │                                      │
│                    │   ───────────────   │                                      │
│                    │   Status: DRAFT     │                                      │
│                    └──────────┬──────────┘                                      │
│                               │                                                  │
│                               ▼                                                  │
│                    ┌─────────────────────┐                                      │
│                    │   START RECEIVING   │                                      │
│                    │   ───────────────   │                                      │
│                    │   Status: RECEIVING │                                      │
│                    │   • Verify items    │                                      │
│                    │   • QC inspection   │                                      │
│                    │   • Record variance │                                      │
│                    └──────────┬──────────┘                                      │
│                               │                                                  │
│                               ▼                                                  │
│                    ┌─────────────────────┐                                      │
│                    │   POST TO INVENTORY │                                      │
│                    │   ───────────────   │                                      │
│                    │   Status: POSTED    │                                      │
│                    └──────────┬──────────┘                                      │
│                               │                                                  │
│                               ▼                                                  │
│              ┌────────────────────────────────────┐                             │
│              │      INVENTORY RECORDS CREATED     │                             │
│              │   ─────────────────────────────    │                             │
│              │   • SKU + Location + Qty           │                             │
│              │   • Batch/Lot tracking             │                             │
│              │   • FIFO sequence assigned         │                             │
│              │   • Channel allocation split       │                             │
│              └────────────────────────────────────┘                             │
│                               │                                                  │
│                               ▼                                                  │
│              ┌────────────────────────────────────┐                             │
│              │   INVENTORY AVAILABLE FOR ORDERS   │                             │
│              └────────────────────────────────────┘                             │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ⭐ KEY PRINCIPLE: No orders can be fulfilled without inventory.               │
│                    Inventory only exists after GRN is POSTED.                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. ORDER LIFECYCLE WITH MODULE INTERACTIONS

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ORDER LIFECYCLE - MODULE INTERACTIONS                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐               │
│  │ CREATED │───▶│ CONFIRMED │───▶│ ALLOCATED │───▶│ PICKLIST  │               │
│  └─────────┘    └───────────┘    └─────┬─────┘    │ GENERATED │               │
│       │              │                 │          └─────┬─────┘               │
│       │              │                 │                │                      │
│       │              │          ┌──────┴──────┐        │                      │
│       │              │          │ ALLOCATION  │        │                      │
│       │              │          │   ENGINE    │        │                      │
│       │              │          │ • Rules     │        │                      │
│       │              │          │ • Inventory │        │                      │
│       │              │          │ • Location  │        │                      │
│       │              │          └─────────────┘        │                      │
│       │              │                                 │                      │
│       ▼              ▼                                 ▼                      │
│  ┌────────────────────────────────────────────────────────────────────┐       │
│  │                    WAREHOUSE OPERATIONS                             │       │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐            │       │
│  │  │ PICKING │──▶│ PICKED  │──▶│ PACKING │──▶│ PACKED  │            │       │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘            │       │
│  └────────────────────────────────────────────────────────────────────┘       │
│                                                   │                            │
│                                                   ▼                            │
│                                            ┌───────────┐                      │
│                                            │ INVOICED  │                      │
│                                            └─────┬─────┘                      │
│                                                  │                            │
│                                                  ▼                            │
│  ┌────────────────────────────────────────────────────────────────────┐       │
│  │                      LOGISTICS MODULE                               │       │
│  │  ┌───────────┐   ┌───────────┐   ┌───────────┐                     │       │
│  │  │ MANIFESTED│──▶│DISPATCHED │──▶│IN-TRANSIT │                     │       │
│  │  │           │   │           │   │           │                     │       │
│  │  │ • Carrier │   │ • AWB No  │   │ • Track   │                     │       │
│  │  │ • AWB     │   │ • Handover│   │ • Update  │                     │       │
│  │  └───────────┘   └───────────┘   └─────┬─────┘                     │       │
│  └────────────────────────────────────────┼───────────────────────────┘       │
│                                           │                                    │
│                    ┌──────────────────────┼──────────────────────┐             │
│                    │                      │                      │             │
│                    ▼                      ▼                      ▼             │
│             ┌───────────┐         ┌───────────┐          ┌───────────┐        │
│             │ DELIVERED │         │    NDR    │          │    RTO    │        │
│             │  (POD)    │         │  (Failed) │          │ (Returned)│        │
│             └───────────┘         └─────┬─────┘          └───────────┘        │
│                                         │                                      │
│                                         ▼                                      │
│                               ┌─────────────────┐                             │
│                               │  NDR WORKFLOW   │                             │
│                               │ • Outreach      │                             │
│                               │ • Reattempt     │                             │
│                               │ • Escalation    │                             │
│                               └─────────────────┘                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. PAGE ROUTING REFERENCE

### By Section

| Section | Route | Page | Primary API |
|---------|-------|------|-------------|
| **Dashboard** | `/dashboard` | Overview | `/api/v1/dashboard` |
| **Control Tower** | `/control-tower` | AI Command Center | `/api/v1/control-tower` |
| | `/control-tower/ndr` | NDR AI Hub | `/api/v1/control-tower/ndr-summary` |
| | `/control-tower/exceptions` | Exceptions | `/api/v1/control-tower/exceptions` |
| | `/control-tower/rules` | Detection Rules | `/api/v1/control-tower/rules` |
| **Orders** | `/orders` | Order List | `/api/v1/orders` |
| | `/orders/[id]` | Order Detail | `/api/v1/orders/{id}` |
| | `/orders/new` | Create Order | `/api/v1/orders` |
| **Inbound** | `/inbound` | Redirect | → `/inbound/purchase-orders` |
| | `/inbound/asn` | ASN Management | `/api/v1/inbound` |
| | `/inbound/goods-receipt` | GRN List | `/api/v1/goods-receipts` |
| | `/inbound/goods-receipt/new` | Create GRN | `/api/v1/goods-receipts` |
| | `/inbound/purchase-orders` | PO (Inbound) ⚠️ | `/api/v1/purchase-orders` |
| | `/inbound/receiving` | Receive Items | `/api/v1/inbounds` |
| | `/inbound/putaway` | Putaway Tasks | `/api/v1/putaway/tasks` |
| | `/inbound/qc` | QC Inspection | `/api/v1/inbounds` |
| **Procurement** | `/procurement` | Hub Page | - |
| | `/procurement/vendors` | Vendor Management | `/api/v1/procurement/vendors` |
| | `/procurement/purchase-orders` | PO (Procurement) ⚠️ | `/api/v1/purchase-orders` |
| | `/procurement/performance` | Vendor KPIs | `/api/v1/procurement/vendors` |
| **Inventory** | `/inventory` | Stock Management | `/api/v1/inventory` |
| **Fulfillment** | `/fulfillment/waves` | Wave Management | `/api/v1/waves` |
| | `/fulfillment/picklists` | Picklists | `/api/v1/picklists` |
| | `/fulfillment/packing` | Packing Station | `/api/v1/packing` |
| **NDR** | `/ndr` | NDR Queue ⚠️ | `/api/v1/ndr` |
| | `/ndr/reattempts` | Reattempts | `/api/v1/ndr/{id}/reattempt` |
| | `/ndr/escalations` | Escalations | `/api/v1/ndr/escalations` |
| **Logistics** | `/logistics/allocation/rules` | Allocation Rules | `/api/v1/allocation/rules` |
| | `/logistics/allocation/audit` | Allocation Audit | `/api/v1/allocation/audit` |

---

## 10. RECOMMENDATIONS SUMMARY

### Immediate Actions

1. **Consolidate Purchase Orders**
   - Keep `/procurement/purchase-orders` as primary
   - Change `/inbound/purchase-orders` to redirect OR add "Pending Receipt" filter

2. **Clarify NDR Access**
   - Primary: `/control-tower/ndr` (AI-powered)
   - Secondary: `/ndr` (operational queue, simplified view)

3. **Remove Setup Duplicate**
   - Delete `/setup/allocation-rules`
   - Keep `/logistics/allocation/rules`

### Architecture Improvements

4. **Add Cross-Module Links**
   - GRN detail → Link to source PO/ASN
   - Order detail → Link to Shipment
   - Shipment detail → Link to NDR (if failed)

5. **Unified Search**
   - Control Tower should have global search across all modules

---

## Document Version

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-30 | Initial schematic documentation |

