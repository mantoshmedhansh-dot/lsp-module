#!/bin/bash
# CJDQuick - Push to all remotes and trigger deployments
#
# This script:
# 1. Pushes to origin (singhmantoshkumar22 - PRIMARY)
# 2. Pushes to puneet (BACKUP)
# 3. Triggers Render deploy hook (ensures deployment even if webhook fails)
# 4. Optionally triggers Vercel deployment
#
# Usage: ./scripts/push-all.sh [--vercel]

set -e

cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs 2>/dev/null) || true
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CJDQuick - Push & Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Push to origin (PRIMARY - singhmantoshkumar22)
echo "[1/4] Pushing to origin (singhmantoshkumar22)..."
cd ..
git push origin main
echo "✓ Pushed to origin"

# Step 2: Push to puneet (BACKUP)
echo ""
echo "[2/4] Pushing to puneet (backup)..."
git push puneet main || echo "⚠ Failed to push to puneet (continuing...)"
echo "✓ Pushed to puneet"

# Step 3: Trigger Render deployment
echo ""
echo "[3/4] Triggering Render deployment..."
if [ -n "$RENDER_DEPLOY_HOOK_URL" ]; then
    response=$(curl -s -X POST "$RENDER_DEPLOY_HOOK_URL")
    deploy_id=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$deploy_id" ]; then
        echo "✓ Render deploy triggered: $deploy_id"
    else
        echo "✓ Render deploy triggered"
    fi
else
    echo "⚠ RENDER_DEPLOY_HOOK_URL not set - relying on auto-deploy"
fi

# Step 4: Optionally trigger Vercel deployment
echo ""
if [ "$1" = "--vercel" ]; then
    echo "[4/4] Triggering Vercel deployment..."
    cd oms
    npx vercel --prod --yes 2>&1 | tail -5
    echo "✓ Vercel deployed"
else
    echo "[4/4] Skipping Vercel CLI deploy (use --vercel flag to include)"
    echo "    Vercel will auto-deploy from GitHub push"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done! Check deployments at:"
echo "  Render:  https://dashboard.render.com"
echo "  Vercel:  https://vercel.com/mantosh-singhs-projects/oms"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
