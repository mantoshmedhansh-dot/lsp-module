#!/bin/bash
# Deploy script - push to main and deploy to Vercel
echo "Pushing to origin/main..."
git push origin main

echo "Deploying to Vercel..."
npx vercel deploy --prod --yes

echo "Done!"
