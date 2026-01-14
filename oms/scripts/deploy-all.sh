#!/bin/bash
# CJDQuick OMS - Unified Deployment Script
# Deploys to both Vercel (frontend) and Render (backend)

set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "CJDQuick OMS - Unified Deployment"
echo "=========================================="

# Step 1: Build test (catch errors before deploying)
echo ""
echo "[1/5] Running build test..."
npm run prisma:generate
cd apps/web && npm run build && cd ../..
echo "Build test passed"

# Step 2: Commit any uncommitted changes
echo ""
echo "[2/5] Checking for uncommitted changes..."
if [[ -n $(git status -s) ]]; then
    echo "Found uncommitted changes:"
    git status --short
    read -p "Commit message: " commit_msg
    git add -A
    git commit -m "$commit_msg

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
fi

# Step 3: Push to origin (GitHub)
echo ""
echo "[3/5] Pushing to origin..."
git push origin master
echo "Pushed to origin"

# Step 4: Push to singh (Render auto-deploy)
echo ""
echo "[4/5] Pushing to singh (Render)..."
git push singh master:main
echo "Pushed to singh - Render will auto-deploy"

# Step 5: Deploy to Vercel
echo ""
echo "[5/5] Deploying to Vercel..."
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
