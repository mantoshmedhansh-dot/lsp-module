# WMS Navigation Restructuring Plan

## Executive Summary

This document outlines the plan to consolidate duplicate navigation entries and restructure the Warehouse Operations section following industry best practices.

---

## Current State Analysis

### Identified Duplicates

| Feature | Current Location 1 | Current Location 2 | Backend API |
|---------|-------------------|-------------------|-------------|
| Stock Adjustments | WMS Ops → `/wms/stock-adjustments` | Inventory → `/inventory/adjustment` | `/api/v1/wms/stock-adjustments` |
| Cycle Counts | WMS Ops → `/wms/cycle-counts` | Inventory → `/inventory/cycle-count` | `/api/v1/wms/cycle-counts` |

### Issues with Current Structure

1. **User Confusion**: Same feature appears in two places
2. **Maintenance Burden**: Two frontend pages for same backend API
3. **Inconsistent Naming**: "Cycle Count" vs "Cycle Counts"
4. **Unclear Hierarchy**: Overlapping responsibilities between WMS Ops and Inventory

---

## Proposed Restructured Navigation

### Before (Current)

```
Warehouse Operations
├── Inbound
│   ├── Purchase Orders
│   ├── Goods Receipt
│   ├── ASN Management
│   ├── Receiving
│   └── Inbound QC
│
├── Outbound (Fulfillment)
│   ├── Wave Planning
│   ├── Picking
│   ├── Packing
│   ├── Outbound QC
│   ├── Manifest
│   └── Gate Pass
│
├── WMS Operations              ← REMOVE THIS SECTION
│   ├── Putaway Tasks           ← Move to Inbound
│   ├── Stock Adjustments       ← DUPLICATE (remove)
│   └── Cycle Counts            ← DUPLICATE (remove)
│
├── Inventory
│   ├── Stock Overview
│   ├── Stock Adjustments       ← KEEP (single location)
│   ├── Cycle Count             ← KEEP (rename to "Cycle Counts")
│   ├── Movement History
│   └── Virtual Inventory
│
└── Returns & RTO
```

### After (Proposed)

```
Warehouse Operations
├── Inbound
│   ├── Purchase Orders         → /inbound/purchase-orders
│   ├── ASN Management          → /inbound/asn
│   ├── Goods Receipt           → /inbound/receiving
│   ├── Putaway Tasks           → /inbound/putaway           ← MOVED from WMS Ops
│   └── Inbound QC              → /inbound/qc
│
├── Inventory
│   ├── Stock Overview          → /inventory
│   ├── Stock Adjustments       → /inventory/adjustments     ← SINGLE LOCATION
│   ├── Cycle Counts            → /inventory/cycle-counts    ← SINGLE LOCATION (renamed)
│   ├── Bin Transfers           → /inventory/transfers       ← NEW
│   ├── Movement History        → /inventory/movements
│   └── Virtual Inventory       → /inventory/virtual
│
├── Outbound (Fulfillment)
│   ├── Wave Planning           → /fulfillment/waves
│   ├── Picking                 → /fulfillment/picklist
│   ├── Packing                 → /fulfillment/packing
│   ├── Outbound QC             → /fulfillment/qc
│   ├── Manifest                → /fulfillment/manifest
│   └── Gate Pass               → /fulfillment/gate-pass
│
└── Returns & RTO
    ├── Customer Returns        → /returns
    ├── RTO Management          → /returns/rto
    ├── Returns QC              → /returns/qc
    └── Refund Processing       → /returns/refunds
```

---

## Implementation Steps

### Phase 1: Remove WMS Operations Section & Consolidate

#### Step 1.1: Update Navigation (app-sidebar.tsx)

**Remove:**
- `wmsNav` section entirely (lines 203-211)

**Move:**
- Putaway Tasks → Add to `inboundNav`

**Update:**
- Rename "Cycle Count" to "Cycle Counts" in `inventoryNav`
- Change `/inventory/adjustment` to `/inventory/adjustments`
- Change `/inventory/cycle-count` to `/inventory/cycle-counts`

#### Step 1.2: Delete Duplicate Frontend Pages

**Delete:**
- `/apps/web/src/app/(dashboard)/wms/stock-adjustments/` (entire folder)
- `/apps/web/src/app/(dashboard)/wms/cycle-counts/` (entire folder)

**Keep:**
- `/apps/web/src/app/(dashboard)/inventory/adjustment/` → Rename to `adjustments`
- `/apps/web/src/app/(dashboard)/inventory/cycle-count/` → Rename to `cycle-counts`

#### Step 1.3: Move Putaway Tasks

**Move:**
- `/apps/web/src/app/(dashboard)/wms/putaway/` → `/apps/web/src/app/(dashboard)/inbound/putaway/`

**Delete (after move):**
- `/apps/web/src/app/(dashboard)/wms/` (entire folder if empty)

---

### Phase 2: Add Bin Transfers Feature (Optional Enhancement)

Add new feature for inventory bin-to-bin transfers:

**Frontend:**
- Create `/apps/web/src/app/(dashboard)/inventory/transfers/page.tsx`

**Backend:**
- Endpoint already exists: `POST /api/v1/inventory/transfer`

---

## Database Schema (Supabase - No Changes Required)

The backend API and database models remain unchanged:

### Existing Tables Used:

| Table | Purpose | Status |
|-------|---------|--------|
| `Inventory` | Stock quantities at bin level | ✅ Exists |
| `StockAdjustment` | Stock corrections | ✅ Exists (in wms_extended) |
| `StockAdjustmentItem` | Adjustment line items | ✅ Exists |
| `CycleCount` | Physical inventory counts | ✅ Exists (in wms_extended) |
| `CycleCountItem` | Count line items | ✅ Exists |
| `PutawayTask` | Putaway work orders | ✅ Exists |
| `InventoryMovement` | Audit trail | ✅ Exists |
| `GatePass` | Dispatch records | ✅ Exists |

### Backend API Routes (No Changes):

| Route | Purpose |
|-------|---------|
| `GET/POST /api/v1/wms/stock-adjustments` | Stock adjustments |
| `GET/POST /api/v1/wms/cycle-counts` | Cycle counts |
| `GET/POST /api/v1/putaway` | Putaway tasks |
| `GET/POST /api/v1/inventory` | Inventory CRUD |
| `POST /api/v1/inventory/adjust` | Quick adjustments |
| `POST /api/v1/inventory/transfer` | Bin transfers |

---

## Route Mapping (Old → New)

| Old Route | New Route | Action |
|-----------|-----------|--------|
| `/wms/stock-adjustments` | `/inventory/adjustments` | Redirect or Remove |
| `/wms/cycle-counts` | `/inventory/cycle-counts` | Redirect or Remove |
| `/wms/putaway` | `/inbound/putaway` | Move |
| `/inventory/adjustment` | `/inventory/adjustments` | Rename |
| `/inventory/cycle-count` | `/inventory/cycle-counts` | Rename |

---

## Updated Sidebar Configuration

```typescript
// AFTER RESTRUCTURE

const inboundNav: NavItemWithSub = {
  title: "Inbound",
  icon: ArrowDownToLine,
  items: [
    { title: "Purchase Orders", href: "/inbound/purchase-orders" },
    { title: "ASN Management", href: "/inbound/asn" },
    { title: "Goods Receipt", href: "/inbound/receiving" },
    { title: "Putaway Tasks", href: "/inbound/putaway" },     // ← MOVED HERE
    { title: "Inbound QC", href: "/inbound/qc" },
  ],
};

// REMOVE wmsNav entirely

const inventoryNav: NavItemWithSub = {
  title: "Inventory",
  icon: Boxes,
  items: [
    { title: "Stock Overview", href: "/inventory" },
    { title: "Stock Adjustments", href: "/inventory/adjustments" },    // ← RENAMED
    { title: "Cycle Counts", href: "/inventory/cycle-counts" },        // ← RENAMED
    { title: "Bin Transfers", href: "/inventory/transfers" },          // ← NEW
    { title: "Movement History", href: "/inventory/movements" },
    { title: "Virtual Inventory", href: "/inventory/virtual" },
  ],
};

const fulfillmentNav: NavItemWithSub = {
  title: "Outbound (Fulfillment)",
  icon: PackageOpen,
  items: [
    { title: "Wave Planning", href: "/fulfillment/waves" },
    { title: "Picking", href: "/fulfillment/picklist" },
    { title: "Packing", href: "/fulfillment/packing" },
    { title: "Outbound QC", href: "/fulfillment/qc" },
    { title: "Manifest", href: "/fulfillment/manifest" },
    { title: "Gate Pass", href: "/fulfillment/gate-pass" },
  ],
};

const returnsNav: NavItemWithSub = {
  title: "Returns & RTO",
  icon: RotateCcw,
  items: [
    { title: "Customer Returns", href: "/returns" },
    { title: "RTO Management", href: "/returns/rto" },
    { title: "Returns QC", href: "/returns/qc" },
    { title: "Refund Processing", href: "/returns/refunds" },
  ],
};
```

---

## Industry Best Practice Alignment

| Feature | Manhattan WMS | SAP EWM | CJDQuick (After) |
|---------|--------------|---------|------------------|
| Putaway under Inbound | ✅ Yes | ✅ Yes | ✅ Yes |
| Single Stock Adjustments | ✅ Yes | ✅ Yes | ✅ Yes |
| Single Cycle Counts | ✅ Yes | ✅ Yes | ✅ Yes |
| Movement History | ✅ Yes | ✅ Yes | ✅ Yes |
| Bin Transfers separate | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Timeline

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Update navigation sidebar | 1 hour |
| 2 | Move/rename frontend pages | 2 hours |
| 3 | Delete duplicate pages | 30 min |
| 4 | Test all routes | 1 hour |
| 5 | Deploy to production | 30 min |

**Total Estimated Time: 5 hours**

---

## Verification Checklist

- [ ] WMS Operations section removed from sidebar
- [ ] Putaway Tasks moved to Inbound section
- [ ] Stock Adjustments has single entry under Inventory
- [ ] Cycle Counts has single entry under Inventory (consistent naming)
- [ ] Duplicate pages deleted
- [ ] All routes working correctly
- [ ] Backend APIs unchanged
- [ ] No broken links in application

---

## Rollback Plan

If issues occur:
1. Revert `app-sidebar.tsx` to previous version
2. Restore deleted frontend pages from git
3. No database or backend changes needed for rollback
