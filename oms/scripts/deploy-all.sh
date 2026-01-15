#!/bin/bash
# CJDQuick OMS - Unified Deployment Script
# Deploys to both Vercel (frontend) and Render (backend)
#
# Architecture:
#   Frontend (Next.js) → Vercel  (auto-deploy from origin/master)
#   Backend (FastAPI)  → Render  (auto-deploy from singh/main when oms/backend changes)
#   Database           → Supabase (PostgreSQL)
#
# Usage: ./scripts/deploy-all.sh

set -e

cd "$(dirname "$0")/.."
OMS_DIR=$(pwd)

# Load environment variables for Render Deploy Hook
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs 2>/dev/null) || true
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CJDQuick OMS - Unified Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Architecture:"
echo "  • Frontend → Vercel  (origin/master)"
echo "  • Backend  → Render  (singh/main)"
echo "  • Database → Supabase"
echo ""

# Step 1: Build test (catch errors before deploying)
echo "[1/6] Running build test..."
npm run prisma:generate
cd apps/web && npm run build && cd ../..
echo "✓ Build test passed"

# Step 2: Commit any uncommitted changes
echo ""
echo "[2/6] Checking for uncommitted changes..."
cd ..
if [[ -n $(git status -s) ]]; then
    echo "Found uncommitted changes:"
    git status --short
    read -p "Commit message: " commit_msg
    git add -A
    git commit -m "$commit_msg

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
fi

# Step 3: Push to origin (GitHub → Vercel auto-deploy)
echo ""
echo "[3/6] Pushing to origin (Vercel)..."
git push origin master
echo "✓ Pushed to origin"

# Step 4: Push to singh (GitHub → Render)
echo ""
echo "[4/6] Pushing to singh (Render)..."
git push singh master:main
echo "✓ Pushed to singh"

# Step 5: Trigger Render deploy via Deploy Hook (ensures deploy even if no backend changes)
echo ""
echo "[5/6] Triggering Render deploy..."
if [ -n "$RENDER_DEPLOY_HOOK_URL" ]; then
    curl -s -X POST "$RENDER_DEPLOY_HOOK_URL" > /dev/null && echo "✓ Render deploy triggered" || echo "⚠ Render trigger failed (will auto-deploy if backend changed)"
else
    echo "⚠ RENDER_DEPLOY_HOOK_URL not set - relying on auto-deploy"
    echo "  Set in oms/.env.local to enable force deploy"
fi

# Step 6: Deploy to Vercel (explicit deploy for immediate update)
echo ""
echo "[6/6] Deploying to Vercel..."
cd "$OMS_DIR"
npx vercel --prod --yes

# Verification
echo ""
echo "=========================================="
echo "Verifying deployments..."
echo "=========================================="

sleep 3

# Check Vercel
echo -n "Vercel: "
vercel_code=$(curl -s -o /dev/null -w "%{http_code}" https://oms-sable.vercel.app/login)
if [ "$vercel_code" = "200" ]; then
    echo "OK (200)"
else
    echo "Status: $vercel_code"
fi

# Check Render
echo -n "Render: "
render_code=$(curl -s -o /dev/null -w "%{http_code}" https://cjdquick-api-vr4w.onrender.com/health)
if [ "$render_code" = "200" ]; then
    echo "OK (200)"
else
    echo "Status: $render_code (may be waking up - free tier)"
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "URLs:"
echo "  Frontend: https://oms-sable.vercel.app"
echo "  Backend:  https://cjdquick-api-vr4w.onrender.com"
echo "  API Docs: https://cjdquick-api-vr4w.onrender.com/docs"
