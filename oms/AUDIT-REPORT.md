# CJDQuick OMS - Complete Frontend/Backend Audit Report

**Generated:** 2026-01-15
**Status:** CRITICAL ISSUES FOUND

## Executive Summary

A comprehensive audit of the CJDQuick OMS frontend pages, backend APIs, navigation menus, and button functionality revealed **significant gaps** between what is defined in the navigation and what actually exists or works in the codebase. These gaps explain why pages are not functioning correctly on Vercel deployment.

### Issue Count by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 12 | Blocking issues - pages won't load data |
| HIGH | 18 | Major functionality broken |
| MEDIUM | 15 | UX issues, missing features |
| LOW | 5 | Minor inconsistencies |

---

## 1. B2B CUSTOMERS MODULE - FIELD NAME MISMATCHES

### 1.1 Critical: List Page vs API vs Database Mismatches

**File:** `apps/web/src/app/(dashboard)/b2b/customers/page.tsx`
**API:** `apps/web/src/app/api/customers/route.ts`

| Page Expects | API Uses | Database Has | Status |
|--------------|----------|--------------|--------|
| `customerNo` | `code` | `code` | MISMATCH |
| `customerType` | `type` | `type` | MISMATCH |
| `gstNo` | `gstin` | `gst` | MISMATCH (3-way) |
| `panNo` | `pan` | `pan` | MISMATCH |
| `group` | `customerGroup` | `customerGroup` | MISMATCH |
| `paymentTerms` | `paymentTermType` | `paymentTermType` | MISMATCH |
| `statusCounts` | `typeCounts` | N/A | MISMATCH |

**Impact:** B2B Customers page will show undefined/empty values for most fields.

### 1.2 Inconsistency Between List and Detail Pages

The list page (`/b2b/customers/page.tsx`) and detail page (`/b2b/customers/[id]/page.tsx`) use different field names for the same data:

- List: `customerNo` vs Detail: `code`
- List: `customerType` vs Detail: `type`
- List: `gstNo` vs Detail: `gstin`
- List: `panNo` vs Detail: `pan`

---

## 2. B2B PORTAL - CRITICAL API PATH ERRORS

### 2.1 All Portal Pages Calling Wrong API Endpoints

**CRITICAL BLOCKER:** All 6 main B2B portal pages call `/api/portal/*` but endpoints exist at `/api/b2b/*`:

| Page | Wrong Path | Correct Path | Result |
|------|------------|--------------|--------|
| `portal/page.tsx` | `/api/portal/dashboard` | `/api/b2b/dashboard` | 404 |
| `portal/catalog/page.tsx` | `/api/portal/catalog` | `/api/b2b/catalog` | 404 |
| `portal/orders/page.tsx` | `/api/portal/orders` | `/api/b2b/orders` | 404 |
| `portal/quotations/page.tsx` | `/api/portal/quotations` | `/api/b2b/quotations` | 404 |
| `portal/account/page.tsx` | `/api/portal/account` | `/api/b2b/account` | 404 |
| `portal/account/credit/page.tsx` | `/api/portal/credit` | `/api/b2b/credit` | 404 |

### 2.2 Missing B2B Portal Detail Pages

These pages have links but the destination doesn't exist:

| Missing Page | Links From |
|--------------|------------|
| `/portal/orders/[id]` | Orders list, Dashboard |
| `/portal/quotations/[id]` | Quotations list, Dashboard |
| `/portal/quotations/new` | Quotations list |
| `/portal/quotations/[id]/convert` | Quotations list |

### 2.3 B2B Catalog Field Mismatches

| Page Expects | API Returns | Issue |
|--------------|-------------|-------|
| `minOrderQty` | Not returned | Shows undefined |
| `stock` | `availableStock` | Wrong field name |
| `image` | `imageUrl` | Wrong field name |

### 2.4 B2B Orders Field Mismatches

| Page Expects | API Returns | Issue |
|--------------|-------------|-------|
| `trackingNumber` | `awbNumber` | Won't display tracking |
| `expectedDelivery` | Not returned | Expected dates missing |

### 2.5 B2B Quotations Field Mismatch

| Page Expects | API Returns | Issue |
|--------------|-------------|-------|
| `quotationNumber` | `quotationNo` | Shows undefined |

---

## 3. CLIENT PORTAL - MISSING API ENDPOINTS

### 3.1 Pages Using Hardcoded Mock Data (No API)

| Page | Expected API | Status |
|------|--------------|--------|
| `/client/sales/sku-performance` | `/api/client/sku-performance` | MISSING |
| `/client/fulfillment/shipments` | `/api/client/shipments` | MISSING |
| `/client/fulfillment/by-location` | `/api/client/fulfillment/by-location` | MISSING |
| `/client/inventory/stock` | `/api/client/inventory/stock` | MISSING |
| `/client/inventory/inbound` | `/api/client/inventory/inbound` | MISSING |
| `/client/returns/rto` | `/api/client/returns/rto` | MISSING |
| `/client/analytics` | `/api/client/analytics` | MISSING |
| `/client/reports/sales` | `/api/client/reports/sales` | MISSING |
| `/client/reports/inventory` | `/api/client/reports/inventory` | MISSING |
| `/client/reports/fulfillment` | `/api/client/reports/fulfillment` | MISSING |
| `/client/reports/returns` | `/api/client/reports/returns` | MISSING |

### 3.2 Settings Page - Simulated API Calls

**File:** `/client/settings/page.tsx`

The following operations use simulated delays instead of actual API calls:
- `handleSaveProfile()` - Missing `/api/client/settings/profile`
- `handleSaveNotifications()` - Missing `/api/client/settings/notifications`
- `handleChangePassword()` - Missing `/api/client/settings/password`

### 3.3 Field Name Mismatch

| Page | Expects | API Returns | Issue |
|------|---------|-------------|-------|
| Dashboard | `reorderPoint` | `reorderLevel` | Field name mismatch |

---

## 4. WMS MODULE - COMPREHENSIVE ISSUES

### 4.1 Waves Module

| Issue | Page Field | API Field | Location |
|-------|------------|-----------|----------|
| Type field | `waveType` | `type` | waves/page.tsx |
| Stats missing | `stats` object | Not returned | waves API |
| Order number | `orderNo` | Not in items | waves/[id]/page.tsx |
| Created by | `createdBy` | `createdByUser` | waves/[id]/page.tsx |

### 4.2 Picklist Module

| Issue | Expected | Actual | Impact |
|-------|----------|--------|--------|
| Serial numbers | `serialNumbers` | Not returned | Can't track serials |
| Quantity field | `pickedQty` | `pickedQuantity` | Values undefined |
| Batch tracking | `batchNo` | Not returned | No batch info |
| Serialised flag | `isSerialised` | Not returned | UI breaks |

### 4.3 QC Module

| Issue | Page Uses | API Returns | Impact |
|-------|-----------|-------------|--------|
| QC type field | `qcType` | `type` | Field undefined |

### 4.4 Missing WMS Detail Pages

| Missing Page | Broken Links From |
|--------------|-------------------|
| `/wms/gate-pass/[id]` | Gate pass list actions |
| `/wms/qc/templates/[id]/edit` | Template list actions |

### 4.5 Delivery/Shipping Module

| Issue | Expected | Actual |
|-------|----------|--------|
| Transporter tracking URL | `trackingUrlTemplate` | Not returned |
| Shipping address | Consistent format | Inconsistent |
| Filter params | `transporterId` | Possibly different |

---

## 5. DASHBOARD MODULE - MINOR ISSUES

### 5.1 Quick Actions Link Issue

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

The "System Settings" quick action links to `/settings` which redirects to `/settings/company`. While functional, direct link would be better.

---

## 6. NAVIGATION VERIFICATION

### 6.1 All Navigation Links Have Matching Pages

The sidebar navigation in `components/layout/app-sidebar.tsx` has been verified - all 37 navigation links have corresponding page files:

**Operations:** All 26 links verified
**Master Panel:** 2 links verified
**Settings:** 7 links verified
**Finance:** 1 link verified

### 6.2 Navigation Links Working Correctly

All top-level navigation routes are correctly mapped to existing pages.

---

## 7. PRIORITY FIX LIST

### CRITICAL (Fix Immediately)

1. **B2B Portal API Paths** - Change all `/api/portal/*` to `/api/b2b/*` in 6 files
2. **B2B Customers Field Names** - Align page interface with API response
3. **Customer API Fields** - Fix `gstin`→`gst` mismatch with database

### HIGH (Fix This Week)

4. Create missing B2B portal detail pages (4 pages)
5. Create missing Client portal API endpoints (11 endpoints)
6. Fix WMS field name mismatches (waves, picklist, QC)
7. Add missing detail pages for gate-pass and QC

### MEDIUM (Fix This Sprint)

8. Add pagination to B2B portal list pages
9. Implement settings API endpoints for client portal
10. Add missing fields to WMS APIs (stats, serialNumbers, etc.)
11. Standardize field naming across all modules

### LOW (Backlog)

12. Add error boundary components
13. Improve error message display
14. Add loading skeletons

---

## 8. FILES REQUIRING CHANGES

### B2B Portal (6 files)
```
apps/web/src/app/(b2b-portal)/portal/page.tsx
apps/web/src/app/(b2b-portal)/portal/catalog/page.tsx
apps/web/src/app/(b2b-portal)/portal/orders/page.tsx
apps/web/src/app/(b2b-portal)/portal/quotations/page.tsx
apps/web/src/app/(b2b-portal)/portal/account/page.tsx
apps/web/src/app/(b2b-portal)/portal/account/credit/page.tsx
```

### B2B Dashboard Pages (2 files)
```
apps/web/src/app/(dashboard)/b2b/customers/page.tsx
apps/web/src/app/(dashboard)/b2b/customers/[id]/page.tsx
```

### APIs to Fix (3 files)
```
apps/web/src/app/api/customers/route.ts
apps/web/src/app/api/b2b/catalog/route.ts
apps/web/src/app/api/b2b/orders/route.ts
```

### WMS Pages (5 files)
```
apps/web/src/app/(dashboard)/wms/waves/page.tsx
apps/web/src/app/(dashboard)/wms/waves/[id]/page.tsx
apps/web/src/app/(dashboard)/wms/picklist/page.tsx
apps/web/src/app/(dashboard)/wms/picklist/[id]/page.tsx
apps/web/src/app/(dashboard)/wms/qc/templates/page.tsx
```

### New Files to Create (15+ files)
```
# B2B Portal Detail Pages
apps/web/src/app/(b2b-portal)/portal/orders/[id]/page.tsx
apps/web/src/app/(b2b-portal)/portal/quotations/[id]/page.tsx
apps/web/src/app/(b2b-portal)/portal/quotations/new/page.tsx

# Client Portal APIs
apps/web/src/app/api/client/sku-performance/route.ts
apps/web/src/app/api/client/shipments/route.ts
apps/web/src/app/api/client/fulfillment/by-location/route.ts
apps/web/src/app/api/client/inventory/stock/route.ts
apps/web/src/app/api/client/inventory/inbound/route.ts
apps/web/src/app/api/client/returns/rto/route.ts
apps/web/src/app/api/client/analytics/route.ts
apps/web/src/app/api/client/reports/sales/route.ts
apps/web/src/app/api/client/reports/inventory/route.ts
apps/web/src/app/api/client/reports/fulfillment/route.ts
apps/web/src/app/api/client/reports/returns/route.ts
apps/web/src/app/api/client/settings/profile/route.ts
apps/web/src/app/api/client/settings/notifications/route.ts
apps/web/src/app/api/client/settings/password/route.ts
```

---

## 9. RECOMMENDED FIX ORDER

1. Fix B2B Portal API paths (immediate - 30 min)
2. Fix B2B Customers field names (2 hours)
3. Create missing B2B portal detail pages (4 hours)
4. Fix WMS field mismatches (3 hours)
5. Create Client portal APIs (8 hours)
6. Add missing WMS detail pages (2 hours)
7. Implement pagination (4 hours)
8. Add error handling (2 hours)

**Estimated Total:** ~25 hours of development work

---

## 10. VERIFICATION CHECKLIST

After fixes, verify:

- [ ] B2B Portal loads data on all pages
- [ ] B2B Customers list shows all fields correctly
- [ ] B2B Portal order/quotation detail pages work
- [ ] Client Portal shows real data (not mock)
- [ ] WMS waves show progress stats
- [ ] WMS picklist shows serial numbers
- [ ] QC templates show correct type
- [ ] All navigation links work
- [ ] All action buttons work
- [ ] Pagination works on list pages
