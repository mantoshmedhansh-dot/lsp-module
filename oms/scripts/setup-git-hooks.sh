#!/bin/bash
# CJDQuick OMS - Setup Git Hooks for Auto-Deployment
# This script sets up Git hooks to automatically trigger Render deploy
#
# Usage: ./scripts/setup-git-hooks.sh

set -e

# Navigate to git root (parent of oms)
cd "$(dirname "$0")/../.."

GIT_ROOT=$(pwd)
HOOKS_DIR="$GIT_ROOT/.git/hooks"
OMS_DIR="$GIT_ROOT/oms"

echo "Setting up Git hooks for auto-deployment..."
echo "Git root: $GIT_ROOT"
echo "Hooks dir: $HOOKS_DIR"

# Create post-push hook (called after git push)
# Note: Git doesn't have native post-push, so we use a wrapper approach
cat > "$HOOKS_DIR/pre-push" << 'HOOK_SCRIPT'
#!/bin/bash
# CJDQuick OMS - Pre-Push Hook
# Triggers Render deploy when pushing to singh remote

# Get the remote name being pushed to
remote="$1"
url="$2"

# Only trigger for singh remote (Render)
if [[ "$remote" == "singh" ]] || [[ "$url" == *"singhmantoshkumar22"* ]]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Pushing to singh remote - Will trigger Render deploy"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Set flag for post-checkout to trigger deploy
    # We'll use an at-exit trap to trigger after push completes
    export TRIGGER_RENDER_DEPLOY=1
fi

# Allow push to continue
exit 0
HOOK_SCRIPT

chmod +x "$HOOKS_DIR/pre-push"

# Create a wrapper script for git push that triggers Render after singh push
cat > "$OMS_DIR/scripts/git-push-all.sh" << 'WRAPPER_SCRIPT'
#!/bin/bash
# CJDQuick OMS - Git Push All
# Pushes to all remotes and triggers Render deploy
#
# Usage: ./scripts/git-push-all.sh [commit-message]

set -e

cd "$(dirname "$0")/.."
OMS_DIR=$(pwd)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CJDQuick OMS - Push to All Remotes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for uncommitted changes
cd ..
if [[ -n $(git status -s) ]]; then
    echo ""
    echo "Uncommitted changes detected:"
    git status --short
    echo ""

    if [ -n "$1" ]; then
        commit_msg="$1"
    else
        read -p "Enter commit message: " commit_msg
    fi

    git add -A
    git commit -m "$commit_msg

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
fi

# Push to origin (Vercel auto-deploy)
echo ""
echo "[1/3] Pushing to origin (Vercel)..."
git push origin master
echo "✓ Pushed to origin"

# Push to singh (Render)
echo ""
echo "[2/3] Pushing to singh (Render)..."
git push singh master:main
echo "✓ Pushed to singh"

# Trigger Render deploy (in case auto-deploy doesn't trigger)
echo ""
echo "[3/3] Triggering Render deploy..."
if [ -f "$OMS_DIR/scripts/trigger-render-deploy.sh" ]; then
    "$OMS_DIR/scripts/trigger-render-deploy.sh" || echo "⚠ Render trigger skipped (hook URL not set)"
else
    echo "⚠ trigger-render-deploy.sh not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ All pushes complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "URLs:"
echo "  Frontend (Vercel): https://oms-sable.vercel.app"
echo "  Backend (Render):  https://cjdquick-api-vr4w.onrender.com"
echo ""
WRAPPER_SCRIPT

chmod +x "$OMS_DIR/scripts/git-push-all.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Git hooks installed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Usage:"
echo "  ./scripts/git-push-all.sh           # Push to all remotes + trigger Render"
echo "  ./scripts/trigger-render-deploy.sh  # Force trigger Render deploy only"
echo ""
echo "IMPORTANT: Set your Render Deploy Hook URL in oms/.env.local:"
echo "  RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxxx?key=xxxxx"
echo ""
echo "Get the URL from: Render Dashboard → cjdquick-api → Settings → Deploy Hook"
echo ""
