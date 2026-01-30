#!/bin/bash
# Deploy script - pushes to both main and master for Vercel
echo "Pushing to origin/main..."
git push origin main

echo "Pushing to origin/master (for Vercel)..."
git push origin main:master

echo "Done! Check Vercel for deployment status."
