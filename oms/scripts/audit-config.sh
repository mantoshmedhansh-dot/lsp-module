#!/bin/bash
# Audit all configurations and connections

echo "🔍 CJDQuick OMS - Configuration Audit"
echo "======================================"
echo ""

# Check Vercel
echo "📦 VERCEL STATUS:"
if npx vercel whoami &>/dev/null; then
    echo "  ✅ Logged in as: $(npx vercel whoami 2>/dev/null)"
    echo "  Environment variables:"
    npx vercel env ls 2>/dev/null | grep -E "name|---" | head -20
else
    echo "  ❌ Not logged in. Run: npx vercel login"
fi
echo ""

# Check Git remotes
echo "📤 GIT REMOTES:"
git remote -v | while read line; do echo "  $line"; done
echo ""

# Check Frontend
echo "🌐 FRONTEND (Vercel):"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://oms-sable.vercel.app/login")
if [ "$STATUS" == "200" ]; then
    echo "  ✅ https://oms-sable.vercel.app - Online"
else
    echo "  ❌ https://oms-sable.vercel.app - Status: $STATUS"
fi
echo ""

# Check Backend
echo "⚙️  BACKEND (Render):"
HEALTH=$(curl -s "https://cjdquick-api-vr4w.onrender.com/health" 2>/dev/null)
if [[ "$HEALTH" == *"healthy"* ]]; then
    echo "  ✅ https://cjdquick-api-vr4w.onrender.com - Healthy"
else
    echo "  ⚠️  https://cjdquick-api-vr4w.onrender.com - May be sleeping (free tier)"
fi
echo ""

# Check Auth API
echo "🔐 AUTH STATUS:"
AUTH=$(curl -s "https://oms-sable.vercel.app/api/auth/providers")
if [[ "$AUTH" == *"credentials"* ]]; then
    echo "  ✅ NextAuth configured correctly"
else
    echo "  ❌ NextAuth not responding"
fi
echo ""

# Local env files
echo "📁 LOCAL ENV FILES:"
for f in .env .env.local .env.production packages/database/.env backend/.env apps/web/.env.local; do
    if [ -f "$f" ]; then
        echo "  ✅ $f exists"
    else
        echo "  ⚠️  $f missing"
    fi
done
echo ""

echo "======================================"
echo "Audit complete!"
