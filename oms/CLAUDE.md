# CJDQuick OMS - Project Context

**Last Updated:** 2026-02-12

---

## 1. PROJECT ARCHITECTURE

### 4-Module Structure

```
/Users/mantosh/CJDQuickApp/
├── oms/                    ← MODULE 1: OMS + WMS (THIS PROJECT)
│   ├── apps/web/           ← Frontend (Vercel)
│   ├── backend/            ← Backend (Render)
│   └── Database: Supabase Tokyo (rilakxywitslblkgikzf)
│
├── b2b/                    ← MODULE 2: B2B LOGISTICS (Separate)
├── b2c/                    ← MODULE 3: B2C COURIER (Separate)
└── client-portal/          ← MODULE 4: UNIFIED ENTRY POINT
```

### OMS Module Details

| Component | Technology | URL |
|-----------|------------|-----|
| Frontend | Next.js 16 | https://lsp-oms.vercel.app |
| Backend | FastAPI | https://lsp-oms-api.onrender.com |
| Database | Supabase | Tokyo (rilakxywitslblkgikzf) |

---

## 2. PROJECT STRUCTURE

```
oms/
├── apps/web/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── auth/[...nextauth]/  # NextAuth
│   │   │   │   └── v1/[...path]/        # API Proxy
│   │   │   └── (dashboard)/             # UI Pages
│   │   ├── components/
│   │   └── lib/
│   │       ├── auth.ts                  # Auth config
│   │       └── api/generated/           # OpenAPI types
│   └── package.json
│
├── backend/                     # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/              # API Endpoints
│   │   ├── core/                # Config, Security
│   │   ├── models/              # SQLModel Models
│   │   └── services/            # Business Logic
│   ├── migrations/              # SQL Migrations
│   └── requirements.txt
│
├── scripts/                     # Deployment Scripts
└── CLAUDE.md                    # This File
```

---

## 3. DEVELOPMENT RULES (MANDATORY)

### Rule 1: Schema-First Development

```
Order: Supabase Table → Backend Model → Backend API → Regenerate Types → Frontend UI
```

**Steps:**
1. Create table in Supabase SQL Editor
2. Create SQLModel in `backend/app/models/`
3. Create API in `backend/app/api/v1/`
4. Regenerate types: `cd apps/web && npm run generate-api:prod`
5. Create Frontend UI

### Rule 2: Naming Conventions

| Layer | Convention | Example |
|-------|------------|---------|
| Database (Supabase) | snake_case | `company_id`, `created_at` |
| Backend Model | snake_case (matches DB) | `company_id: UUID` |
| Backend API Response | camelCase (via alias) | `companyId` |
| Frontend | camelCase | `companyId: string` |

### Rule 3: Required Fields (All Tables)

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

### Rule 4: Type Mapping

| Supabase | Python | TypeScript |
|----------|--------|------------|
| UUID | UUID | string |
| TIMESTAMPTZ | datetime | string (ISO) |
| NUMERIC | Decimal | string (parse!) |
| INTEGER | int | number |
| BOOLEAN | bool | boolean |
| VARCHAR | str | string |
| JSONB | dict | object |

**Important:** Frontend must parse Decimal strings:
```typescript
const parseDecimal = (value: string | number | null): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return value;
};
```

### Rule 5: No Cross-Module Imports

- Each module (OMS, B2B, B2C) is 100% self-contained
- Communication between modules via HTTP API only

### Rule 6: Database Synchronization (CRITICAL)

**ALWAYS create database tables/structures in Supabase when making codebase changes.**

When adding new features, models, or modifying existing ones:

1. **Create Migration First**: Write SQL migration in `backend/migrations/`
2. **Run on Supabase**: Execute migration via Supabase SQL Editor
3. **Verify Tables Exist**: Confirm tables/columns exist before deploying code
4. **Document Changes**: Update migration file with comments

**Checklist for any model changes:**
```
[ ] SQL migration written in backend/migrations/
[ ] Migration executed on Supabase
[ ] Tables/columns verified to exist
[ ] Indexes created for foreign keys
[ ] Triggers added if needed (e.g., updated_at)
```

**Migration File Naming:**
```
backend/migrations/
├── wms_inbound_phase1_external_po.sql
├── wms_inbound_phase2_asn.sql
├── wms_inbound_phase3_sto.sql
└── feature_name_description.sql
```

**Example Migration Template:**
```sql
-- ============================================================================
-- Feature: [Feature Name]
-- Date: YYYY-MM-DD
-- Description: [What this migration does]
-- ============================================================================

-- Create table
CREATE TABLE IF NOT EXISTS table_name (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    -- ... fields ...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_table_company ON table_name(company_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_table_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_table_updated_at
    BEFORE UPDATE ON table_name
    FOR EACH ROW EXECUTE FUNCTION update_table_timestamp();
```

---

## 4. API PATTERNS

### Endpoint Naming

```
GET    /api/v1/orders           # List
POST   /api/v1/orders           # Create
GET    /api/v1/orders/{id}      # Get one
PATCH  /api/v1/orders/{id}      # Update
DELETE /api/v1/orders/{id}      # Delete

POST   /api/v1/orders/{id}/ship # Action
GET    /api/v1/orders/stats     # Summary
```

### Response Format

```python
# Single item
{"id": "uuid", "field": "value", "createdAt": "...", "updatedAt": "..."}

# List
[{"id": "uuid1", ...}, {"id": "uuid2", ...}]

# Error
{"detail": "Error message"}
```

---

## 5. FRONTEND PATTERNS

### Page Structure

```
apps/web/src/app/(dashboard)/feature/
├── page.tsx          # List view
├── [id]/page.tsx     # Detail view
├── new/page.tsx      # Create form
└── components/       # Feature components
```

### Component Template

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";

export default function FeaturePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["feature"],
    queryFn: () => FeatureService.list(),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error</div>;

  return <div>{/* UI */}</div>;
}
```

---

## 6. DEPLOYMENT

### Folder Structure for Deployment

```
/Users/mantosh/CJDQuickApp/oms/     ← REPO ROOT (deploy from here)
├── apps/web/                        ← Frontend source (Next.js)
├── backend/                         ← Backend source (FastAPI)
├── vercel.json                      ← Vercel config (at root)
└── .vercel/                         ← Vercel project link
```

### Platform Mapping (CRITICAL)

| Platform | What | Source Folder | Deploy Trigger | URL |
|----------|------|---------------|----------------|-----|
| **Vercel** | Frontend (Next.js) | `apps/web/` | **Auto on git push** | https://lsp-oms.vercel.app |
| **Render** | Backend (FastAPI) | `backend/` | Auto on git push | https://lsp-oms-api.onrender.com |

### Vercel Project Settings (vercel.com)

**CRITICAL:** These settings must be configured correctly on Vercel dashboard:

| Setting | Value | Notes |
|---------|-------|-------|
| **Root Directory** | `oms` | NOT empty, NOT `apps/web`, NOT `oms/apps/web` |
| **Build Command** | Uses vercel.json | `npm run vercel-build` → `cd apps/web && npm run build` |
| **Output Directory** | `apps/web/.next` | Relative to Root Directory |
| **Install Command** | `npm install` | Standard |

**Repository Structure:**
```
/Users/mantosh/CJDQuickApp/         ← GIT REPO ROOT
├── .vercel/                        ← Vercel project link (at repo root)
├── .vercelignore                   ← Ignore large files (node_modules, .next, etc.)
├── vercel.json                     ← Root config (not used, rootDirectory=oms)
├── oms/                            ← ROOT DIRECTORY FOR VERCEL
│   ├── .vercelignore               ← OMS-specific ignores
│   ├── vercel.json                 ← OMS Vercel config (used by Vercel)
│   ├── apps/web/                   ← Frontend source
│   └── backend/                    ← Backend source (ignored for Vercel)
├── b2b/                            ← Ignored
├── b2c/                            ← Ignored
└── client-portal/                  ← Ignored
```

**To verify/fix:** https://vercel.com/ilms/lsp-oms/settings

### Vercel Deployment Rules

**Vercel auto-deploys on git push to `main`** (GitHub integration enabled)

- Push to `main` branch triggers automatic Vercel deployment
- No CLI deploy needed - just `git push origin main`
- Vercel's `rootDirectory` is set to `oms` on their server
- The `oms/vercel.json` handles the build: `npm run vercel-build` → `cd apps/web && npm run build`

### Render Deployment Rules

**Render auto-deploys on git push to `main`**

- Backend changes in `backend/` trigger auto-deploy
- Frontend-only changes do NOT trigger Render deploy (correct behavior)
- No manual deployment needed for Render

### Deploy Commands

```bash
# 1. Test build locally before pushing
cd /Users/mantosh/CJDQuickApp/oms
npm run vercel-build

# 2. Commit and push (triggers BOTH Vercel and Render auto-deploy)
cd /Users/mantosh/CJDQuickApp
git add <files>
git commit -m "message"
git push origin main

# Vercel and Render will automatically deploy after push
```

**DO NOT use `npx vercel deploy`** - this causes duplicate deployments since GitHub auto-deploy is enabled.

### Git Repository

| Remote | Repository | Branch |
|--------|------------|--------|
| origin | mantoshmedhansh-dot/lsp-module | `main` |

### Platform Configuration

| Platform | Trigger | Branch | Project Name |
|----------|---------|--------|--------------|
| Vercel | Auto (git push) | `main` | `lsp-oms` |
| Render | Auto (git push) | `main` | `lsp-oms-api` |

### Vercel Project Verification

Before deploying, verify correct project link:
```bash
cat /Users/mantosh/CJDQuickApp/oms/.vercel/project.json
# Should show: "projectName": "lsp-oms"
```

If wrong project, re-link:
```bash
cd /Users/mantosh/CJDQuickApp/oms
rm -rf .vercel
npx vercel link --yes --project oms
```

---

## 7. ENVIRONMENT VARIABLES

### Vercel (Frontend)

```
NEXT_PUBLIC_API_URL=https://lsp-oms-api.onrender.com
AUTH_SECRET=<secret>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://lsp-oms.vercel.app
AUTH_TRUST_HOST=true
```

### Render (Backend)

```
DATABASE_URL=postgresql://postgres.rilakxywitslblkgikzf:<password>@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=<secret>
FRONTEND_URL=https://lsp-oms.vercel.app
```

**Important:** Always include `?pgbouncer=true` in DATABASE_URL

---

## 8. QUICK COMMANDS

### Development

```bash
# Frontend
cd apps/web && npm run dev

# Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Regenerate API types
cd apps/web && npm run generate-api:prod
```

### Testing

```bash
# Build test
npm run vercel-build

# Backend import test
cd backend && python -c "from app.main import app; print('OK')"

# Health check
curl https://lsp-oms-api.onrender.com/health
```

---

## 9. LOGIN CREDENTIALS

| Panel | Email | Password |
|-------|-------|----------|
| Master Panel (SUPER_ADMIN) | admin@demo.com | admin123 |
| Client Portal (CLIENT) | client@fashionforward.com | brand123 |

---

## 10. KEY FILES

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/v1/[...path]/route.ts` | API Proxy |
| `apps/web/src/lib/auth.ts` | NextAuth config |
| `apps/web/src/lib/api/generated/` | Generated types |
| `backend/app/main.py` | FastAPI entry |
| `backend/app/models/` | Database models |
| `backend/app/api/v1/` | API endpoints |
| `backend/migrations/` | SQL migrations |

---

## 11. TROUBLESHOOTING

### "undefined" in Frontend
1. Check backend model has the field
2. Check response schema includes field
3. Regenerate types: `npm run generate-api:prod`

### Decimal Calculation Wrong (e.g., "10.505.25")
```typescript
// Wrong: order.subtotal + order.taxAmount
// Correct: parseDecimal(order.subtotal) + parseDecimal(order.taxAmount)
```

### API 500 Error
1. Check Render logs
2. Common: Enum value mismatch with database
3. Use `safe_enum_value()` helper for enum serialization

### Multi-tenancy Leak
1. All queries must filter by `companyId`
2. Extract `companyId` from authenticated user

---

## 12. RELATED DOCUMENTS

| Document | Purpose |
|----------|---------|
| `report.claude.md` | Database audit report with 103 tables inventory |
| `SCHEMA-AUDIT.md` | Historical schema audit |
| `backend/migrations/*.sql` | Database migration scripts |

---

## 13. DEPLOYMENT PRE-FLIGHT CHECKLIST

```
[ ] npm run vercel-build passes locally
[ ] Backend health check passes
[ ] Run any required SQL migrations on Supabase
[ ] git push origin main (triggers auto-deploy to Vercel + Render)
[ ] Verify production after deploy: https://lsp-oms.vercel.app
```

---

**For detailed table inventory and database verification queries, see `report.claude.md`**

---

## 14. NAVIGATION ARCHITECTURE (Restructured 2026-02-09)

### Problems Solved
- **12 duplicate nav entries eliminated** (Transporters, Rate Cards, Shipping Rules, Pincodes, Detection Rules, Delivery Performance appeared in multiple places)
- **WMS functionality consolidated** from 5+ scattered sections into one unified WMS section
- **5 QC entry points unified** (Inbound QC, Outbound QC, Returns QC, QC Templates, QC Executions)
- **6 orphaned pages** now have navigation entries (channels/inventory-sync, order-sync, returns, settlements, sku-mapping, scheduled-jobs)
- **12 legacy /setup/* pages** cleaned up
- **7 new pages created** from WMS reference (SKU Label Print, Direct Inbound, BIN Audit, SKU Transaction History, Inventory Reservation, Delivery Split, Transhipment)

### Navigation Structure (10 Sections)

```
1. ADMIN (SUPER_ADMIN only) [Orange]
   └── Platform Admin → /master/companies, /master/brands, /master/health, /master/audit

2. COMMAND CENTER [Blue]
   ├── Dashboard → /dashboard, /dashboard/seller-panel
   ├── Control Tower → /control-tower, /control-tower/exceptions, /control-tower/sla, /control-tower/rules, /control-tower/ai-actions, /control-tower/proactive
   └── NDR Management → /control-tower/ndr, /ndr, /ndr/reattempts, /ndr/escalations

3. ORDER LIFECYCLE [Green]
   ├── Orders → /orders, /orders/new, /orders/import, /orders/bulk, /orders/preorders, /orders/subscriptions
   └── B2B Sales → /b2b/quotations, /b2b/orders, /b2b/price-lists, /b2b/credit, /b2b/customers

4. WMS (Warehouse Management) [Purple] ← RESTRUCTURED
   ├── Setup → /wms/zones, /wms/bins, /inbound/putaway, /wms/qc/templates, /inventory/cycle-counts, /wms/sku-label-print
   ├── Inbound → /inbound/goods-receipt, /inbound/asn, /inbound/receiving, /inbound/qc, /inbound/putaway, /inbound/direct, /inbound/return-inbound
   ├── Inventory → /inventory, /inventory/movements, /inventory/transfers, /inventory/adjustments, /inventory/cycle-counts, /inventory/bin-audit, /inventory/virtual, /inventory/sku-transactions, /inventory/reservations
   ├── Order Processing → /fulfillment/allocate, /fulfillment/waves, /fulfillment/picklist, /fulfillment/packing, /fulfillment/qc, /fulfillment/delivery-split, /fulfillment/manifest, /fulfillment/delivery-shipping, /fulfillment/gate-pass
   ├── Returns & RTO → /returns, /returns/rto, /returns/qc, /returns/refunds
   ├── Quality Control → /wms/qc/templates, /wms/qc/executions, /wms/qc/parameters
   └── Advanced WMS → /wms/labor, /wms/slotting, /wms/voice, /wms/mobile, /wms/cross-dock, /wms/transhipment

5. LOGISTICS [Amber] ← DEDUPLICATED
   ├── Shipment Tracking → /logistics/tracking, /logistics/awb, /logistics/performance
   ├── B2C / Courier → /logistics/transporters, /logistics/rate-cards, /logistics/shipping-rules, /logistics/pincodes
   ├── FTL Management → /logistics/ftl/vendors, /logistics/ftl/vehicle-types, /logistics/ftl/lane-rates, /logistics/ftl/indents, /logistics/ftl/rate-comparison
   ├── PTL / B2B → /logistics/ptl/rate-matrix, /logistics/ptl/tat-matrix, /logistics/ptl/rate-comparison
   ├── Allocation Engine → /logistics/allocation/rules, /logistics/allocation/csr-config, /logistics/allocation/audit
   └── Logistics Analytics → /logistics/dashboard, /logistics/analytics/carrier-scorecards, /logistics/analytics/lane-performance, /logistics/analytics/pincode-performance

6. PROCUREMENT [Teal]
   └── Procurement → /procurement/purchase-orders, /inbound/external-pos, /procurement/vendors, /procurement/performance

7. CHANNELS & MARKETPLACE [Indigo] ← PROMOTED FROM CONFIG
   └── Marketplace → /channels/marketplaces, /channels/sku-mapping, /channels/order-sync, /channels/inventory-sync, /channels/returns, /channels/settlements, /channels/scheduled-jobs, /channels/sync

8. FINANCE [Rose]
   └── Finance → /finance/dashboard, /finance/invoices, /finance/cod-reconciliation, /finance/reconciliation, /finance/freight-billing, /finance/weight-discrepancy, /finance/payment-ledger

9. REPORTS & ANALYTICS [Rose] ← MERGED
   ├── Reports → /reports, /reports/sales, /reports/inventory, /reports/logistics, /reports/finance, /reports/scheduled, /reports/custom
   └── Analytics → /analytics/sales, /analytics/operations, /analytics/carriers

10. CONFIGURATION [Slate] ← CLEANED (collapsed, 4 groups only)
    ├── Masters → /masters/skus, /masters/bundles, /masters/categories
    ├── Company & Users → /settings/company, /settings/users, /settings/locations
    ├── Integrations → /settings/integrations, /setup/templates
    └── Settings → /settings/inventory/valuation
```

### API Endpoint Mapping (Page → Backend API)

| Frontend Page | Backend API Endpoint |
|--------------|---------------------|
| /wms/zones | GET/POST /api/v1/zones |
| /wms/bins | GET/POST /api/v1/bins |
| /wms/sku-label-print | GET /api/v1/skus |
| /wms/qc/templates | GET/POST /api/v1/qc/templates |
| /wms/qc/executions | GET /api/v1/qc/executions |
| /wms/qc/parameters | GET/POST /api/v1/qc/parameters |
| /inbound/goods-receipt | GET/POST /api/v1/goods-receipt |
| /inbound/asn | GET/POST /api/v1/asn |
| /inbound/direct | POST /api/v1/inbound |
| /inbound/return-inbound | GET /api/v1/returns (inbound receiving) |
| /inventory | GET /api/v1/inventory |
| /inventory/movements | GET /api/v1/inventory (filter: movements) |
| /inventory/bin-audit | GET /api/v1/reconciliation |
| /inventory/sku-transactions | GET /api/v1/inventory (SKU history) |
| /inventory/reservations | GET /api/v1/allocation |
| /fulfillment/allocate | POST /api/v1/allocation/allocate |
| /fulfillment/waves | GET/POST /api/v1/waves |
| /fulfillment/picklist | POST /api/v1/picklists |
| /fulfillment/delivery-split | POST /api/v1/waves/{id}/split |
| /fulfillment/delivery-shipping | GET /api/v1/shipments |
| /wms/transhipment | GET/POST /api/v1/stock-transfer |
| /channels/marketplaces | GET /api/v1/marketplaces |
| /channels/sku-mapping | GET /api/v1/sku-mappings |
| /channels/order-sync | GET /api/v1/order-sync |
| /channels/inventory-sync | GET /api/v1/inventory-sync |
| /channels/settlements | GET /api/v1/settlements |

---
