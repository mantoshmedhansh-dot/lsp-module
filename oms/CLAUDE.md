# CJDQuick - Project Context

---

# ⚠️ SOURCE OF TRUTH - 4 MODULE ARCHITECTURE (Updated: 2026-01-22)

## CJDQuick Business Model

CJDQuick offers **3 distinct services** to clients. These are **completely independent modules** with NO interlinking:

| Service | What Client Gets | What CJDQuick Provides |
|---------|------------------|------------------------|
| **B2B Logistics** | Client hands over inventory for B2B distribution | PTL/FTL transport, LR, Consignees, POD |
| **B2C Courier** | Client uses for direct-to-consumer delivery | Parcel shipments, NDR, COD, Pickup |
| **OMS + WMS** | Client uses tech stack to run their warehouses | Order management, WMS, Inventory, Fulfillment |

**IMPORTANT**: OMS has a "Logistics & Delivery" section that **uses** transport services (FTL/PTL/B2C) for shipping orders - this is **integration/consumption** only, NOT shared code.

---

## CONFIRMED 4-MODULE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     CJDQuick App - 4 MODULE ARCHITECTURE                        │
│                         (SOURCE OF TRUTH - DO NOT MODIFY)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  /Users/mantosh/CJDQuickApp/                                                    │
│  │                                                                              │
│  ├── oms/                    ← MODULE 1: OMS + WMS                              │
│  │   ├── apps/web/           ← OMS Frontend (Vercel)                            │
│  │   ├── backend/            ← OMS Backend (Render)                             │
│  │   └── Database: Supabase Tokyo (rilakxywitslblkgikzf)                        │
│  │                                                                              │
│  ├── b2b/                    ← MODULE 2: B2B LOGISTICS (FTL/PTL)                │
│  │   ├── apps/web/           ← B2B Frontend (Vercel)                            │
│  │   ├── backend/            ← B2B Backend (Render)                             │
│  │   └── Database: Supabase B2B (NEW - to be created)                           │
│  │                                                                              │
│  ├── b2c/                    ← MODULE 3: B2C COURIER                            │
│  │   ├── apps/web/           ← B2C Frontend (Vercel)                            │
│  │   ├── backend/            ← B2C Backend (Render)                             │
│  │   └── Database: Supabase Singapore (qfqztrmnvbdmejyclvvc)                    │
│  │                                                                              │
│  └── client-portal/          ← MODULE 4: UNIFIED ENTRY POINT                    │
│      └── apps/web/           ← Simple landing page with 3 buttons               │
│          └── Buttons: [OMS + WMS] [B2C Courier] [B2B Logistics]                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## MODULE DETAILS

### MODULE 1: OMS + WMS
**Purpose:** Order Management System + Warehouse Management System
**Users:** Clients who want to run warehouses on CJDQuick tech stack
**Location:** `/CJDQuickApp/oms/`
**Database:** Supabase Tokyo (`rilakxywitslblkgikzf`)
**Features:**
- Super Admin Panel (Master Control Panel)
- Orders, Waves, Picklists, Packing, Manifest
- Inventory, Inbound, Returns, QC
- Control Tower, NDR (for OMS orders)
- Logistics & Delivery (USES transport - FTL/PTL/B2C via API integration)
- Finance, Reports, Analytics

### MODULE 2: B2B LOGISTICS
**Purpose:** B2B Freight Transport Services (PTL/FTL)
**Users:** Clients who hand over inventory for B2B distribution
**Location:** `/CJDQuickApp/b2b/`
**Database:** NEW Supabase B2B (to be created)
**Features:**
- FTL Bookings (Full Truck Load)
- LTL/PTL Bookings (Part Truck Load)
- LR Management (Lorry Receipts)
- Consignee Management
- POD Management (Proof of Delivery)
- Vehicle Tracking
- Freight Finance

### MODULE 3: B2C COURIER
**Purpose:** Direct-to-Consumer Parcel Delivery Services
**Users:** Clients who need last-mile delivery for e-commerce
**Location:** `/CJDQuickApp/b2c/`
**Database:** Supabase Singapore (`qfqztrmnvbdmejyclvvc`)
**Features:**
- Shipment Creation (single/bulk)
- NDR Management
- COD Reconciliation
- Pickup Address Management
- Tracking
- Courier Finance

### MODULE 4: CLIENT PORTAL
**Purpose:** Unified login and service selection
**Users:** All clients - they choose which service to access
**Location:** `/CJDQuickApp/client-portal/`
**Database:** None (static site - just redirects)
**Features:**
- Login page
- Service selection buttons
- Redirects to appropriate module

---

# ⚠️ COMPLETE DEPLOYMENT ARCHITECTURE (Updated: 2026-01-22)

## DEPLOYMENT OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           CJDQuick - COMPLETE DEPLOYMENT ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              MODULE 1: OMS + WMS (LIVE)                                      │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────────────┤   │
│  │   VERCEL                         RENDER                         SUPABASE                   │   │
│  │   oms-sable.vercel.app   ───▶    cjdquick-api-vr4w.onrender.com ───▶  Tokyo (rilakxy...)   │   │
│  │   Next.js 16 | Port 3000         FastAPI | Port 8000                  ✅ LIVE              │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              MODULE 2: B2B LOGISTICS (NEW)                                   │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────────────┤   │
│  │   VERCEL                         RENDER                         SUPABASE                   │   │
│  │   cjdquick-b2b.vercel.app ───▶   cjdquick-b2b-api.onrender.com ───▶  Mumbai (NEW)          │   │
│  │   Next.js 16 | Port 3001         FastAPI | Port 8001                  ⏳ TO CREATE         │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              MODULE 3: B2C COURIER (LIVE)                                    │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────────────┤   │
│  │   VERCEL                         RENDER                         SUPABASE                   │   │
│  │   b2c-frontend-gamma.vercel.app  cjdquick-b2c-api.onrender.com ───▶  Singapore (qfqztr...) │   │
│  │   Next.js 16 | Port 3002         FastAPI | Port 8002                  ✅ LIVE              │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              MODULE 4: CLIENT PORTAL (NEW)                                   │   │
│  ├─────────────────────────────────────────────────────────────────────────────────────────────┤   │
│  │   VERCEL                         NO BACKEND                     NO DATABASE                │   │
│  │   cjdquick-portal.vercel.app     (Static site)                  (Just redirects)           │   │
│  │   Next.js 16 | Port 3003                                              ⏳ TO CREATE         │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## DEPLOYMENT SUMMARY TABLE

| Module | Vercel (Frontend) | Render (Backend) | Supabase (Database) | Status |
|--------|-------------------|------------------|---------------------|--------|
| **OMS + WMS** | oms-sable.vercel.app | cjdquick-api-vr4w.onrender.com | Tokyo (rilakxy...) | ✅ Live |
| **B2B Logistics** | cjdquick-b2b.vercel.app | cjdquick-b2b-api.onrender.com | Mumbai (NEW) | ⏳ To Create |
| **B2C Courier** | b2c-frontend-gamma.vercel.app | cjdquick-b2c-api.onrender.com | Singapore (qfqztr...) | ✅ Live |
| **Client Portal** | cjdquick-portal.vercel.app | None (static) | None | ⏳ To Create |

## SUPABASE DATABASES

| Module | Project Name | Region | Project Ref | Status |
|--------|--------------|--------|-------------|--------|
| OMS + WMS | CJDQuick OMS | Tokyo (ap-northeast-1) | rilakxywitslblkgikzf | ✅ Live |
| B2B Logistics | CJDQuick B2B | Mumbai (ap-south-1) | (to be created) | ⏳ Pending |
| B2C Courier | CJD QUICK B2C | Singapore (ap-southeast-1) | qfqztrmnvbdmejyclvvc | ✅ Live |

---

## STEP-BY-STEP DEPLOYMENT GUIDE

### STEP 1: Create B2B Supabase Database

```
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Configure:
   - Organization: Your organization
   - Name: CJDQuick B2B Logistics
   - Database Password: Aquapurite2026 (or generate new)
   - Region: South Asia (Mumbai) - ap-south-1
4. Click "Create new project"
5. Wait for project to be ready (~2 minutes)
6. Go to Settings → Database → Connection string
7. Copy the "URI" connection string (Session Mode / Port 6543)
8. Add ?pgbouncer=true to the end
```

**Connection String Format:**
```
postgresql://postgres.<project-ref>:Aquapurite2026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### STEP 2: Deploy B2B Backend to Render

```
1. Go to https://dashboard.render.com
2. Click "New" → "Web Service"
3. Connect GitHub repository: singhmantoshkumar22/cjdquick-app
4. Configure:
   - Name: cjdquick-b2b-api
   - Region: Singapore
   - Branch: main
   - Root Directory: b2b/backend
   - Runtime: Python 3
   - Build Command: pip install -r requirements.txt
   - Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
5. Add Environment Variables:
   - DATABASE_URL: (from Step 1)
   - SECRET_KEY: (generate with: openssl rand -hex 32)
   - FRONTEND_URL: https://cjdquick-b2b.vercel.app
   - PYTHON_VERSION: 3.11.0
6. Click "Create Web Service"
```

### STEP 3: Deploy B2B Frontend to Vercel

```
1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import from GitHub: singhmantoshkumar22/cjdquick-app
4. Configure:
   - Framework Preset: Next.js
   - Root Directory: b2b
   - Build Command: cd apps/web && npm run build
   - Output Directory: apps/web/.next
5. Add Environment Variables:
   - NEXT_PUBLIC_API_URL: https://cjdquick-b2b-api.onrender.com
   - AUTH_SECRET: (generate with: openssl rand -hex 32)
   - NEXTAUTH_SECRET: (same as AUTH_SECRET)
   - NEXTAUTH_URL: https://cjdquick-b2b.vercel.app
   - AUTH_TRUST_HOST: true
6. Click "Deploy"
```

### STEP 4: Deploy Client Portal to Vercel

```
1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import from GitHub: singhmantoshkumar22/cjdquick-app
4. Configure:
   - Framework Preset: Next.js
   - Root Directory: client-portal
   - Build Command: cd apps/web && npm run build
   - Output Directory: apps/web/.next
5. Add Environment Variables:
   - NEXT_PUBLIC_OMS_URL: https://oms-sable.vercel.app
   - NEXT_PUBLIC_B2B_URL: https://cjdquick-b2b.vercel.app
   - NEXT_PUBLIC_B2C_URL: https://b2c-frontend-gamma.vercel.app
6. Click "Deploy"
```

---

## ENVIRONMENT VARIABLES REFERENCE

### OMS + WMS

**Vercel (oms-sable):**
```bash
NEXT_PUBLIC_API_URL=https://cjdquick-api-vr4w.onrender.com
AUTH_SECRET=<secret>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://oms-sable.vercel.app
AUTH_TRUST_HOST=true
```

**Render (cjdquick-api):**
```bash
DATABASE_URL=postgresql://postgres.rilakxywitslblkgikzf:Aquapurite2026@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=<secret>
FRONTEND_URL=https://oms-sable.vercel.app
```

### B2B Logistics

**Vercel (cjdquick-b2b):**
```bash
NEXT_PUBLIC_API_URL=https://cjdquick-b2b-api.onrender.com
AUTH_SECRET=<generate-new>
NEXTAUTH_SECRET=<same-as-AUTH_SECRET>
NEXTAUTH_URL=https://cjdquick-b2b.vercel.app
AUTH_TRUST_HOST=true
```

**Render (cjdquick-b2b-api):**
```bash
DATABASE_URL=postgresql://postgres.<b2b-project-ref>:Aquapurite2026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=<generate-new>
FRONTEND_URL=https://cjdquick-b2b.vercel.app
PYTHON_VERSION=3.11.0
```

### B2C Courier

**Vercel (b2c-frontend):**
```bash
NEXT_PUBLIC_API_URL=https://cjdquick-b2c-api.onrender.com
AUTH_SECRET=<secret>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://b2c-frontend-gamma.vercel.app
AUTH_TRUST_HOST=true
```

**Render (cjdquick-b2c-api):**
```bash
DATABASE_URL=postgresql://postgres.qfqztrmnvbdmejyclvvc:Aquapurite2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=<secret>
FRONTEND_URL=https://b2c-frontend-gamma.vercel.app
PYTHON_VERSION=3.11.0
```

### Client Portal

**Vercel (cjdquick-portal):**
```bash
NEXT_PUBLIC_OMS_URL=https://oms-sable.vercel.app
NEXT_PUBLIC_B2B_URL=https://cjdquick-b2b.vercel.app
NEXT_PUBLIC_B2C_URL=https://b2c-frontend-gamma.vercel.app
```

---

## LOCAL DEVELOPMENT PORTS

| Module | Frontend Port | Backend Port | URL |
|--------|---------------|--------------|-----|
| OMS + WMS | 3000 | 8000 | http://localhost:3000 |
| B2B Logistics | 3001 | 8001 | http://localhost:3001 |
| B2C Courier | 3002 | 8002 | http://localhost:3002 |
| Client Portal | 3003 | - | http://localhost:3003 |

---

## DEPLOYMENT FILES REFERENCE

| Module | Vercel Config | Render Config | Env Template |
|--------|---------------|---------------|--------------|
| OMS | `oms/vercel.json` | `oms/backend/render.yaml` | `oms/apps/web/.env.example` |
| B2B | `b2b/vercel.json` | `b2b/backend/render.yaml` | `b2b/apps/web/.env.example` |
| B2C | (existing) | (existing) | (existing) |
| Portal | `client-portal/vercel.json` | None | `client-portal/apps/web/.env.example`
**Database:** None (just redirects to modules)
**Features:**
- Login page
- Service selection: [OMS + WMS] [B2C Courier] [B2B Logistics]
- Redirects to appropriate module based on selection

---

## DATABASE ARCHITECTURE (COMPLETELY SEPARATED)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SEPARATION                                    │
│                    (NO CROSS-DATABASE CONNECTIONS ALLOWED)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐│
│  │  Supabase TOKYO       │  │  Supabase SINGAPORE   │  │  Supabase B2B (NEW)   ││
│  │  (OMS + WMS)          │  │  (B2C Courier)        │  │  (B2B Logistics)      ││
│  ├───────────────────────┤  ├───────────────────────┤  ├───────────────────────┤│
│  │  rilakxywitslblkgikzf │  │  qfqztrmnvbdmejyclvvc │  │  (to be created)      ││
│  │  Region: Tokyo        │  │  Region: Singapore    │  │  Region: TBD          ││
│  ├───────────────────────┤  ├───────────────────────┤  ├───────────────────────┤│
│  │  Tables:              │  │  Tables:              │  │  Tables:              ││
│  │  • users              │  │  • users              │  │  • users              ││
│  │  • companies          │  │  • companies          │  │  • companies          ││
│  │  • orders             │  │  • shipments          │  │  • ftl_bookings       ││
│  │  • order_items        │  │  • ndr                │  │  • ltl_bookings       ││
│  │  • waves              │  │  • cod_reconciliation │  │  • lorry_receipts     ││
│  │  • picklists          │  │  • pickup_addresses   │  │  • consignees         ││
│  │  • inventory          │  │  • transporters       │  │  • pod                ││
│  │  • skus               │  │  • rate_cards         │  │  • vehicles           ││
│  │  • warehouses         │  │  • ...                │  │  • drivers            ││
│  │  • returns            │  │                       │  │  • freight_invoices   ││
│  │  • ...                │  │                       │  │  • ...                ││
│  └───────────────────────┘  └───────────────────────┘  └───────────────────────┘│
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## LOCAL DEVELOPMENT PORTS

| Module | Frontend Port | Backend Port | URL |
|--------|---------------|--------------|-----|
| OMS + WMS | 3000 | 8000 | http://localhost:3000 |
| B2B Logistics | 3001 | 8001 | http://localhost:3001 |
| B2C Courier | 3002 | 8002 | http://localhost:3002 |
| Client Portal | 3003 | - | http://localhost:3003 |

---

# ⚠️ CODEBASE STRUCTURE RULES (MANDATORY)

## RULE 1: SUPABASE IS SINGLE SOURCE OF TRUTH

**All schema definitions MUST originate from Supabase:**

```
FLOW: Supabase Table → Backend Model (SQLModel) → Frontend Types (Generated)
      ────────────────────────────────────────────────────────────────────
      NEVER create models in backend that don't exist in Supabase first!
```

### Schema Creation Process:
```bash
# Step 1: Create table in Supabase SQL Editor
CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    field_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

# Step 2: Create SQLModel in backend (MUST match Supabase exactly)
# Step 3: Create API endpoints
# Step 4: Regenerate frontend types: npm run generate-api:prod
```

---

## RULE 2: NAMING CONVENTIONS (STRICTLY ENFORCED)

### Database (Supabase) - snake_case
```sql
-- Table names: snake_case, plural
CREATE TABLE orders (...);
CREATE TABLE order_items (...);
CREATE TABLE ftl_bookings (...);

-- Column names: snake_case
company_id, created_at, updated_at, order_no, shipment_status
```

### Backend (Python) - snake_case for DB, camelCase for API
```python
# SQLModel fields: Match database exactly (snake_case)
class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: UUID = Field(primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id")  # snake_case
    order_no: str
    created_at: datetime
    updated_at: datetime

# Pydantic aliases for API: camelCase
class OrderResponse(SQLModel):
    id: UUID
    companyId: UUID = Field(alias="company_id")  # camelCase for API
    orderNo: str = Field(alias="order_no")
    createdAt: datetime = Field(alias="created_at")
    updatedAt: datetime = Field(alias="updated_at")

    class Config:
        populate_by_name = True
```

### Frontend (TypeScript) - camelCase
```typescript
// All frontend types use camelCase (auto-generated from API)
interface Order {
  id: string;
  companyId: string;
  orderNo: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## RULE 3: REQUIRED FIELDS FOR ALL TABLES

**Every table MUST have these fields:**

```sql
-- Supabase
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
company_id UUID NOT NULL REFERENCES companies(id),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

```python
# Backend SQLModel
id: UUID = Field(default_factory=uuid4, primary_key=True)
company_id: UUID = Field(foreign_key="companies.id", index=True)
created_at: datetime = Field(default_factory=datetime.utcnow)
updated_at: datetime = Field(default_factory=datetime.utcnow)
```

---

## RULE 4: DATA TYPE MAPPING (STRICT)

| Supabase (PostgreSQL) | Backend (Python) | Frontend (TypeScript) | Notes |
|-----------------------|------------------|----------------------|-------|
| `UUID` | `UUID` | `string` | Auto-serialized |
| `TIMESTAMPTZ` | `datetime` | `string` (ISO 8601) | Auto-serialized |
| `NUMERIC(10,2)` | `Decimal` | `string` | ⚠️ Parse in frontend! |
| `INTEGER` | `int` | `number` | Auto |
| `BOOLEAN` | `bool` | `boolean` | Auto |
| `VARCHAR(n)` | `str` | `string` | Auto |
| `TEXT` | `str` | `string` | Auto |
| `JSONB` | `dict` | `object` | Auto |
| `VARCHAR[]` | `List[str]` | `string[]` | Auto |

### CRITICAL: Decimal Handling
```typescript
// Frontend MUST use this helper for all Decimal fields
const parseDecimal = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value;
};

// Usage
const total = parseDecimal(order.subtotal) + parseDecimal(order.taxAmount);
```

---

## RULE 5: ENUM CONSISTENCY

**Enums MUST be defined in all three layers:**

```sql
-- Step 1: Supabase - Create enum type
CREATE TYPE order_status AS ENUM ('CREATED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
```

```python
# Step 2: Backend - Python enum (MUST match Supabase exactly)
class OrderStatus(str, Enum):
    CREATED = "CREATED"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
```

```typescript
// Step 3: Frontend - Auto-generated, but verify matches
type OrderStatus = 'CREATED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
```

---

## RULE 6: NO CROSS-MODULE IMPORTS

```
❌ FORBIDDEN:
   - oms/backend importing from b2b/backend
   - b2c/apps/web importing from oms/apps/web
   - Any shared code between modules

✅ ALLOWED:
   - API calls between modules (HTTP requests)
   - Each module is 100% self-contained
```

---

# ⚠️ MANDATORY DEPLOYMENT CHECKLIST

## BEFORE ANY DEPLOYMENT - MUST FOLLOW THIS SEQUENCE:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CHECKLIST (MANDATORY)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STEP 1: BUILD TEST                                                             │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  cd oms && npm run build                                                        │
│  ✓ Must pass with NO errors                                                     │
│  ✓ Check for TypeScript warnings                                                │
│                                                                                 │
│  STEP 2: START LOCAL SERVERS                                                    │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  # Terminal 1: Backend                                                          │
│  cd oms/backend && uvicorn app.main:app --reload --port 8000                    │
│                                                                                 │
│  # Terminal 2: Frontend                                                         │
│  cd oms && npm run dev                                                          │
│  ✓ Both servers must start without errors                                       │
│                                                                                 │
│  STEP 3: TEST AFFECTED PAGES LOCALLY                                            │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  ✓ Open http://localhost:3000                                                   │
│  ✓ Login with test credentials                                                  │
│  ✓ Navigate to ALL pages affected by changes                                    │
│  ✓ Verify data loads correctly                                                  │
│  ✓ Verify forms submit correctly                                                │
│                                                                                 │
│  STEP 4: TEST API ENDPOINTS WITH REAL DATA                                      │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  ✓ Test GET endpoints return correct data                                       │
│  ✓ Test POST endpoints create records                                           │
│  ✓ Test PATCH endpoints update records                                          │
│  ✓ Test DELETE endpoints remove records                                         │
│  ✓ Verify multi-tenancy (companyId filtering works)                             │
│                                                                                 │
│  STEP 5: PUSH TO PRODUCTION                                                     │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  git add .                                                                      │
│  git commit -m "Description of changes"                                         │
│  ./scripts/deploy-all.sh                                                        │
│                                                                                 │
│  STEP 6: VERIFY PRODUCTION AFTER DEPLOY                                         │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  ✓ Wait for Vercel deployment to complete                                       │
│  ✓ Wait for Render deployment to complete                                       │
│  ✓ Test production URL: https://oms-sable.vercel.app                            │
│  ✓ Login and verify affected features work                                      │
│  ✓ Check Render logs for any backend errors                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Quick Checklist (Copy-Paste for PR/Commits):

```markdown
## Deployment Checklist
- [ ] `npm run build` passes
- [ ] Local backend starts (`uvicorn`)
- [ ] Local frontend starts (`npm run dev`)
- [ ] Tested affected pages locally
- [ ] Tested API endpoints with real data
- [ ] Pushed to production
- [ ] Verified production deployment
```

---

# LEGACY SECTIONS BELOW (Still Valid)

---

## CRITICAL: Complete Deployment Architecture (Updated: 2026-01-22)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DEPLOYMENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────── OMS (Main) ────────────────────────────┐         │
│   │                                                                    │         │
│   │   VERCEL                    RENDER                   SUPABASE     │         │
│   │   ┌─────────────┐          ┌─────────────┐          ┌──────────┐ │         │
│   │   │ oms         │   ───▶   │ cjdquick-api│   ───▶   │ Tokyo    │ │         │
│   │   │ Next.js 16  │          │ FastAPI     │          │ rilakxy..│ │         │
│   │   │ Virginia    │          │ Virginia    │          │          │ │         │
│   │   └─────────────┘          └─────────────┘          └──────────┘ │         │
│   │   oms-sable.vercel.app     cjdquick-api-vr4w.onrender.com        │         │
│   └────────────────────────────────────────────────────────────────────┘         │
│                                                                                  │
│   ┌─────────────────────────── B2C (Client) ──────────────────────────┐         │
│   │                                                                    │         │
│   │   VERCEL                    RENDER                   SUPABASE     │         │
│   │   ┌─────────────┐          ┌─────────────┐          ┌──────────┐ │         │
│   │   │b2c-frontend │   ───▶   │cjdquick-b2c │   ───▶   │Singapore │ │         │
│   │   │ Next.js 16  │          │ FastAPI     │          │ qfqztr.. │ │         │
│   │   │             │          │ Singapore   │          │          │ │         │
│   │   └─────────────┘          └─────────────┘          └──────────┘ │         │
│   │   b2c-frontend-gamma.vercel.app  cjdquick-b2c-api.onrender.com   │         │
│   └────────────────────────────────────────────────────────────────────┘         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## RENDER SERVICES (Updated: 2026-01-22)

### Active Services

| Service Name | Type | Runtime | Region | URL | Database | Status |
|--------------|------|---------|--------|-----|----------|--------|
| `cjdquick-api` | Web Service | Python 3 | **Virginia** | https://cjdquick-api-vr4w.onrender.com | Tokyo Supabase | ✅ Active |
| `cjdquick-b2c-api` | Web Service | Python 3 | **Singapore** | https://cjdquick-b2c-api.onrender.com | Singapore Supabase | ✅ Active |

### Suspended Services

| Service Name | Type | Runtime | Region | Status |
|--------------|------|---------|--------|--------|
| `cjdquick-oms` | Web Service | Node | Virginia | ⏸️ Suspended |

---

## VERCEL PROJECTS (Updated: 2026-01-22)

| Project Name | URL | Backend API | Purpose | Status |
|--------------|-----|-------------|---------|--------|
| `oms` | https://oms-sable.vercel.app | cjdquick-api-vr4w.onrender.com | **Main OMS Frontend** | ✅ Active |
| `b2c-frontend` | https://b2c-frontend-gamma.vercel.app | cjdquick-b2c-api.onrender.com | **B2C Client Frontend** | ✅ Active |

---

## SUPABASE DATABASES (Updated: 2026-01-22)

### Main OMS Database (Tokyo)

| Setting | Value |
|---------|-------|
| Project Name | CJDQuick OMS |
| Project Ref | `rilakxywitslblkgikzf` |
| Region | ap-northeast-1 (Tokyo) |
| Dashboard | https://supabase.com/dashboard/project/rilakxywitslblkgikzf |

**Connection String (with pgbouncer=true - REQUIRED):**
```
postgresql://postgres.rilakxywitslblkgikzf:Aquapurite2026@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### B2C Database (Singapore)

| Setting | Value |
|---------|-------|
| Project Name | CJD QUICK B2C |
| Project Ref | `qfqztrmnvbdmejyclvvc` |
| Region | ap-southeast-1 (Singapore) |
| Dashboard | https://supabase.com/dashboard/project/qfqztrmnvbdmejyclvvc |

**Connection String (with pgbouncer=true - REQUIRED):**
```
postgresql://postgres.qfqztrmnvbdmejyclvvc:Aquapurite2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## LOGIN CREDENTIALS

### Main OMS

| Panel | Email | Password |
|-------|-------|----------|
| Master Panel (SUPER_ADMIN) | admin@demo.com | admin123 |
| Client Portal (CLIENT) | client@fashionforward.com | brand123 |

### B2C Client

| Panel | Email | Password |
|-------|-------|----------|
| B2C Admin | admin@b2c-client.com | admin123 |

---

## QUICK REFERENCE CARD

```
┌────────────────────────────────────────────────────────────────────────┐
│                           OMS DEPLOYMENT                                │
├────────────────────────────────────────────────────────────────────────┤
│  Frontend:  https://oms-sable.vercel.app (Vercel)                      │
│  Backend:   https://cjdquick-api-vr4w.onrender.com (Render - Virginia) │
│  Database:  Supabase Tokyo (rilakxywitslblkgikzf)                      │
│  Login:     admin@demo.com / admin123                                  │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                           B2C DEPLOYMENT                                │
├────────────────────────────────────────────────────────────────────────┤
│  Frontend:  https://b2c-frontend-gamma.vercel.app (Vercel)             │
│  Backend:   https://cjdquick-b2c-api.onrender.com (Render - Singapore) │
│  Database:  Supabase Singapore (qfqztrmnvbdmejyclvvc)                  │
│  Login:     admin@b2c-client.com / admin123                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Pattern: Backend-Centric

The frontend is a **thin proxy layer**. All API calls go through a single catch-all route:
- `/api/auth/*` - NextAuth authentication
- `/api/v1/*` - Proxied to FastAPI backend

**Key Design Principles:**
1. NO direct database access from Next.js
2. All business logic in FastAPI backend
3. Frontend only handles UI and proxies API calls
4. Authentication via NextAuth with FastAPI backend validation

## ONE COMMAND TO DEPLOY EVERYTHING

```bash
cd oms && ./scripts/deploy-all.sh
```

This single command:
1. Runs build test (catches errors BEFORE deploying)
2. Pushes to origin (GitHub → Vercel auto-deploy)
3. Pushes to singh (GitHub → Render)
4. Triggers Render deploy via Deploy Hook (ensures deploy)
5. Deploys to Vercel production
6. Verifies both deployments

## Auto-Deploy Behavior (IMPORTANT)

| Platform | Trigger | What Changes Trigger Deploy |
|----------|---------|----------------------------|
| **Vercel** | Push to `origin/master` | ANY file change in repo |
| **Render** | Push to `singh/main` | ONLY files in `oms/backend/` |

**Why Render doesn't always auto-deploy:**
Render is configured with `Root Directory: oms/backend`. This means:
- Changes to `oms/apps/web/` (frontend) → Vercel deploys, Render does NOT
- Changes to `oms/backend/` (API) → Both deploy

**To force Render deploy (even without backend changes):**
1. Use `./scripts/deploy-all.sh` (recommended - uses Deploy Hook)
2. Or manually: `./scripts/trigger-render-deploy.sh`
3. Or: Render Dashboard → Manual Deploy

---

## GitHub Repositories

| Remote | Repository | Branch | Purpose |
|--------|------------|--------|---------|
| `origin` | puneet1409/CJDQuickApp | master | Primary repo, Vercel auto-deploy |
| `singh` | singhmantoshkumar22/cjdquick-app | main | Render auto-deploy |
| - | singhmantoshkumar22/cjdquick-b2c | main | B2C Frontend repo |

---

## CRITICAL: Database Connection Format

**ALWAYS use `?pgbouncer=true` in DATABASE_URL for Supabase pooler connections!**

```bash
# Correct format:
DATABASE_URL=postgresql://postgres.{project-ref}:{password}@{region}.pooler.supabase.com:6543/postgres?pgbouncer=true

# Without pgbouncer=true, connections will timeout or fail!
```

## Git Remotes (IMPORTANT)

| Remote | Repository | Branch | Purpose |
|--------|------------|--------|---------|
| `origin` | puneet1409/CJDQuickApp | master | Primary repo, Vercel auto-deploy |
| `singh` | singhmantoshkumar22/cjdquick-app | main | Render auto-deploy |

**ALWAYS push to BOTH remotes:**
```bash
git push origin master
git push singh master:main
```

Or use: `./scripts/deploy-all.sh`

## Project Structure

```
oms/
├── apps/
│   └── web/                    # Next.js frontend (VERCEL)
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/
│       │   │   │   ├── auth/[...nextauth]/  # NextAuth handler
│       │   │   │   └── v1/[...path]/        # Catch-all proxy to FastAPI
│       │   │   └── (dashboard)/             # UI pages
│       │   ├── components/     # React components
│       │   └── lib/
│       │       ├── auth.ts     # NextAuth config (calls FastAPI)
│       │       ├── api/        # Generated OpenAPI client
│       │       └── ai/types.ts # TypeScript types
│       ├── next.config.js
│       └── package.json
│
├── backend/                    # FastAPI backend (RENDER)
│   ├── app/
│   │   ├── api/v1/            # API endpoints
│   │   ├── core/              # Config, security, database
│   │   ├── models/            # SQLModel models
│   │   └── services/          # Business logic
│   ├── requirements.txt
│   └── render.yaml
│
├── packages/
│   ├── integrations/          # External integrations (PDF, CSV)
│   └── shared/                # Shared utilities
│
├── scripts/
│   └── deploy-all.sh          # ONE-COMMAND DEPLOYMENT
│
├── vercel.json                # Vercel deployment config
├── package.json               # Root package.json (workspaces)
└── CLAUDE.md                  # THIS FILE
```

## API Proxy Architecture

The catch-all proxy route (`/api/v1/[...path]/route.ts`) handles:

```typescript
// Authentication flow:
1. Check for X-Service-Key header (service-to-service calls)
2. If not present, get session from NextAuth
3. Forward user context headers to FastAPI:
   - X-User-Id
   - X-User-Role
   - X-Company-Id

// Request flow:
1. Build backend URL from path
2. Forward method, headers, and body
3. Return response with same status
```

## Configuration Files

### vercel.json
```json
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "apps/web/.next"
}
```

### apps/web/next.config.js
```javascript
const nextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "png-js"],
  typescript: { ignoreBuildErrors: true },
  output: "standalone",
};
```

### backend/render.yaml
```yaml
rootDir: backend
branch: main
```

## Quick Commands

```bash
# Deploy everything (RECOMMENDED)
./scripts/deploy-all.sh

# Manual deployment
npm run vercel-build           # Test build locally
git push origin master         # Push to GitHub
git push singh master:main     # Push to Render
npx vercel --prod              # Deploy to Vercel

# Development
npm run dev                    # Start dev servers
npm run build:web              # Build frontend only
npm run validate               # Validate build

# Docker (for local backend development)
npm run docker:up              # Start local PostgreSQL
npm run docker:down            # Stop PostgreSQL
npm run docker:logs            # View PostgreSQL logs
```

## Environment Variables

### Vercel (Frontend) - Set via `npx vercel env`
```
AUTH_SECRET=<secret>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://oms-sable.vercel.app
NEXT_PUBLIC_API_URL=https://cjdquick-api-vr4w.onrender.com
AUTH_TRUST_HOST=true
INTERNAL_API_KEY=<service-key>
```

### Render (Backend - cjdquick-api) - Set in Render Dashboard
```
DATABASE_URL=postgresql://postgres.rilakxywitslblkgikzf:Aquapurite2026@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
SECRET_KEY=<secret>
FRONTEND_URL=https://oms-sable.vercel.app
INTERNAL_API_KEY=<service-key>
```

### Render (Frontend - cjdquick-oms) - Set in Render Dashboard
```
DATABASE_URL=postgresql://postgres.rilakxywitslblkgikzf:Aquapurite2026@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
NEXTAUTH_SECRET=<same-as-AUTH_SECRET>
NEXT_PUBLIC_API_URL=https://cjdquick-api-vr4w.onrender.com
NODE_VERSION=20.11.0
AUTH_TRUST_HOST=true
```

## Login Credentials (Development)

| Panel | Email | Password |
|-------|-------|----------|
| Master Panel (SUPER_ADMIN) | admin@demo.com | admin123 |
| Client Portal (CLIENT) | client@fashionforward.com | brand123 |

## Troubleshooting

### Build Fails on Vercel
1. Run `npm run vercel-build` locally first
2. Check for TypeScript errors (though ignoreBuildErrors is set)
3. Check serverExternalPackages in next.config.js

### Render Not Updating / Auto-Deploy Not Working

**CRITICAL: Render Auto-Deploy Configuration**

1. **Check Render Dashboard Settings** (https://dashboard.render.com):
   - Go to Service "cjdquick-api" → Settings → Build & Deploy
   - Ensure "Auto-Deploy" toggle is **ON**
   - Set "Root Directory" to: `oms/backend`
   - Verify "Branch" is `main`

2. **Verify GitHub Webhook**:
   - Go to GitHub repo → Settings → Webhooks
   - Ensure Render webhook exists and shows recent deliveries

3. **Free tier sleeps after 15 min** - wake with:
   ```bash
   curl https://cjdquick-api-vr4w.onrender.com/health
   ```

### API Calls Failing
1. Check FastAPI backend is running: `curl https://cjdquick-api-vr4w.onrender.com/health`
2. Check NEXT_PUBLIC_API_URL is set correctly in Vercel
3. Check backend logs in Render Dashboard

### Login Not Working
1. Check FastAPI auth endpoint: `curl https://cjdquick-api-vr4w.onrender.com/api/v1/auth/login`
2. Check Vercel env vars: `npx vercel env ls`
3. Redeploy: `npx vercel --prod`

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/v1/[...path]/route.ts` | Catch-all API proxy |
| `apps/web/src/lib/auth.ts` | NextAuth configuration |
| `apps/web/src/lib/api/` | Generated OpenAPI client |
| `backend/app/main.py` | FastAPI app entry point |
| `backend/app/core/config.py` | Backend settings |
| `backend/app/api/v1/` | API endpoints |
| `backend/app/models/` | SQLModel database models |
| `vercel.json` | Vercel deployment config |
| `backend/render.yaml` | Render deployment config |

## Database Architecture

### Backend ORM: SQLModel (SQLAlchemy)
All database operations are in the FastAPI backend using SQLModel:

```python
from sqlmodel import SQLModel, Field
from uuid import UUID, uuid4

class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    ...
```

### ID Strategy: Native PostgreSQL UUID
- 16-byte storage (efficient)
- Native B-tree indexing
- Database-side generation
- Same format as Supabase uses internally

## RULES FOR CLAUDE CODE

1. **ALWAYS run `npm run vercel-build` before committing major changes**
2. **ALWAYS push to BOTH remotes after changes**
3. **NEVER add direct database calls in Next.js** - use the catch-all proxy
4. **ALL business logic goes in FastAPI backend**
5. **Use `./scripts/deploy-all.sh` for deployments**
6. **Frontend is a thin UI layer** - no complex server-side logic

---

## GO-LIVE ROADMAP (Priority Items)

### Completed ✅
- [x] Backend health verified (all APIs working)
- [x] Dashboard API connected
- [x] All frontend pages loading (60+ routes tested)
- [x] Login flow verified
- [x] Fixed Picklists API route ordering
- [x] Fixed NDR list endpoint
- [x] **E2E Order Flow Test PASSED** (2026-01-18)
  - Fixed Delivery model (added companyId field)
  - Test order: E2E-FLOW-TEST-001 → SHIPPED
  - All steps verified: Create → Wave → Picklist → Pack → Ship
- [x] **PDF Generation Working** (2026-01-18)
  - Invoice, Shipping Label, Picklist PDFs all functional
  - Fixed field mapping and numeric parsing issues
- [x] **CSV Import Working** (2026-01-18)
  - Order bulk import from CSV files
  - Multiple items per order supported
  - Fixed field mappings and companyId
- [x] **Integration Settings UI Wired** (2026-01-18)
  - Transporters page fixed (API path bug)
  - Integrations settings page fixed (channel/transporter APIs)
  - Backend APIs verified working
- [x] **Production Hardening Complete** (2026-01-18)
  - Error boundaries and loading states for all route groups
  - Centralized error logging utility
  - Security audit passed (auth on all routes)

### Priority 1: End-to-End Order Flow Test
**Status: COMPLETED ✅**

Tested order lifecycle (2026-01-18):
```
1. ✓ Create Order (E2E-FLOW-TEST-001)
2. ✓ Create Wave (WAVE-E2E-001)
3. ✓ Generate Picklist (PL-E2E-001)
4. ✓ Pack Order (status → PACKED)
5. ✓ Create Shipment (DEL-E2E-TEST-009)
6. ✓ Generate AWB (AWB123456789)
7. ✓ Ship Order (status → SHIPPED)
```

### Priority 2: Enable PDF Generation
**Status: COMPLETED ✅**

All PDF routes tested and working (2026-01-18):
- ✓ Invoice PDF: `/api/print/invoice/[id]` - Returns valid PDF
- ✓ Shipping Label PDF: `/api/print/label/[id]` - Returns valid PDF
- ✓ Picklist PDF: `/api/print/picklist/[id]` - Returns valid PDF

Fixed: Field mapping issues (orderNo vs orderNumber, line1 vs addressLine1)
Fixed: Numeric value parsing (API returns strings, PDF expects numbers)

### Priority 3: Enable CSV Import
**Status: COMPLETED ✅**

CSV Import tested and working (2026-01-18):
- ✓ Frontend import page fully functional at `/orders/import`
- ✓ Backend POST `/api/v1/orders/import` working
- ✓ Multiple items per order supported (grouped by order_no)
- ✓ Test import: IMP-TEST-001 created with 2 SKUs

Fixed: Field names (discount, shippingCharges, line1/line2)
Fixed: Added companyId to imported orders
Note: SKU must exist before import (fails with clear error if not found)

### Priority 4: Wire Integration Settings UI
**Status: COMPLETED ✅**

Integration UI wired to backend APIs (2026-01-18):
- ✓ `apps/web/src/app/(dashboard)/settings/integrations/page.tsx` - Fixed API paths
- ✓ `apps/web/src/app/(dashboard)/logistics/transporters/page.tsx` - Fixed duplicate v1 path bug
- ✓ Backend APIs verified: `/api/v1/transporters`, `/api/v1/channels/configs`
- ✓ Current transporters: Delhivery, Self Ship
- ✓ Ready to add more channels (Shopify, Amazon, Flipkart, etc.)
- ✓ Ready to add more transporters (Shiprocket, BlueDart, etc.)

Fixed: API path `/api/v1/v1/transporters` → `/api/v1/transporters`
Fixed: Channel config path `/api/v1/channels` → `/api/v1/channels/configs`
Fixed: Sync endpoint path to use correct route
Fixed: Response format handling (backend returns array directly)

### Priority 5: Production Hardening
**Status: COMPLETED ✅**

Production hardening completed (2026-01-18):
- ✓ Error boundaries exist for all route groups (dashboard, client-portal, b2b-portal)
- ✓ Loading states added to all route groups
- ✓ Created centralized error logging utility (`lib/error-logger.ts`)
- ✓ Root-level error.tsx and global-error.tsx in place
- ✓ Security audit passed:
  - NextAuth v5 protects all routes (authorized callback)
  - All API routes check authentication
  - PDF routes return 401 if unauthenticated
  - Backend enforces RBAC on all endpoints
  - User context headers passed to backend

Files added/verified:
- `apps/web/src/app/(dashboard)/loading.tsx`
- `apps/web/src/app/(client-portal)/loading.tsx`
- `apps/web/src/app/(b2b-portal)/loading.tsx`
- `apps/web/src/lib/error-logger.ts`
- Error boundaries already existed for all route groups

---

## COMPREHENSIVE SYSTEM AUDIT (2026-01-18)

### Overview
- **Total Frontend Pages:** 165 pages across 5 route groups
- **Total Backend API Modules:** 24 modules with 200+ endpoints
- **System Status:** Production-ready, all major features implemented

### Frontend Pages Inventory

#### Dashboard Route Group (106 pages)
| Section | Pages | Status |
|---------|-------|--------|
| Dashboard | `/dashboard`, `/dashboard/seller-panel` | ✅ Live |
| Control Tower | `/control-tower`, `/control-tower/ndr`, `/control-tower/ai-actions`, `/control-tower/proactive` | ✅ Live |
| Orders | `/orders`, `/orders/[id]`, `/orders/import`, `/orders/new`, `/orders/[id]/edit` | ✅ Live |
| WMS/Fulfillment | `/wms/waves`, `/wms/picklist`, `/wms/packing`, `/wms/manifest`, `/wms/gate-pass`, `/wms/delivery-shipping` | ✅ Live |
| QC | `/wms/qc/templates`, `/wms/qc/executions` + detail pages | ✅ Live |
| Inbound | `/inbound`, `/inbound/purchase-orders`, `/inbound/receiving`, `/inbound/qc` | ✅ Live |
| Inventory | `/inventory`, `/inventory/adjustment`, `/inventory/cycle-count`, `/inventory/movements`, `/inventory/virtual` | ✅ Live |
| Logistics | `/logistics/tracking`, `/logistics/awb`, `/logistics/transporters`, `/logistics/rate-cards`, `/logistics/shipping-rules`, `/logistics/allocation-rules`, `/logistics/pincodes` | ✅ Live |
| Returns | `/returns`, `/returns/rto`, `/returns/qc`, `/returns/refunds` | ✅ Live |
| Finance | `/finance/cod-reconciliation`, `/finance/freight-billing`, `/finance/weight-discrepancy`, `/finance/payment-ledger`, `/finance/dashboard` | ✅ Live |
| Reports | `/reports/sales`, `/reports/inventory`, `/reports/logistics`, `/reports/finance`, `/reports/scheduled` | ✅ Live |
| Channels | `/channels`, `/channels/sync` | ✅ Live |
| Settings | `/settings/company`, `/settings/users`, `/settings/integrations`, `/settings/skus`, `/settings/locations`, `/settings/bundles` | ✅ Live |
| B2B | `/b2b/customers`, `/b2b/quotations`, `/b2b/credit`, `/b2b/price-lists` | ✅ Live |
| Procurement | `/procurement/purchase-orders`, `/procurement/vendors` | ✅ Live |
| Master (Super Admin) | `/master/brands`, `/master/companies` | ✅ Live |

#### Client Portal (54 pages)
Full mirror of dashboard functionality for tenant self-service at `/client/*`.

#### B2B Portal (9 pages)
Public-facing B2B customer portal at `/portal/*`.

### Backend API Modules Inventory

| Module | Prefix | Key Endpoints | Status |
|--------|--------|---------------|--------|
| **auth** | `/v1/auth` | login, me, refresh, logout | ✅ Live |
| **users** | `/v1/users` | CRUD, count, search | ✅ Live |
| **companies** | `/v1/companies` | CRUD, count | ✅ Live |
| **locations** | `/v1/locations` | CRUD, zones, bins | ✅ Live |
| **skus** | `/v1/skus` | CRUD, categories, brands | ✅ Live |
| **inventory** | `/v1/inventory` | CRUD, adjust, transfer, summary | ✅ Live |
| **orders** | `/v1/orders` | CRUD, items, deliveries, import, stats | ✅ Live |
| **customers** | `/v1/customers` | CRUD, groups, credit | ✅ Live |
| **waves** | `/v1/waves` | CRUD, items, orders, picklists | ✅ Live |
| **inbound** | `/v1/inbound` | CRUD, items, complete | ✅ Live |
| **returns** | `/v1/returns` | CRUD, items, receive, qc, process | ✅ Live |
| **ndr** | `/v1/ndr` | CRUD, outreach, ai-actions, summary | ✅ Live |
| **transporters** | `/v1/transporters` | CRUD, configs, manifests | ✅ Live |
| **logistics** | `/v1/logistics` | rate-cards, shipping-rules, pincodes, awb | ✅ Live |
| **channels** | `/v1/channels` | configs, imports, sync | ✅ Live |
| **qc** | `/v1/qc` | templates, parameters, executions, results | ✅ Live |
| **b2b** | `/v1/b2b` | quotations, price-lists | ✅ Live |
| **procurement** | `/v1/procurement` | purchase-orders, vendors | ✅ Live |
| **finance** | `/v1/finance` | cod, freight, weight-discrepancy, ledger | ✅ Live |
| **communications** | `/v1/communications` | proactive, templates | ✅ Live |
| **analytics** | `/v1/analytics` | dashboard stats | ✅ Live |
| **dashboard** | `/v1/dashboard` | overview stats | ✅ Live |
| **wms_extended** | `/v1/wms` | extended operations | ✅ Live |
| **system** | `/v1/system` | health, config | ✅ Live |

### Control Tower Features (AI-Powered)

| Page | Path | Features |
|------|------|----------|
| **Overview** | `/control-tower` | Real-time SLA monitoring, D0/D1/D2 predictions, carrier health, capacity alerts, inventory health |
| **NDR Command Center** | `/control-tower/ndr` | AI-powered NDR resolution, automated outreach (WhatsApp, SMS, AI Voice, Email), reason analysis |
| **AI Actions** | `/control-tower/ai-actions` | Monitor all AI automation (classify, outreach, resolve, sentiment, priority, escalation, prediction) |
| **Proactive Alerts** | `/control-tower/proactive` | Automated notifications (order confirmed, shipped, out for delivery, delays, SLA breach risk) |

### Coverage Matrix

| Category | Frontend | Backend | Status |
|----------|----------|---------|--------|
| Authentication | ✅ | ✅ | Complete |
| Dashboard | ✅ | ✅ | Complete |
| Control Tower / NDR | ✅ | ✅ | Complete |
| Orders | ✅ | ✅ | Complete |
| WMS / Fulfillment | ✅ | ✅ | Complete |
| Inventory | ✅ | ✅ | Complete |
| Logistics | ✅ | ✅ | Complete |
| Returns | ✅ | ✅ | Complete |
| Finance | ✅ | ✅ | Complete |
| Settings | ✅ | ✅ | Complete |
| Channels | ✅ | ✅ | Complete |
| B2B | ✅ | ✅ | Complete |
| Reports | ✅ | ✅ | Complete |

### Issues Found & Fixed (2026-01-18)

1. **Control Tower Missing from Navigation** - FIXED
   - Pages existed but were not linked in sidebar
   - Added Control Tower section with Overview, NDR, AI Actions, Proactive Alerts
   - File: `apps/web/src/components/layout/app-sidebar.tsx`

2. **NDR API 500 Internal Server Error** - FIXED
   - `/api/v1/ndr` and `/api/v1/ndr/summary` endpoints returning 500 error
   - **Root Cause:** SQLModel returning raw strings from PostgreSQL instead of Python enum objects
   - When enum fields (reason, status, priority) were stored as strings in DB, calling `.value` on them failed
   - **Solution:** Added `safe_enum_value()` helper function that handles both enum objects and raw strings
   - File: `backend/app/api/v1/ndr/__init__.py`
   - **Verification:** All NDR endpoints now working (49 NDRs, list/summary/count all return 200)

### Packages/Integrations Available

| Type | Count | Items |
|------|-------|-------|
| **Channel Integrations** | 9 | Shopify, Amazon, Flipkart, Myntra, AJIO, Meesho, Nykaa, TataCliq, JioMart |
| **Transporter Integrations** | 8 | Shiprocket, Delhivery, BlueDart, Ekart, Shadowfax, DTDC, EcomExpress, Xpressbees |
| **Aggregator** | 1 | ClickPost |
| **PDF Generators** | 3 | Invoice (GST), Shipping Label, Picklist |
| **Importers** | 3 | CSV Parser, Order Importer, SKU Importer |

### Navigation Structure

```
Sidebar Navigation:
├── Dashboard
├── Control Tower (NEW - Added 2026-01-18)
│   ├── Overview
│   ├── NDR Command Center
│   ├── AI Actions
│   └── Proactive Alerts
├── Operations
│   ├── Orders (All Orders, Import, B2B)
│   ├── Fulfillment (Waves, Picklist, Packing, Manifest, Gate Pass)
│   ├── Inbound (Purchase Orders, ASN/Receiving)
│   ├── Inventory (Stock, Adjustments, Cycle Count, Movements)
│   ├── Shipping & Logistics (Tracking, AWB, NDR)
│   ├── Returns (Customer, RTO, QC, Refunds)
│   └── Quality Control (Queue, Inbound QC, Templates)
├── Analytics & Finance
│   ├── Finance (COD, Freight, Weight, Ledger)
│   └── Reports (Sales, Inventory, Logistics, Finance, Scheduled)
└── Configuration
    ├── Catalog (SKU Master, Bundles, B2B Customers)
    ├── Warehouse Setup (Locations)
    ├── Logistics Setup (Couriers, Rate Cards, Rules, Pincodes)
    ├── Channels (Marketplace, Sync)
    └── Settings (Company, Users, API)
```

---

## OMS vs B2C DEPLOYMENT GUIDE (Updated: 2026-01-22)

### Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OMS DEPLOYMENT                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend:  https://oms-sable.vercel.app (Vercel - PRIMARY)             │
│  Backend:   https://cjdquick-api-vr4w.onrender.com (Render - Virginia)  │
│  Database:  Supabase Tokyo (rilakxywitslblkgikzf)                       │
│  Region:    ap-northeast-1 (Tokyo)                                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         B2C DEPLOYMENT                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Frontend:  https://b2c-frontend-gamma.vercel.app (Vercel)              │
│  Backend:   https://cjdquick-b2c-api.onrender.com (Render - Singapore)  │
│  Database:  Supabase Singapore (qfqztrmnvbdmejyclvvc)                   │
│  Region:    ap-southeast-1 (Singapore)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### How to Identify Services on Render

| Service Name | Region | Database | Purpose |
|--------------|--------|----------|---------|
| `cjdquick-api` / `cjdquick-api-vr4w` | **Virginia** | Tokyo Supabase | **OMS Backend** |
| `cjdquick-b2c-api` | **Singapore** | Singapore Supabase | **B2C Backend** |
| `cjdquick-oms` | Virginia | - | OMS Frontend (Node - backup) |

### How to Identify Projects on Vercel

| Project Name | URL | Backend API | Purpose |
|--------------|-----|-------------|---------|
| `oms-sable` | oms-sable.vercel.app | cjdquick-api-vr4w.onrender.com | **OMS Frontend** |
| `b2c-frontend` | b2c-frontend-gamma.vercel.app | cjdquick-b2c-api.onrender.com | **B2C Frontend** |

---

## B2C CLIENT DEPLOYMENT (Multi-Tenant)

### B2C Architecture

Each B2C client gets their own isolated deployment:
- **Separate Supabase project** (isolated database)
- **Separate Render backend** (same codebase)
- **Separate Vercel frontend** (same codebase)

### B2C Live URLs

| Service | URL | Platform |
|---------|-----|----------|
| Frontend | https://b2c-frontend-gamma.vercel.app | Vercel |
| Backend API | https://cjdquick-b2c-api.onrender.com | Render |
| API Docs | https://cjdquick-b2c-api.onrender.com/docs | Render |
| Database Dashboard | https://supabase.com/dashboard/project/qfqztrmnvbdmejyclvvc | Supabase |

### B2C Supabase Project

| Setting | Value |
|---------|-------|
| Project Name | CJD QUICK B2C |
| Project Ref | `qfqztrmnvbdmejyclvvc` |
| Region | ap-southeast-1 (Singapore) |
| Dashboard | https://supabase.com/dashboard/project/qfqztrmnvbdmejyclvvc |

**Database Connection:**
```
postgresql://postgres:Aquapurite2026@db.qfqztrmnvbdmejyclvvc.supabase.co:5432/postgres
```

**Pooler Connection (for production - MUST use pgbouncer=true):**
```
postgresql://postgres.qfqztrmnvbdmejyclvvc:Aquapurite2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### B2C Login Credentials

| Panel | Email | Password |
|-------|-------|----------|
| B2C Admin | admin@b2c-client.com | admin123 |

### B2C Vercel Environment Variables

```bash
# Required for B2C Vercel deployment
AUTH_SECRET=<generate-new-secret>
NEXTAUTH_SECRET=<same-as-AUTH_SECRET>
NEXTAUTH_URL=https://b2c-frontend-gamma.vercel.app
NEXT_PUBLIC_API_URL=https://cjdquick-b2c-api.onrender.com
AUTH_TRUST_HOST=true
```

### B2C Render Environment Variables

```bash
# Required for cjdquick-b2c-api on Render (MUST include ?pgbouncer=true)
DATABASE_URL=postgresql://postgres.qfqztrmnvbdmejyclvvc:Aquapurite2026@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=8db7afe5735a174049765cf845075ff3321577b916712017af72fc97bb579995
PYTHON_VERSION=3.11.0
FRONTEND_URL=https://b2c-frontend-gamma.vercel.app
```

**CRITICAL:** The `?pgbouncer=true` parameter is REQUIRED for Supabase pooler connections to work with SQLAlchemy.

### B2C Deployment Files

| File | Purpose |
|------|---------|
| `backend/render-b2c.yaml` | Render deployment config |
| `backend/.env.b2c.example` | Backend environment template |
| `backend/migrations/b2c_schema.sql` | Database schema |
| `apps/web/.env.b2c.example` | Frontend environment template |
| `scripts/deploy-b2c.sh` | Deployment helper script |

### B2C Default Credentials

| Panel | Email | Password |
|-------|-------|----------|
| B2C Admin | admin@b2c-client.com | admin123 |

### Deploy New B2C Client

```bash
# Run deployment helper
./scripts/deploy-b2c.sh [client-name]

# Steps:
# 1. Create Supabase project
# 2. Run backend/migrations/b2c_schema.sql in SQL Editor
# 3. Create Render service with render-b2c.yaml
# 4. Create Vercel deployment
# 5. Set environment variables
```

---

## LOGISTICS & DELIVERY MODULE - IMPLEMENTATION PLAN (2026-01-21)

### Overview

This section documents the comprehensive plan to build a production-grade Logistics & Delivery module comparable to Vinculum and UniCommerce, with three distinct shipping allocation engines for FTL, B2B/PTL, and B2C shipments.

### Gap Analysis Summary

#### Current State vs Industry Standard

| Component | Current State | Industry Standard | Gap Level |
|-----------|---------------|-------------------|-----------|
| **FTL Module** | ❌ Not Exists | Lane-wise rates, vehicle types, indent management | Critical |
| **B2B/PTL N×N Matrix** | ❌ Not Exists | Origin-Destination-Weight rate matrix | Critical |
| **Cost/Speed/Reliability Scoring** | ❌ Not Exists | Weighted algorithm for carrier selection | Critical |
| **Auto-allocation Engine** | ❌ Not Exists | Smart carrier selection based on CSR | Critical |
| **Carrier Performance Metrics** | ⚠️ Basic | TAT, Success%, RTO%, Reliability scoring | High |
| **Rate Cards** | ⚠️ Basic (40%) | Weight + Zone + Lane based pricing | Medium |
| **Shipping Rules** | ⚠️ Basic (35%) | Advanced rule engine with CSR | Medium |

### Target Architecture

```
Logistics & Delivery (Restructured)
├── 📊 Logistics Dashboard
│   ├── Overview Metrics
│   ├── Carrier Performance Scorecards
│   └── Cost Analysis
│
├── 🚚 FTL Management (NEW)
│   ├── FTL Vendors
│   ├── Vehicle Types
│   ├── Lane Rates (O-D Matrix)
│   ├── Indent/Trip Management
│   └── FTL Rate Comparison
│
├── 📦 B2B/PTL Management (ENHANCED)
│   ├── PTL Vendors
│   ├── N×N Rate Matrix
│   ├── TAT Matrix
│   ├── LR Management (existing)
│   ├── Bookings (existing)
│   └── B2B Rate Comparison
│
├── 📬 B2C/Courier Management (ENHANCED)
│   ├── Courier Partners
│   ├── Rate Cards (enhanced)
│   ├── Pincode Serviceability
│   ├── AWB Management (existing)
│   └── B2C Rate Comparison
│
├── ⚙️ Allocation Engine (NEW)
│   ├── Allocation Rules
│   ├── Scoring Configuration (CSR Weights)
│   ├── Auto-allocation Dashboard
│   ├── Manual/Forced Allocation
│   └── Allocation History/Audit
│
├── 📈 Performance & Analytics (ENHANCED)
│   ├── Carrier Scorecards
│   ├── Lane Performance (FTL/B2B)
│   ├── Pincode Performance (B2C)
│   ├── Cost Optimization Reports
│   └── TAT Analysis
│
└── ⚙️ Configuration
    ├── Transporters (enhanced)
    ├── Shipping Rules (enhanced)
    └── Service Pincodes (existing)
```

### Phase-wise Implementation Plan

#### PHASE 1: Foundation & Data Models (Week 1-2)

**New Database Tables:**
```sql
-- FTL Tables
1. VehicleType - FTL vehicle master (10T, 20T, 32T, Container)
2. FTLVendor - FTL transporter master
3. FTLLaneRate - Origin-Destination rate matrix for FTL
4. FTLIndent - Trip/booking management

-- B2B/PTL Tables
5. PTLVendor - B2B PTL vendor master
6. PTLRateMatrix - N×N O-D-Weight rate matrix
7. PTLTATMatrix - Transit time matrix per lane per vendor

-- Performance Tables
8. CarrierPerformance - Aggregated metrics per carrier
9. PincodePerformance - Pincode-level carrier performance (B2C)
10. LanePerformance - Lane-level performance (FTL/PTL)

-- Allocation Engine Tables
11. ShippingAllocationRule - Enhanced allocation rules
12. CSRScoreConfig - Cost/Speed/Reliability weight configuration
13. AllocationAudit - Full audit trail of allocation decisions
```

**Deliverables:**
- [ ] SQLModel models for all new tables
- [ ] Database migration scripts for Supabase
- [ ] Basic CRUD APIs for new entities
- [ ] Enum types (VehicleType, ShipmentType, AllocationMode)

#### PHASE 2: FTL Module (Week 3-4)

**Backend APIs:**
- `POST/GET/PATCH/DELETE /api/v1/ftl/vendors` - FTL vendor CRUD
- `POST/GET/PATCH/DELETE /api/v1/ftl/vehicle-types` - Vehicle type master
- `POST/GET/PATCH/DELETE /api/v1/ftl/lane-rates` - Lane rate matrix CRUD
- `POST/GET/PATCH /api/v1/ftl/indents` - Trip/indent management
- `GET /api/v1/ftl/rate-comparison` - Compare rates for a lane

**Frontend Pages:**
- `/logistics/ftl/vendors` - FTL Vendor management
- `/logistics/ftl/vehicle-types` - Vehicle type master
- `/logistics/ftl/lane-rates` - Lane rate matrix (spreadsheet UI)
- `/logistics/ftl/indents` - Indent/trip management
- `/logistics/ftl/rate-comparison` - Rate comparison tool

**Features:**
- Lane-wise rate entry (Origin City → Destination City)
- Vehicle type based pricing
- Multi-vendor rate comparison for same lane
- Indent creation, vehicle assignment, trip tracking
- FTL cost calculation

#### PHASE 3: Enhanced B2B/PTL Module (Week 5-6)

**Backend APIs:**
- `POST/GET/PATCH/DELETE /api/v1/b2b/ptl-vendors` - PTL vendor CRUD
- `POST/GET/PATCH /api/v1/b2b/rate-matrix` - N×N rate matrix
- `POST/GET/PATCH /api/v1/b2b/tat-matrix` - Transit time matrix
- `GET /api/v1/b2b/rate-comparison` - Multi-vendor comparison
- `POST /api/v1/b2b/calculate-rate` - Calculate rate for shipment

**Frontend Pages:**
- `/logistics/b2b/vendors` - PTL vendor management
- `/logistics/b2b/rate-matrix` - N×N rate matrix (spreadsheet UI)
- `/logistics/b2b/tat-matrix` - TAT matrix management
- `/logistics/b2b/rate-comparison` - Rate comparison tool

**Features:**
- N×N origin-destination matrix with weight slabs
- TAT (Transit Time) tracking per lane per vendor
- Multi-vendor rate comparison with TAT
- Integration with existing LR/Booking modules

#### PHASE 4: Enhanced B2C Module (Week 7-8)

**Backend APIs:**
- `GET /api/v1/b2c/rate-comparison` - Carrier rate comparison
- `GET /api/v1/b2c/carrier-performance` - Carrier performance metrics
- `GET /api/v1/b2c/pincode-performance` - Pincode-level metrics
- `POST /api/v1/b2c/calculate-rate` - Calculate shipping rate

**Frontend Pages:**
- `/logistics/b2c/rate-comparison` - Carrier rate shopping
- `/logistics/b2c/performance` - Carrier performance dashboard
- `/logistics/b2c/pincode-analytics` - Pincode-level analytics

**Features:**
- Carrier rate shopping for pincode
- Performance scoring (TAT, Success%, RTO%)
- Pincode-level carrier ranking
- Historical performance trends

#### PHASE 5: Unified Allocation Engine (Week 9-10)

**Core Allocation Service:**
```python
class ShippingAllocationService:
    """
    Unified allocation engine for FTL, B2B, and B2C shipments.
    Uses Cost/Speed/Reliability (CSR) weighted scoring.
    """

    def allocate(
        self,
        shipment: Shipment,
        mode: AllocationMode,  # AUTO, MANUAL, HYBRID
        weights: CSRWeights = None  # Cost, Speed, Reliability weights
    ) -> AllocationResult:
        # 1. Detect shipment type (FTL, B2B, B2C)
        shipment_type = self.detect_type(shipment)

        # 2. Get eligible carriers based on serviceability
        carriers = self.get_eligible_carriers(shipment, shipment_type)

        # 3. Calculate CSR scores for each carrier
        scored_carriers = self.calculate_csr_scores(carriers, weights)

        # 4. Apply business rules and filters
        filtered = self.apply_rules(scored_carriers, shipment)

        # 5. Select best carrier (or return options for manual)
        selected = self.select_carrier(filtered, mode)

        # 6. Log allocation decision with full audit trail
        self.log_allocation(shipment, selected, reason)

        return AllocationResult(carrier=selected, alternatives=filtered[:3])
```

**Backend APIs:**
- `POST /api/v1/allocation/shipping/allocate` - Smart allocation
- `POST /api/v1/allocation/shipping/allocate-bulk` - Bulk allocation
- `GET /api/v1/allocation/shipping/suggest` - Get carrier suggestions
- `POST /api/v1/allocation/shipping/force` - Force manual allocation
- `GET /api/v1/allocation/shipping/audit` - Allocation audit trail
- `POST/GET/PATCH /api/v1/allocation/csr-config` - CSR weight config

**Frontend Pages:**
- `/logistics/allocation/rules` - Allocation rules configuration
- `/logistics/allocation/csr-config` - CSR weights configuration
- `/logistics/allocation/dashboard` - Auto-allocation dashboard
- `/logistics/allocation/manual` - Manual/forced allocation
- `/logistics/allocation/audit` - Allocation history/audit

**Features:**
- CSR (Cost/Speed/Reliability) weighted scoring
- Configurable weights per company (e.g., 70% cost, 20% speed, 10% reliability)
- Auto-allocation with full explanation
- Manual override with reason tracking
- Fallback logic (if primary fails, try secondary)
- Complete audit trail

#### PHASE 6: Performance Analytics (Week 11-12)

**Backend APIs:**
- `GET /api/v1/analytics/carrier-scorecard` - Carrier scorecards
- `GET /api/v1/analytics/lane-performance` - Lane performance (FTL/B2B)
- `GET /api/v1/analytics/pincode-performance` - Pincode performance (B2C)
- `GET /api/v1/analytics/cost-savings` - Cost optimization reports
- `GET /api/v1/analytics/allocation-insights` - Allocation insights

**Frontend Pages:**
- `/logistics/analytics/scorecards` - Carrier scorecards dashboard
- `/logistics/analytics/lane-performance` - Lane performance (FTL/B2B)
- `/logistics/analytics/pincode-performance` - Pincode performance (B2C)
- `/logistics/analytics/cost-optimization` - Cost savings reports
- `/logistics/analytics/insights` - Allocation insights

**Features:**
- Automated performance calculation from delivery data
- Historical trend analysis
- Cost savings reports
- Carrier ranking by performance
- Actionable recommendations

### Timeline Summary

| Phase | Focus | Duration | Status |
|-------|-------|----------|--------|
| Phase 1 | Foundation & Data Models | Week 1-2 | 🔄 In Progress |
| Phase 2 | FTL Module | Week 3-4 | ⏳ Pending |
| Phase 3 | B2B/PTL Module | Week 5-6 | ⏳ Pending |
| Phase 4 | B2C Module | Week 7-8 | ⏳ Pending |
| Phase 5 | Allocation Engine | Week 9-10 | ⏳ Pending |
| Phase 6 | Analytics | Week 11-12 | ⏳ Pending |

**Total Duration: 12 weeks (3 months)**

### Key Design Decisions

1. **Shipment Type Auto-Detection:**
   - Weight > 500kg or Full vehicle → FTL
   - B2B customer + LTL weight → B2B/PTL
   - B2C order → B2C Courier

2. **CSR Scoring Formula:**
   ```
   Score = (W_cost × Cost_Score) + (W_speed × Speed_Score) + (W_reliability × Reliability_Score)
   Where: W_cost + W_speed + W_reliability = 1.0
   Default: 0.5, 0.3, 0.2
   ```

3. **Performance Metrics Sources:**
   - Calculate from actual Delivery table data
   - TAT = Actual delivery date - Ship date
   - Success% = Delivered / (Delivered + RTO)
   - Reliability = On-time deliveries / Total deliveries

4. **Multi-tenancy:**
   - All new tables include `companyId`
   - CSR weights configurable per company
   - Lane rates can be company-specific or global

---

## DEVELOPMENT STRUCTURAL RULES (MANDATORY)

### Rule 1: Schema-First Development

**ALWAYS follow this order when adding new features:**

```
1. Database Schema → 2. Backend Model → 3. Backend API → 4. Regenerate Types → 5. Frontend UI
```

#### Step-by-Step Process:

```bash
# Step 1: Define Database Schema (if new table)
# Create migration SQL in: backend/migrations/

# Step 2: Create Backend Model
# Location: backend/app/models/
# Always include:
class NewEntity(SQLModel, table=True):
    __tablename__ = "new_entity"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # ... fields ...
    companyId: UUID = Field(foreign_key="Company.id", index=True)  # REQUIRED
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

# Step 3: Create Backend API
# Location: backend/app/api/v1/new_entity/__init__.py
# Register in: backend/app/api/v1/__init__.py

# Step 4: Regenerate Frontend Types
cd apps/web && npm run generate-api:prod

# Step 5: Create Frontend UI
# Location: apps/web/src/app/(dashboard)/new-feature/page.tsx
```

### Rule 2: Type Consistency (CRITICAL)

**Backend-Frontend Type Mapping:**

| Backend (Python) | Frontend (TypeScript) | Serialization |
|------------------|----------------------|---------------|
| `UUID` | `string` | Automatic |
| `datetime` | `string` (ISO 8601) | Automatic |
| `Decimal` | `string` | ⚠️ Parse to number in frontend |
| `int` | `number` | Automatic |
| `bool` | `boolean` | Automatic |
| `List[str]` | `Array<string>` | Automatic |
| `Enum` | `string` (enum value) | Automatic |

**Decimal Handling Rule:**
```typescript
// ALWAYS parse Decimal strings before calculations
const parseDecimal = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value;
};

// Usage in frontend
const total = parseDecimal(order.subtotal) + parseDecimal(order.taxAmount);
```

### Rule 3: API Endpoint Naming Convention

```
# Pattern: /api/v1/{resource}/{action?}/{id?}

# CRUD Operations:
GET    /api/v1/orders           # List all
POST   /api/v1/orders           # Create
GET    /api/v1/orders/{id}      # Get one
PATCH  /api/v1/orders/{id}      # Update
DELETE /api/v1/orders/{id}      # Delete

# Actions:
POST   /api/v1/orders/{id}/items        # Add item to order
POST   /api/v1/waves/{id}/start         # Start wave
POST   /api/v1/waves/{id}/complete      # Complete wave

# Nested Resources:
GET    /api/v1/orders/{id}/deliveries   # Get order's deliveries
POST   /api/v1/orders/{id}/deliveries   # Create delivery for order

# Summary/Stats:
GET    /api/v1/orders/stats             # Order statistics
GET    /api/v1/dashboard/summary        # Dashboard summary
```

### Rule 4: Response Format Standard

**All API responses must follow:**

```python
# Success Response (Single Item)
{
    "id": "uuid",
    "field1": "value",
    "createdAt": "2026-01-21T10:00:00Z",
    "updatedAt": "2026-01-21T10:00:00Z"
}

# Success Response (List)
[
    {"id": "uuid1", ...},
    {"id": "uuid2", ...}
]

# Error Response
{
    "detail": "Error message describing what went wrong"
}

# Validation Error
{
    "detail": [
        {"loc": ["body", "field"], "msg": "Field required", "type": "value_error"}
    ]
}
```

### Rule 5: Frontend Component Structure

```
apps/web/src/app/(dashboard)/feature-name/
├── page.tsx          # Main page (list view)
├── [id]/
│   └── page.tsx      # Detail view
├── new/
│   └── page.tsx      # Create form
└── components/       # Feature-specific components (optional)
    ├── FeatureTable.tsx
    └── FeatureForm.tsx
```

**Page Template:**
```typescript
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FeatureService } from "@/lib/api/generated";

export default function FeaturePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["feature"],
    queryFn: () => FeatureService.listFeatures(),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      {/* UI Components */}
    </div>
  );
}
```

### Rule 6: Error Handling Standard

**Backend:**
```python
from fastapi import HTTPException

# Use appropriate status codes
raise HTTPException(status_code=404, detail="Order not found")
raise HTTPException(status_code=400, detail="Invalid order status transition")
raise HTTPException(status_code=403, detail="Not authorized to access this resource")
```

**Frontend:**
```typescript
try {
  const result = await FeatureService.createFeature(data);
  toast.success("Feature created successfully");
} catch (error: any) {
  const message = error?.body?.detail || "An error occurred";
  toast.error(message);
}
```

---

## TESTING PROTOCOLS (MANDATORY)

### Protocol 1: Pre-Commit Validation

**ALWAYS run before committing:**

```bash
# 1. Backend Type Check
cd backend && python -c "from app.main import app; print('Backend OK')"

# 2. Frontend Build Test
npm run vercel-build

# 3. If both pass, proceed with commit
```

### Protocol 2: API Endpoint Testing

**For every new API endpoint, test with curl:**

```bash
# Template
curl -X METHOD https://cjdquick-api-vr4w.onrender.com/api/v1/endpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"field": "value"}'

# Example: Test order creation
curl -X POST https://cjdquick-api-vr4w.onrender.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderNo": "TEST-001",
    "channel": "MANUAL",
    "paymentMode": "PREPAID",
    "locationId": "uuid",
    "companyId": "uuid",
    "items": [{"skuId": "uuid", "quantity": 1, "unitPrice": "100.00"}]
  }'
```

### Protocol 3: E2E Flow Testing

**Test complete flows, not just individual endpoints:**

```bash
# Order Flow Test
1. POST /orders                    → Create order (status: CREATED)
2. POST /waves                     → Create wave (status: DRAFT)
3. POST /waves/{id}/orders         → Add order to wave
4. POST /waves/{id}/generate-picklists → Generate picklist
5. POST /waves/{id}/start          → Start picking (status: PICKING)
6. POST /waves/{id}/complete       → Complete picking (status: PICKED)
7. POST /orders/{id}/pack          → Pack order (status: PACKED)
8. POST /orders/{id}/ship          → Ship order (status: SHIPPED)
9. Verify: Order status transitions correctly at each step
```

### Protocol 4: Schema Mismatch Detection

**Run this audit weekly or after major changes:**

```bash
# 1. Compare backend models with frontend types
# Check: backend/app/models/*.py vs apps/web/src/lib/api/generated/types.gen.ts

# 2. Verify all required fields exist in both
# Check: companyId, createdAt, updatedAt present in all Response types

# 3. Verify Decimal fields are handled correctly
# Check: Frontend code parses Decimal strings before calculations

# 4. Regenerate types if mismatches found
cd apps/web && npm run generate-api:prod
```

### Protocol 5: Multi-Tenancy Validation

**Every new feature must:**

1. ✅ Include `companyId` field in model
2. ✅ Filter by `companyId` in all queries
3. ✅ Validate `companyId` matches user's company
4. ✅ Test with multiple companies

```python
# Backend query pattern
def get_orders(company_id: UUID, db: Session):
    return db.query(Order).filter(Order.companyId == company_id).all()
```

---

## KNOWN SCHEMA MISMATCHES (Updated: 2026-01-22)

### Critical Issues to Fix:

| Issue | Entities Affected | Priority |
|-------|------------------|----------|
| Decimal → string conversion | Order, OrderItem, SKU, Inventory, Delivery | HIGH |
| Missing `locationAccess` in UserResponse | User | HIGH |
| Missing `companyId` in WaveResponse | Wave | HIGH |
| `availableQty` marked optional | Inventory | MEDIUM |
| Role enum lost in UserResponse | User | MEDIUM |

### Decimal Fields Requiring Frontend Parsing:

```typescript
// These fields are returned as strings and need parseDecimal():
Order: subtotal, taxAmount, shippingCharges, discount, codCharges, totalAmount
OrderItem: unitPrice, taxAmount, discount, totalPrice
SKU: mrp, costPrice, sellingPrice, taxRate, weight, length, width, height
Inventory: mrp, costPrice
Delivery: weight, length, width, height, volumetricWeight
```

---

## AUDIT CHECKLIST (Run Monthly)

### Backend Audit:

- [ ] All models have `companyId` field
- [ ] All models have `createdAt` and `updatedAt` fields
- [ ] All Response schemas include all model fields
- [ ] All enums are properly exported
- [ ] All API endpoints have proper error handling
- [ ] All endpoints check authentication
- [ ] All endpoints filter by company

### Frontend Audit:

- [ ] Generated types match backend models
- [ ] Decimal strings are parsed before calculations
- [ ] API calls handle errors gracefully
- [ ] Loading states exist for all async operations
- [ ] Error boundaries exist for all route groups
- [ ] All forms validate required fields

### Integration Audit:

- [ ] Frontend API calls match backend endpoints
- [ ] Request/Response types match
- [ ] Status transitions work correctly
- [ ] Multi-tenancy isolation works
- [ ] Authentication flow works

---

## DEPLOYMENT CHECKLIST

### Before Deploying:

```bash
# 1. Run local build test
npm run vercel-build

# 2. Check for TypeScript errors
cd apps/web && npx tsc --noEmit

# 3. Test backend locally
cd backend && python -c "from app.main import app"

# 4. Run E2E flow test on staging
# (Use curl commands from Protocol 3)

# 5. Commit and push
./scripts/deploy-all.sh
```

### After Deploying:

```bash
# 1. Verify backend health
curl https://cjdquick-api-vr4w.onrender.com/health

# 2. Verify frontend loads
curl -s https://oms-sable.vercel.app | head -50

# 3. Test login flow
# Login via UI and verify dashboard loads

# 4. Run quick E2E test
# Create test order and verify it appears in UI
```

---

## TROUBLESHOOTING COMMON ISSUES

### Issue: Frontend shows "undefined" for fields

**Cause:** Field missing in Response type or not returned by API

**Fix:**
1. Check backend model has the field
2. Check backend schema includes the field
3. Regenerate frontend types: `npm run generate-api:prod`

### Issue: Calculations show wrong results (e.g., "10.505.25")

**Cause:** Decimal strings being concatenated instead of added

**Fix:**
```typescript
// Wrong
const total = order.subtotal + order.taxAmount;

// Correct
const total = parseDecimal(order.subtotal) + parseDecimal(order.taxAmount);
```

### Issue: API returns 500 Internal Server Error

**Cause:** Usually database or enum conversion issue

**Fix:**
1. Check Render logs for actual error
2. Common: Enum value not matching database value
3. Use `safe_enum_value()` helper for enum serialization

### Issue: Multi-tenancy leak (seeing other company's data)

**Cause:** Missing or incorrect `companyId` filter

**Fix:**
1. Verify all queries filter by `companyId`
2. Verify `companyId` is extracted from authenticated user
3. Add test for cross-company access attempt
