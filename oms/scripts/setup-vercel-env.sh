#!/bin/bash
# Set all Vercel environment variables at once

set -e

echo "🔧 Setting Vercel environment variables..."

# Source the env file
source .env.production 2>/dev/null || true

# Set each variable (will prompt if not already set)
declare -A ENV_VARS=(
    ["DATABASE_URL"]="postgresql://postgres.rilakxywitslblkgikzf:Aquapurite2026@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    ["DIRECT_URL"]="postgresql://postgres.rilakxywitslblkgikzf:Aquapurite2026@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
    ["AUTH_SECRET"]="Q6ERr3OYnYPY9W2t0Bjr/dd5EJAHfc9sGfHU0dcWRkk="
    ["NEXTAUTH_SECRET"]="Q6ERr3OYnYPY9W2t0Bjr/dd5EJAHfc9sGfHU0dcWRkk="
    ["NEXTAUTH_URL"]="https://oms-sable.vercel.app"
    ["NEXT_PUBLIC_API_URL"]="https://cjdquick-api-vr4w.onrender.com"
    ["AUTH_TRUST_HOST"]="true"
)

for key in "${!ENV_VARS[@]}"; do
    echo "Setting $key..."
    echo "${ENV_VARS[$key]}" | npx vercel env add "$key" production --force 2>/dev/null || \
    echo "${ENV_VARS[$key]}" | npx vercel env add "$key" production 2>/dev/null || \
    echo "  ⚠️  $key already exists (skipped)"
done

echo "✅ Vercel environment variables configured!"
echo ""
echo "Run 'npx vercel --prod' to deploy with new env vars"
