#!/bin/bash
# CJDQuick OMS - Trigger Render Deploy
# This script triggers a Render deployment using the Deploy Hook
#
# Usage: ./scripts/trigger-render-deploy.sh
#
# The Deploy Hook URL should be set in .env.local as RENDER_DEPLOY_HOOK_URL
# Get this URL from: Render Dashboard → Service → Settings → Deploy Hook

set -e

cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Check if Deploy Hook URL is set
if [ -z "$RENDER_DEPLOY_HOOK_URL" ]; then
    echo "ERROR: RENDER_DEPLOY_HOOK_URL not set!"
    echo ""
    echo "To fix this:"
    echo "1. Go to Render Dashboard → cjdquick-api → Settings"
    echo "2. Scroll to 'Deploy Hook' section"
    echo "3. Copy the Deploy Hook URL"
    echo "4. Add to oms/.env.local:"
    echo "   RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxxx?key=xxxxx"
    echo ""
    exit 1
fi

echo "Triggering Render deployment..."
response=$(curl -s -X POST "$RENDER_DEPLOY_HOOK_URL")

if [ $? -eq 0 ]; then
    echo "✓ Render deploy triggered successfully!"
    echo "  Check status at: https://dashboard.render.com"
else
    echo "✗ Failed to trigger Render deploy"
    echo "  Response: $response"
    exit 1
fi
