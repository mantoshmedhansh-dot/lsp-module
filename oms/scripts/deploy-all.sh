#!/bin/bash
# Deploy to all platforms with one command

set -e

echo "🚀 Starting full deployment..."

# 1. Commit any uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "📝 Committing changes..."
    git add -A
    git commit -m "chore: Auto-deploy $(date +%Y-%m-%d_%H:%M)"
fi

# 2. Push to all remotes
echo "📤 Pushing to GitHub remotes..."
git push origin master || true
git push singh master:main || true

# 3. Deploy to Vercel
echo "🔷 Deploying to Vercel..."
npx vercel --prod

# 4. Seed database (optional)
read -p "Seed database? (y/n): " seed
if [[ "$seed" == "y" ]]; then
    cd packages/database && npm run db:seed && cd ../..
fi

echo "✅ Deployment complete!"
echo ""
echo "URLs:"
echo "  Frontend: https://oms-sable.vercel.app"
echo "  Backend:  https://cjdquick-api-vr4w.onrender.com"
echo "  API Docs: https://cjdquick-api-vr4w.onrender.com/docs"
