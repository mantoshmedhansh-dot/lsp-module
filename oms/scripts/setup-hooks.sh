#!/bin/bash
# Setup git hooks for CJDQuick OMS
# Run this after cloning to install pre-push validation

cd "$(dirname "$0")/.."

echo "Installing git hooks..."

# Create pre-push hook
cat > .git/hooks/pre-push << 'HOOK'
#!/bin/bash
# Pre-push hook: Validates build before allowing push
# This prevents broken deployments to Vercel and Render

echo "========================================"
echo "Pre-push hook: Validating build..."
echo "========================================"

cd "$(git rev-parse --show-toplevel)"

# Quick build validation (just generate prisma, don't full build for speed)
echo "Generating Prisma client..."
npm run prisma:generate > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Prisma generate failed!"
    echo "Fix the error and try again."
    exit 1
fi

echo "Prisma client generated successfully"

# Check if key config files are correct
echo "Validating configuration..."

# Check next.config.js has transpilePackages
if ! grep -q "transpilePackages.*@oms/database" apps/web/next.config.js 2>/dev/null; then
    echo ""
    echo "ERROR: next.config.js missing @oms/database in transpilePackages!"
    echo "This will break Vercel deployment."
    exit 1
fi

# Check database package.json exports from src
if ! grep -q '"main".*"./src/index.ts"' packages/database/package.json 2>/dev/null; then
    echo ""
    echo "ERROR: packages/database/package.json must have main: ./src/index.ts"
    echo "This will break the build."
    exit 1
fi

echo "Configuration validated"
echo ""
echo "========================================"
echo "Pre-push validation PASSED"
echo "========================================"
echo ""
echo "Remember: Push to BOTH remotes for full deployment:"
echo "  git push origin master"
echo "  git push singh master:main"
echo ""

exit 0
HOOK

chmod +x .git/hooks/pre-push

echo "Git hooks installed successfully!"
echo ""
echo "The pre-push hook will validate:"
echo "  - Prisma client generation"
echo "  - next.config.js transpilePackages"
echo "  - packages/database/package.json main field"
