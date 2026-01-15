#!/bin/bash
# CJDQuick OMS - Local Development Startup Script
# Starts PostgreSQL via Docker and initializes the database

set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "CJDQuick OMS - Local Development Setup"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env.local exists
if [ ! -f "packages/database/.env.local" ]; then
    echo "Creating packages/database/.env.local from template..."
    if [ -f ".env.local.example" ]; then
        cp .env.local.example packages/database/.env.local
        echo "Created packages/database/.env.local"
        echo "Edit this file if you need to change database settings."
    else
        cat > packages/database/.env.local << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/oms"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/oms"
EOF
        echo "Created packages/database/.env.local with default settings."
    fi
fi

# Start PostgreSQL container
echo ""
echo "[1/4] Starting PostgreSQL container..."
docker compose up -d postgres

# Wait for PostgreSQL to be ready
echo ""
echo "[2/4] Waiting for PostgreSQL to be ready..."
timeout=30
counter=0
until docker compose exec -T postgres pg_isready -U postgres -d oms > /dev/null 2>&1; do
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        echo "ERROR: PostgreSQL failed to start within ${timeout} seconds"
        exit 1
    fi
    echo "Waiting for PostgreSQL... (${counter}s)"
    sleep 1
done
echo "PostgreSQL is ready!"

# Generate Prisma client
echo ""
echo "[3/4] Generating Prisma client..."
npm run prisma:generate

# Push schema to database (creates tables)
echo ""
echo "[4/4] Pushing schema to database..."
cd packages/database
npx prisma db push --skip-generate
cd ../..

echo ""
echo "=========================================="
echo "Local Development Setup Complete!"
echo "=========================================="
echo ""
echo "Database: postgresql://postgres:postgres@localhost:5432/oms"
echo ""
echo "Commands:"
echo "  npm run dev              - Start development servers"
echo "  npm run db:studio        - Open Prisma Studio"
echo "  npm run db:seed          - Seed sample data"
echo "  docker compose down      - Stop PostgreSQL"
echo "  docker compose logs -f   - View PostgreSQL logs"
echo ""
echo "Optional: Start pgAdmin (database UI)"
echo "  docker compose --profile tools up -d"
echo "  Open http://localhost:5050"
echo ""
