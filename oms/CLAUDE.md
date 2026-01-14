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
./scripts/deploy-all.sh
```

This single command:
1. ✅ Runs build test (catches errors BEFORE deploying)
2. ✅ Pushes to origin (GitHub)
3. ✅ Pushes to singh (Render auto-deploy)
4. ✅ Deploys to Vercel production
5. ✅ Verifies both deployments

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

## Quick Commands

```bash
# Deploy everything (RECOMMENDED)
./scripts/deploy-all.sh

# Manual deployment
npm run vercel-build           # Test build locally
git push origin master         # Push to GitHub
git push singh master:main     # Push to Render
npx vercel --prod              # Deploy to Vercel

# Database
npm run prisma:generate        # Generate Prisma client
npm run db:seed                # Seed database
npm run db:studio              # Open Prisma Studio

# Development
npm run dev                    # Start dev server
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

### Render Not Updating
1. Push to singh remote: `git push singh master:main`
2. Check Render dashboard for deploy status
3. Free tier sleeps after 15 min - wake with: `curl https://cjdquick-api-vr4w.onrender.com/health`

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

## RULES FOR CLAUDE CODE

1. **ALWAYS run `npm run vercel-build` before committing major changes**
2. **ALWAYS push to BOTH remotes after changes**
3. **NEVER modify `transpilePackages` in next.config.js**
4. **NEVER change `main` field in packages/database/package.json from `./src/index.ts`**
5. **NEVER remove `@oms/database` from workspace packages**
6. **Use `./scripts/deploy-all.sh` for deployments**
