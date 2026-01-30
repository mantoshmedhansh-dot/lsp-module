# CJDQuick OMS/WMS - Complete Process Flow Documentation

**Version:** 1.0
**Date:** January 30, 2026
**System:** Order Management System (OMS) & Warehouse Management System (WMS)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Inbound Process Flow](#3-inbound-process-flow)
4. [Order-to-Delivery Process Flow](#4-order-to-delivery-process-flow)
5. [Detailed Stage Documentation](#5-detailed-stage-documentation)
6. [Material Flow Diagram](#6-material-flow-diagram)
7. [Status Transitions](#7-status-transitions)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Integration Points](#9-integration-points)

---

## 1. Executive Summary

The CJDQuick OMS/WMS system provides end-to-end order fulfillment capabilities from inventory receipt to proof of delivery. The system follows a structured workflow ensuring inventory accuracy, order traceability, and operational efficiency.

### Key Principles
- **GRN is the First Source of Truth** - No inventory exists without Goods Receipt
- **FIFO/FEFO Allocation** - Inventory allocation follows valuation methods
- **Real-time Tracking** - Every status change is logged and traceable
- **Multi-channel Support** - Orders from Website, Amazon, Flipkart, Manual entry

---

## 2. System Architecture Overview

### 2.1 Module Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CJDQuick Platform                            │
├─────────────────┬─────────────────┬─────────────────┬───────────────┤
│      OMS        │      WMS        │   B2B Logistics │  B2C Courier  │
│  (This Module)  │  (This Module)  │   (Separate)    │  (Separate)   │
└─────────────────┴─────────────────┴─────────────────┴───────────────┘
```

### 2.2 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Next.js 16 | User Interface |
| Backend | FastAPI (Python) | API & Business Logic |
| Database | PostgreSQL (Supabase) | Data Storage |
| Authentication | NextAuth + JWT | Security |

---

## 3. Inbound Process Flow

### 3.1 Inbound Sources

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  External PO     │     │      ASN         │     │  Stock Transfer  │
│  (Purchase Order)│     │ (Advance Shipping│     │  (Inter-warehouse│
│                  │     │     Notice)      │     │    Transfer)     │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │    GOODS RECEIPT (GRN)   │
                    │   First Source of Truth  │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │      INVENTORY           │
                    │   (Stock Available)      │
                    └──────────────────────────┘
```

### 3.2 GRN Workflow States

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| DRAFT | GRN created, items being added | Edit, Delete, Start Receiving |
| RECEIVING | Physical verification in progress | Update quantities, Post |
| POSTED | Inventory created in system | View, Print, Reverse (Admin) |
| CANCELLED | GRN cancelled before posting | View only |

### 3.3 GRN Process Steps

1. **Create GRN** - From External PO, ASN, or Manual Entry
2. **Add Items** - SKU, Expected Qty, Batch, Expiry
3. **Receive Items** - Enter Received Qty, Accepted Qty, Rejected Qty
4. **Quality Check** - Optional QC inspection
5. **Post GRN** - Creates inventory records
6. **Putaway** - Move items to storage bins

---

## 4. Order-to-Delivery Process Flow

### 4.1 Complete Order Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORDER LIFECYCLE                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ ORDER   │───▶│CONFIRMED│───▶│ALLOCATED│───▶│PICKLIST │───▶│ PICKING │
  │ CREATED │    │         │    │         │    │GENERATED│    │         │
  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                                    │
  ┌─────────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ PICKED  │───▶│ PACKING │───▶│ PACKED  │───▶│INVOICED │───▶│MANIFESTED│
  │         │    │         │    │         │    │         │    │         │
  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                                    │
  ┌─────────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
  │DISPATCHED───▶│IN TRANSIT───▶│OUT FOR  │───▶│DELIVERED│
  │         │    │         │    │DELIVERY │    │  (POD)  │
  └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 4.2 Process Summary Table

| Stage | System | Input | Output | Duration |
|-------|--------|-------|--------|----------|
| Order Creation | OMS | Customer Order | Order Record | Immediate |
| Confirmation | OMS | Payment/Verification | Confirmed Order | 0-24 hrs |
| Allocation | WMS | Confirmed Order | Reserved Inventory | Immediate |
| Picklist | WMS | Allocated Order | Pick Instructions | Immediate |
| Picking | WMS | Picklist | Picked Items | 5-30 mins |
| Packing | WMS | Picked Items | Packed Shipment | 5-15 mins |
| Invoice | OMS | Packed Order | Tax Invoice | Immediate |
| Manifest | OMS | Multiple Orders | Carrier Handover List | Per Batch |
| Dispatch | Logistics | Manifest | AWB/Tracking | Immediate |
| Last Mile | Courier | AWB | Delivery Attempt | 1-7 days |
| POD | Courier | Delivery | Proof of Delivery | At Delivery |

---

## 5. Detailed Stage Documentation

### 5.1 Stage 1: Order Creation

**Purpose:** Capture customer order information

**Sources:**
- Manual Entry (Admin Panel)
- Website Integration
- Marketplace APIs (Amazon, Flipkart)
- B2B Portal

**Data Captured:**
```
Order Header:
├── Order Number (Auto-generated: ORD-YYYYMMDD-XXXX)
├── Order Date
├── Channel (MANUAL, WEBSITE, AMAZON, FLIPKART)
├── Order Type (B2C, B2B)
├── Customer Information
│   ├── Name
│   ├── Phone
│   ├── Email
│   └── Shipping Address
├── Payment Details
│   ├── Payment Method (COD, PREPAID)
│   └── Payment Status
└── Location (Fulfillment Warehouse)

Order Items:
├── SKU Code
├── Product Name
├── Quantity
├── Unit Price
├── Discount
├── Tax (GST)
└── Line Total
```

**Status:** `CREATED`

**API Endpoint:** `POST /api/v1/orders`

---

### 5.2 Stage 2: Order Confirmation

**Purpose:** Validate order and prepare for fulfillment

**Validation Checks:**
- Customer address validity
- Payment confirmation (for prepaid)
- SKU availability check
- Fraud detection (optional)

**Actions:**
- Auto-confirm (for verified channels)
- Manual confirm (for COD/new customers)
- Hold (for review)
- Cancel (if invalid)

**Status:** `CONFIRMED`

**API Endpoint:** `POST /api/v1/orders/{id}/confirm`

---

### 5.3 Stage 3: Inventory Allocation

**Purpose:** Reserve inventory for the order

**Allocation Logic:**
```
1. Find available inventory for each SKU
2. Apply valuation method:
   - FIFO (First In, First Out) - Default
   - LIFO (Last In, First Out)
   - FEFO (First Expired, First Out) - For perishables
3. Reserve quantity from specific bins
4. Create allocation records
5. Update inventory reserved quantity
```

**Allocation Priority:**
1. Same warehouse as order location
2. Nearest warehouse (if multi-location)
3. Partial allocation if insufficient stock

**Data Created:**
```
Inventory Allocation:
├── Allocation Number
├── SKU ID
├── Order ID
├── Order Item ID
├── Bin ID
├── Allocated Quantity
├── Valuation Method
├── FIFO Sequence
└── Status (ALLOCATED)
```

**Status:** `ALLOCATED` or `PARTIALLY_ALLOCATED`

**API Endpoint:** `POST /api/v1/orders/{id}/allocate`

---

### 5.4 Stage 4: Picklist Generation

**Purpose:** Create picking instructions for warehouse staff

**Picklist Contains:**
```
Picklist Header:
├── Picklist Number (PL-XXXXXX)
├── Order Reference
├── Assigned Picker (optional)
├── Priority
└── Status

Picklist Items:
├── SKU Code
├── Product Name
├── Bin Location (Zone-Aisle-Rack-Level)
├── Required Quantity
├── Picked Quantity (initially 0)
└── Batch/Lot Number
```

**Picking Strategies:**
- **Single Order Picking** - One order at a time
- **Batch Picking** - Multiple orders, same SKUs
- **Zone Picking** - Picker assigned to specific zone
- **Wave Picking** - Time-based batches

**Status:** `PICKLIST_GENERATED`

**API Endpoint:** `POST /api/v1/picklists`

---

### 5.5 Stage 5: Picking Process

**Purpose:** Physically collect items from warehouse bins

**Picking Flow:**
```
1. Picker receives picklist (mobile/paper)
2. Navigate to bin location
3. Scan bin barcode (verification)
4. Pick required quantity
5. Scan item barcode (verification)
6. Confirm picked quantity
7. Move to next item
8. Complete picklist
```

**Picking Methods:**
- **Paper-based** - Printed picklist
- **Mobile App** - Real-time updates
- **Voice Picking** - Hands-free operation
- **Pick-to-Light** - LED indicators

**Data Updated:**
```
Picklist Item:
├── Picked Quantity
├── Picked By
├── Picked At
└── Variance (if any)

Inventory:
├── Reserved Qty decreased
└── Allocated Qty moved to picked
```

**Status:** `PICKING` → `PICKED`

**API Endpoints:**
- `POST /api/v1/waves/{id}/start` - Start picking
- `PATCH /api/v1/waves/picklists/items/{id}` - Update picked qty
- `POST /api/v1/waves/{id}/complete` - Complete picking

---

### 5.6 Stage 6: Packing Process

**Purpose:** Pack items securely for shipping

**Packing Flow:**
```
1. Receive picked items at packing station
2. Scan order/picklist barcode
3. Verify items against order
4. Select appropriate packaging
5. Add packing materials (bubble wrap, etc.)
6. Weigh package
7. Generate shipping label
8. Apply label to package
9. Complete packing
```

**Package Types:**
- Box (various sizes)
- Poly Mailer
- Padded Envelope
- Custom Packaging

**Data Captured:**
```
Shipment:
├── Package Dimensions (L x W x H)
├── Actual Weight
├── Volumetric Weight
├── Chargeable Weight
├── Package Type
└── Packing Materials Used
```

**Status:** `PACKING` → `PACKED`

**API Endpoint:** `POST /api/v1/packing/pack`

---

### 5.7 Stage 7: Invoice Generation

**Purpose:** Create tax-compliant invoice for shipment

**Invoice Contains:**
```
Invoice Header:
├── Invoice Number (INV-YYYYMMDD-XXXX)
├── Invoice Date
├── Order Reference
├── Customer Details (Bill To)
├── Shipping Address (Ship To)
├── Seller Details
│   ├── Company Name
│   ├── GSTIN
│   └── Address
└── Place of Supply

Invoice Items:
├── HSN Code
├── Product Description
├── Quantity
├── Unit Price
├── Taxable Value
├── GST Details
│   ├── CGST Rate & Amount
│   ├── SGST Rate & Amount
│   ├── IGST Rate & Amount (interstate)
│   └── Cess (if applicable)
└── Line Total

Invoice Footer:
├── Subtotal
├── Total Tax
├── Shipping Charges
├── Discount
├── Grand Total
├── Amount in Words
└── Terms & Conditions
```

**GST Compliance:**
- CGST + SGST for intra-state
- IGST for inter-state
- E-way bill for shipments > ₹50,000

**Status:** `INVOICED`

**API Endpoint:** `POST /api/v1/orders/{id}/invoice`

---

### 5.8 Stage 8: Manifest Creation

**Purpose:** Group shipments for carrier handover

**Manifest Contains:**
```
Manifest Header:
├── Manifest Number
├── Manifest Date
├── Carrier/Transporter
├── Vehicle Number
├── Driver Details
└── Route/Destination

Manifest Items:
├── AWB Number
├── Order Number
├── Customer Name
├── Destination Pincode
├── Weight
├── COD Amount (if applicable)
└── Package Count
```

**Manifest Types:**
- **Forward Manifest** - Outbound shipments
- **Return Manifest** - RTO/Customer returns
- **Pickup Manifest** - Marketplace pickups

**Status:** `MANIFESTED`

**API Endpoint:** `POST /api/v1/shipments/manifest`

---

### 5.9 Stage 9: Dispatch

**Purpose:** Handover shipments to carrier

**Dispatch Process:**
```
1. Carrier arrives for pickup
2. Verify manifest against physical packages
3. Scan each package
4. Driver signs manifest
5. Update system with handover time
6. Generate Gate Pass
7. Carrier departs
```

**Data Updated:**
```
Shipment:
├── Dispatched At
├── Carrier Accepted
├── Driver Name
├── Vehicle Number
└── Gate Pass Number
```

**Status:** `DISPATCHED`

**API Endpoint:** `POST /api/v1/shipments/{id}/dispatch`

---

### 5.10 Stage 10: In Transit (Last Mile)

**Purpose:** Track shipment movement to delivery

**Transit Stages:**
```
DISPATCHED
    │
    ▼
IN_TRANSIT (Carrier Hub)
    │
    ▼
REACHED_DESTINATION_HUB
    │
    ▼
OUT_FOR_DELIVERY
    │
    ├──▶ DELIVERED (Success)
    │
    ├──▶ DELIVERY_ATTEMPTED (Failed Attempt)
    │       │
    │       ▼
    │    RE-ATTEMPTED (Next Day)
    │
    └──▶ RTO_INITIATED (After max attempts)
            │
            ▼
        RTO_IN_TRANSIT
            │
            ▼
        RTO_DELIVERED (Back to warehouse)
```

**Tracking Events:**
- Shipment Picked Up
- In Transit to Hub
- Arrived at Hub
- Out for Delivery
- Delivery Attempted (with reason)
- Delivered
- RTO Initiated

**Status Updates:** Via carrier webhook integration

**API Endpoint:** `POST /api/v1/shipments/tracking-webhook`

---

### 5.11 Stage 11: Proof of Delivery (POD)

**Purpose:** Confirm successful delivery

**POD Types:**
```
1. Digital Signature
   └── Customer signs on delivery device

2. OTP Verification
   └── Customer provides OTP sent to phone

3. Photo POD
   └── Photo of delivered package at doorstep

4. Paper POD
   └── Customer signs paper document
```

**POD Data:**
```
Proof of Delivery:
├── Delivery Date & Time
├── Received By (Name)
├── Relationship (Self, Family, Security, etc.)
├── Signature/OTP/Photo
├── GPS Coordinates
├── Delivery Notes
└── COD Collection Details (if applicable)
```

**Status:** `DELIVERED`

**API Endpoint:** `POST /api/v1/shipments/{id}/pod`

---

## 6. Material Flow Diagram

### 6.1 Physical Material Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WAREHOUSE LAYOUT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

     INBOUND                    STORAGE                      OUTBOUND
  ┌───────────┐            ┌─────────────┐              ┌───────────────┐
  │  DOCK 1   │            │   ZONE A    │              │  PACKING      │
  │ (Receive) │───────────▶│  (Bulk)     │─────────────▶│  STATION 1   │
  └───────────┘            ├─────────────┤              └───────────────┘
                           │   ZONE B    │                     │
  ┌───────────┐            │  (Rack)     │              ┌──────▼────────┐
  │  DOCK 2   │───────────▶├─────────────┤─────────────▶│  PACKING      │
  │ (Receive) │            │   ZONE C    │              │  STATION 2    │
  └───────────┘            │  (Pick Face)│              └───────────────┘
                           ├─────────────┤                     │
  ┌───────────┐            │   ZONE D    │              ┌──────▼────────┐
  │   QC      │◀──────────▶│  (Cold)     │              │   STAGING     │
  │  AREA     │            └─────────────┘              │   AREA        │
  └───────────┘                                         └───────────────┘
                                                               │
                                                        ┌──────▼────────┐
                                                        │   DISPATCH    │
                                                        │   DOCK        │
                                                        └───────────────┘
```

### 6.2 Bin Location Structure

```
Location Code: A-01-02-03
              │  │  │  │
              │  │  │  └── Level (Shelf)
              │  │  └───── Rack Number
              │  └──────── Aisle Number
              └─────────── Zone Code

Example: Zone A, Aisle 1, Rack 2, Level 3
```

---

## 7. Status Transitions

### 7.1 Order Status Flow

```
CREATED ──────▶ CONFIRMED ──────▶ ALLOCATED ──────▶ PICKLIST_GENERATED
    │               │                  │                    │
    │               │                  │                    │
    ▼               ▼                  ▼                    ▼
 CANCELLED       ON_HOLD      PARTIALLY_ALLOCATED       PICKING
                                                           │
                                                           ▼
DELIVERED ◀── OUT_FOR_DELIVERY ◀── IN_TRANSIT ◀── DISPATCHED ◀── PACKED ◀── PICKED
    │
    ▼
COMPLETED
```

### 7.2 Valid Status Transitions

| From Status | To Status | Trigger |
|-------------|-----------|---------|
| CREATED | CONFIRMED | confirm() |
| CREATED | CANCELLED | cancel() |
| CREATED | ON_HOLD | hold() |
| CONFIRMED | ALLOCATED | allocate() |
| CONFIRMED | ON_HOLD | hold() |
| ALLOCATED | PICKLIST_GENERATED | generatePicklist() |
| PICKLIST_GENERATED | PICKING | startPicking() |
| PICKING | PICKED | completePicking() |
| PICKED | PACKED | pack() |
| PACKED | INVOICED | generateInvoice() |
| INVOICED | DISPATCHED | dispatch() |
| DISPATCHED | IN_TRANSIT | carrierUpdate() |
| IN_TRANSIT | OUT_FOR_DELIVERY | carrierUpdate() |
| OUT_FOR_DELIVERY | DELIVERED | confirmDelivery() |
| OUT_FOR_DELIVERY | DELIVERY_FAILED | deliveryFailed() |

---

## 8. API Endpoints Reference

### 8.1 Order Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/orders | Create new order |
| GET | /api/v1/orders | List orders |
| GET | /api/v1/orders/{id} | Get order details |
| PATCH | /api/v1/orders/{id} | Update order |
| POST | /api/v1/orders/{id}/confirm | Confirm order |
| POST | /api/v1/orders/{id}/allocate | Allocate inventory |
| POST | /api/v1/orders/{id}/cancel | Cancel order |
| POST | /api/v1/orders/{id}/hold | Hold order |

### 8.2 Warehouse Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/picklists | Generate picklists |
| GET | /api/v1/waves/picklists | List picklists |
| POST | /api/v1/waves/{id}/start | Start picking |
| POST | /api/v1/waves/{id}/complete | Complete picking |
| POST | /api/v1/packing/pack | Pack order |

### 8.3 Shipping & Delivery

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/shipments | Create shipment |
| POST | /api/v1/shipments/manifest | Create manifest |
| POST | /api/v1/shipments/{id}/dispatch | Dispatch shipment |
| POST | /api/v1/shipments/{id}/pod | Record POD |

### 8.4 Inbound Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/goods-receipts | Create GRN |
| POST | /api/v1/goods-receipts/{id}/receive | Start receiving |
| POST | /api/v1/goods-receipts/{id}/post | Post to inventory |
| POST | /api/v1/inventory/adjust | Adjust inventory |

---

## 9. Integration Points

### 9.1 External System Integrations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────┘

    MARKETPLACES              OMS/WMS                    LOGISTICS
  ┌─────────────┐         ┌───────────┐              ┌─────────────┐
  │   Amazon    │◀───────▶│           │◀────────────▶│  Delhivery  │
  └─────────────┘         │           │              └─────────────┘
  ┌─────────────┐         │           │              ┌─────────────┐
  │  Flipkart   │◀───────▶│  CJDQuick │◀────────────▶│  BlueDart   │
  └─────────────┘         │           │              └─────────────┘
  ┌─────────────┐         │           │              ┌─────────────┐
  │   Myntra    │◀───────▶│           │◀────────────▶│   Ecom Ex   │
  └─────────────┘         └───────────┘              └─────────────┘
                               ▲
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
  ┌────▼────┐            ┌─────▼─────┐           ┌─────▼─────┐
  │  ERP    │            │  Payment  │           │ Accounting │
  │ (SAP)   │            │ Gateway   │           │  (Tally)   │
  └─────────┘            └───────────┘           └───────────┘
```

### 9.2 Webhook Events

| Event | Trigger | Data |
|-------|---------|------|
| order.created | New order | Order details |
| order.confirmed | Order confirmed | Order ID, status |
| order.allocated | Inventory allocated | Allocation details |
| order.packed | Order packed | Package details |
| order.shipped | Order dispatched | AWB, tracking |
| order.delivered | POD received | POD details |
| inventory.received | GRN posted | Inventory details |
| inventory.adjusted | Stock adjustment | Adjustment details |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| AWB | Air Waybill - Shipping tracking number |
| COD | Cash on Delivery |
| FEFO | First Expired, First Out |
| FIFO | First In, First Out |
| GRN | Goods Receipt Note |
| HSN | Harmonized System Nomenclature (Tax code) |
| LIFO | Last In, First Out |
| OMS | Order Management System |
| POD | Proof of Delivery |
| RTO | Return to Origin |
| SKU | Stock Keeping Unit |
| WMS | Warehouse Management System |

---

## Appendix B: Sample Order Journey

**Order:** ORD-20260130-NKIT
**Customer:** Raam
**Product:** AQP-001 (Qty: 1)
**Amount:** ₹14,160

| Timestamp | Status | Action | User |
|-----------|--------|--------|------|
| 2026-01-30 11:08 | CREATED | Order placed | System |
| 2026-01-30 11:51 | ALLOCATED | Inventory reserved | Admin |
| 2026-01-30 11:54 | PICKLIST_GENERATED | PL-000001 created | Admin |
| 2026-01-30 12:00 | PICKING | Picker assigned | Warehouse |
| 2026-01-30 12:15 | PICKED | Items collected | Warehouse |
| 2026-01-30 12:30 | PACKED | Package ready | Packer |
| 2026-01-30 12:35 | INVOICED | INV-001 generated | System |
| 2026-01-30 14:00 | DISPATCHED | Handed to courier | System |
| 2026-01-30 18:00 | IN_TRANSIT | At carrier hub | Carrier |
| 2026-01-31 09:00 | OUT_FOR_DELIVERY | With delivery agent | Carrier |
| 2026-01-31 11:30 | DELIVERED | POD captured | Carrier |

---

**Document End**

*Generated by CJDQuick OMS/WMS System*
