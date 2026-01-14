# CJDQuick OMS - Quick Commands
# Usage: make <command>

.PHONY: deploy audit seed vercel render push help

# Deploy everything
deploy:
	@./scripts/deploy-all.sh

# Audit all configurations
audit:
	@./scripts/audit-config.sh

# Seed database
seed:
	cd packages/database && npm run db:seed

# Deploy to Vercel only
vercel:
	npx vercel --prod

# Push to Render (triggers auto-deploy)
render:
	git push singh master:main

# Push to all remotes
push:
	git push origin master
	git push singh master:main

# Setup Vercel env vars
setup-env:
	@./scripts/setup-vercel-env.sh

# Start local development
dev:
	cd apps/web && npm run dev

# Run backend locally
backend:
	cd backend && uvicorn app.main:app --reload --port 8000

# Open URLs
open:
	open https://oms-sable.vercel.app
	open https://cjdquick-api-vr4w.onrender.com/docs

# Help
help:
	@echo "CJDQuick OMS Commands:"
	@echo "  make deploy    - Deploy to all platforms"
	@echo "  make audit     - Check all configurations"
	@echo "  make seed      - Seed the database"
	@echo "  make vercel    - Deploy to Vercel only"
	@echo "  make render    - Push to Render (auto-deploy)"
	@echo "  make push      - Push to all git remotes"
	@echo "  make setup-env - Setup Vercel env vars"
	@echo "  make dev       - Start local development"
	@echo "  make open      - Open production URLs"
