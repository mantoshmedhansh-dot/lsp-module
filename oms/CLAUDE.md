# CJDQuick OMS - Project Context

## Quick Commands
```bash
# Deploy everything
./scripts/deploy-all.sh

# Audit configuration
./scripts/audit-config.sh

# Seed database
cd packages/database && npm run db:seed

# Deploy Vercel only
npx vercel --prod

# Push to Render (auto-deploys)
git push singh master:main
```

## Architecture (3-Tier)
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ FRONTEND        │    │ BACKEND         │    │ DATABASE        │
│ Next.js 16      │───▶│ FastAPI         │───▶│ PostgreSQL      │
│ Vercel          │    │ Render          │    │ Supabase        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## URLs
| Service | URL |
|---------|-----|
| Frontend | https://oms-sable.vercel.app |
| Backend API | https://cjdquick-api-vr4w.onrender.com |
| API Docs | https://cjdquick-api-vr4w.onrender.com/docs |
| Supabase | aws-1-ap-northeast-1.pooler.supabase.com |

## Git Remotes
| Remote | Repository | Branch | Purpose |
|--------|------------|--------|---------|
| origin | puneet1409/CJDQuickApp | master | Primary |
| singh | singhmantoshkumar22/cjdquick-app | main | Render auto-deploy |

## Login Credentials (Development)
| Panel | Email | Password |
|-------|-------|----------|
| Master Panel (SUPER_ADMIN) | admin@demo.com | admin123 |
| Client Portal (CLIENT) | client@fashionforward.com | brand123 |

## Environment Variables

### Vercel (Frontend)
```
DATABASE_URL=postgresql://postgres.rilakxywitslblkgikzf:***@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.rilakxywitslblkgikzf:***@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
AUTH_SECRET=***
NEXTAUTH_SECRET=***
NEXTAUTH_URL=https://oms-sable.vercel.app
NEXT_PUBLIC_API_URL=https://cjdquick-api-vr4w.onrender.com
AUTH_TRUST_HOST=true
```

### Render (Backend)
```
DATABASE_URL=postgresql://postgres.rilakxywitslblkgikzf:***@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
SECRET_KEY=***
FRONTEND_URL=https://oms-sable.vercel.app
```

## Key Files
| File | Purpose |
|------|---------|
| apps/web/src/lib/auth.ts | NextAuth configuration |
| apps/web/src/lib/api-client.ts | FastAPI client (check API_BASE_URL) |
| backend/app/main.py | FastAPI app + CORS |
| backend/app/core/config.py | Backend settings |
| packages/database/prisma/seed.ts | Database seed data |

## Common Issues

### Login not working
1. Check database is seeded: `cd packages/database && npm run db:seed`
2. Verify Vercel has DATABASE_URL: `npx vercel env ls`
3. Redeploy: `npx vercel --prod`

### API returning 500
1. Check Render has DATABASE_URL set
2. Wake up free tier: `curl https://cjdquick-api-vr4w.onrender.com/health`
3. Check logs in Render dashboard

### CORS errors
1. Update backend/app/main.py allow_origins
2. Push to singh remote: `git push singh master:main`
3. Wait for Render auto-deploy

## Deployment Checklist
- [ ] Code changes committed
- [ ] Pushed to origin/master
- [ ] Pushed to singh/main (for Render)
- [ ] Vercel deployed (`npx vercel --prod`)
- [ ] Database seeded if schema changed
- [ ] Test login works
