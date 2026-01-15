# CJDQuick OMS - Project Context

## CRITICAL: Deployment Architecture (DO NOT CHANGE)

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
└─────────────────────────────────────────────────────────────────────────┘
```

## ONE COMMAND TO DEPLOY EVERYTHING

```bash
cd oms && ./scripts/deploy-all.sh
```

This single command:
1. ✅ Runs build test (catches errors BEFORE deploying)
2. ✅ Pushes to origin (GitHub → Vercel auto-deploy)
3. ✅ Pushes to singh (GitHub → Render)
4. ✅ Triggers Render deploy via Deploy Hook (ensures deploy)
5. ✅ Deploys to Vercel production
6. ✅ Verifies both deployments

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
│       │   ├── app/            # App router pages & API routes
│       │   ├── components/     # React components
│       │   └── lib/            # Utilities, auth, services
│       ├── next.config.js      # Next.js config (DON'T MODIFY transpilePackages)
│       └── package.json
│
├── backend/                    # FastAPI backend (RENDER)
│   ├── app/
│   │   ├── api/               # API endpoints
│   │   ├── core/              # Config, security, database
│   │   └── models/            # SQLAlchemy models
│   ├── requirements.txt
│   └── render.yaml            # Render deployment config
│
├── packages/
│   └── database/              # Prisma ORM (SUPABASE)
│       ├── prisma/
│       │   ├── schema.prisma  # Database schema
│       │   └── seed.ts        # Seed data
│       └── src/index.ts       # Prisma client export
│
├── scripts/
│   └── deploy-all.sh          # ONE-COMMAND DEPLOYMENT
│
├── vercel.json                # Vercel deployment config
├── package.json               # Root package.json (workspaces)
└── CLAUDE.md                  # THIS FILE
```

## Configuration Files (DO NOT MODIFY WITHOUT UNDERSTANDING)

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
// CRITICAL: transpilePackages must include @oms/database
transpilePackages: ["@oms/database"]
```

### packages/database/package.json
```json
// CRITICAL: Export from source, NOT dist
"main": "./src/index.ts"
```

### backend/render.yaml
```yaml
# CRITICAL: rootDir must be "backend"
rootDir: backend
branch: main
```

## Local Development (Docker PostgreSQL)

For local development, use Docker PostgreSQL (same as Supabase production):

```bash
# First-time setup (starts PostgreSQL + creates tables)
npm run local:setup

# Or manually:
npm run docker:up              # Start PostgreSQL container
npm run db:push:local          # Push schema to local DB
npm run db:seed                # Seed sample data
npm run dev                    # Start development servers
```

### Docker Commands
```bash
npm run docker:up              # Start PostgreSQL
npm run docker:down            # Stop PostgreSQL
npm run docker:logs            # View PostgreSQL logs
npm run docker:pgadmin         # Start pgAdmin UI (localhost:5050)
```

### Local Database
- **URL**: `postgresql://postgres:postgres@localhost:5432/oms`
- **pgAdmin**: http://localhost:5050 (admin@cjdquick.com / admin)
- **Prisma Studio**: `npm run db:studio`

## Quick Commands

```bash
# Deploy everything (RECOMMENDED)
./scripts/deploy-all.sh

# Manual deployment
npm run vercel-build           # Test build locally
git push origin master         # Push to GitHub
git push singh master:main     # Push to Render
npx vercel --prod              # Deploy to Vercel

# Database (Production - Supabase)
npm run prisma:generate        # Generate Prisma client
npm run db:seed                # Seed database
npm run db:studio              # Open Prisma Studio

# Database (Local - Docker)
npm run docker:up              # Start local PostgreSQL
npm run db:push:local          # Push schema to local DB
npm run db:migrate             # Run migrations
npm run db:reset               # Reset database (DESTRUCTIVE)

# Development
npm run dev                    # Start dev server
npm run local:setup            # Full local setup
```

## Environment Variables

### Vercel (Frontend) - Set via `npx vercel env`
```
DATABASE_URL=postgresql://...@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
AUTH_SECRET=<secret>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://oms-sable.vercel.app
NEXT_PUBLIC_API_URL=https://cjdquick-api-vr4w.onrender.com
AUTH_TRUST_HOST=true
```

### Render (Backend) - Set in Render Dashboard
```
DATABASE_URL=postgresql://...@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=<secret>
FRONTEND_URL=https://oms-sable.vercel.app
```

## Login Credentials (Development)

| Panel | Email | Password |
|-------|-------|----------|
| Master Panel (SUPER_ADMIN) | admin@demo.com | admin123 |
| Client Portal (CLIENT) | client@fashionforward.com | brand123 |

## Troubleshooting

### Build Fails on Vercel
1. Run `npm run vercel-build` locally first
2. Check `transpilePackages` includes `@oms/database`
3. Check `packages/database/package.json` has `"main": "./src/index.ts"`

### Render Not Updating / Auto-Deploy Not Working

**CRITICAL: Render Auto-Deploy Configuration**

The repository structure has `oms/` as a subdirectory. For Render auto-deploy to work:

1. **Check Render Dashboard Settings** (https://dashboard.render.com):
   - Go to Service "cjdquick-api" → Settings → Build & Deploy
   - Ensure "Auto-Deploy" toggle is **ON**
   - Set "Root Directory" to: `oms/backend` (NOT just `backend`)
   - Verify "Branch" is `main`
   - Verify GitHub repo is connected to `singhmantoshkumar22/cjdquick-app`

2. **Verify GitHub Webhook**:
   - Go to GitHub repo → Settings → Webhooks
   - Ensure Render webhook exists and shows recent deliveries

3. **Manual deploy if needed**:
   - Push to singh remote: `git push singh master:main`
   - If auto-deploy fails, use Render Dashboard "Manual Deploy" button

4. **Free tier sleeps after 15 min** - wake with:
   ```bash
   curl https://cjdquick-api-vr4w.onrender.com/health
   ```

**Repository Structure Note:**
```
CJDQuickApp/ (git root)
├── oms/                    ← OMS project subdirectory
│   ├── backend/           ← Render rootDir should be "oms/backend"
│   ├── apps/web/          ← Next.js app
│   └── packages/
├── render.yaml            ← Blueprint at repo root (rootDir: oms/backend)
└── ...
```

### Database Connection Issues
1. Check DATABASE_URL is set in both Vercel and Render
2. Supabase pooler URL uses port 6543, direct uses 5432
3. Run `npm run prisma:generate` after schema changes

### Login Not Working
1. Seed database: `npm run db:seed`
2. Check Vercel env vars: `npx vercel env ls`
3. Redeploy: `npx vercel --prod`

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/web/src/lib/auth.ts` | NextAuth configuration |
| `apps/web/src/lib/api-client.ts` | FastAPI client |
| `backend/app/main.py` | FastAPI app + CORS |
| `backend/app/core/config.py` | Backend settings |
| `packages/database/prisma/schema.prisma` | Database schema |
| `packages/database/prisma/seed.ts` | Seed data |
| `vercel.json` | Vercel deployment config |
| `backend/render.yaml` | Render deployment config |

## Database Architecture

### ID Strategy: Native PostgreSQL UUID
All models use **native PostgreSQL UUID** for optimal performance:
```prisma
id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
```

**Why Native UUID?**
- 16-byte storage (vs ~25-byte CUID strings)
- Native B-tree indexing for faster queries
- Database-side generation (no round-trip)
- Same format as Supabase uses internally
- Better performance for high-traffic multi-client applications

**PostgreSQL Extensions Enabled:**
```prisma
extensions = [uuid_ossp(map: "uuid-ossp"), pgcrypto]
```

### PostgreSQL Version
- **Production (Supabase)**: PostgreSQL 15
- **Local (Docker)**: PostgreSQL 15-alpine

Both use identical configurations for consistency.

## RULES FOR CLAUDE CODE

1. **ALWAYS run `npm run vercel-build` before committing major changes**
2. **ALWAYS push to BOTH remotes after changes**
3. **NEVER modify `transpilePackages` in next.config.js**
4. **NEVER change `main` field in packages/database/package.json from `./src/index.ts`**
5. **NEVER remove `@oms/database` from workspace packages**
6. **Use `./scripts/deploy-all.sh` for deployments**
7. **Use `npm run local:setup` for local development with Docker PostgreSQL**
