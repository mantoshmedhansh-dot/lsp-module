# CJDQuick OMS - Project Context

## CRITICAL: Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │
│   │  FRONTEND   │      │  BACKEND    │      │  DATABASE   │            │
│   │  Next.js 16 │ ───▶ │  FastAPI    │ ───▶ │ PostgreSQL  │            │
│   │  VERCEL     │      │  RENDER     │      │  SUPABASE   │            │
│   └─────────────┘      └─────────────┘      └─────────────┘            │
│                                                                         │
│   Remote: origin        Remote: singh        Supabase Cloud            │
│   Branch: master        Branch: main                                    │
│                                                                         │
│   Thin proxy layer      All business logic   SQLModel ORM              │
│   (catch-all route)     SQLAlchemy/SQLModel  Native PostgreSQL         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

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

**Setup Deploy Hook (one-time):**
```bash
# Add to oms/.env.local:
RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxxx?key=xxxxx

# Get URL from: Render Dashboard → cjdquick-api → Settings → Deploy Hook
```

## Live URLs

| Service | URL | Platform |
|---------|-----|----------|
| Frontend | https://oms-sable.vercel.app | Vercel |
| Backend API | https://cjdquick-api-vr4w.onrender.com | Render |
| API Docs | https://cjdquick-api-vr4w.onrender.com/docs | Render |
| Database | aws-1-ap-northeast-1.pooler.supabase.com | Supabase |

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

### Render (Backend) - Set in Render Dashboard
```
DATABASE_URL=postgresql://...@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=<secret>
FRONTEND_URL=https://oms-sable.vercel.app
INTERNAL_API_KEY=<service-key>
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
**Status: PENDING**

Configure channel/transporter credentials:
- `apps/web/src/app/(dashboard)/settings/integrations/page.tsx`
- `apps/web/src/app/(dashboard)/logistics/transporters/page.tsx`
- Connect to 9 channel integrations (Shopify, Amazon, Flipkart, etc.)
- Connect to 8 transporter integrations (Shiprocket, Delhivery, etc.)

### Priority 5: Production Hardening
**Status: PENDING**

- Add error boundaries (`error.tsx`) to route groups
- Configure error logging/monitoring
- Security audit (auth on all endpoints, input validation, data isolation)
- Performance optimization (caching, query indexes)
