# ---------------------------------------------------------------------------
# OpenWebClaw - Makefile
# ---------------------------------------------------------------------------
# Convenient commands for Docker operations
# ---------------------------------------------------------------------------

.PHONY: help build up down restart logs shell clean setup status

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo ""
	@echo "$(BLUE)OpenWebClaw - Docker Commands$(NC)"
	@echo "===================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

setup: ## Initial setup - copy .env
	@echo "$(BLUE)🚀 Setting up OpenWebClaw...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Creating .env from template...$(NC)"; \
		cp .env.example .env; \
	fi
	@echo "$(GREEN)✅ Setup complete! Edit .env with your settings, then run 'make up'$(NC)"



build: ## Build all Docker images
	@echo "$(BLUE)🔨 Building Docker images...$(NC)"
	docker compose build

up: ## Start all services in detached mode
	@echo "$(BLUE)🚀 Starting services...$(NC)"
	docker compose up -d
	@echo "$(GREEN)✅ Services started!$(NC)"
	@echo ""
	@echo "App: http://localhost:5173"
	@echo "Matrix support disabled"
	@echo ""
	@echo "$(YELLOW)⚠️  Wait 10-20 seconds for services to fully start$(NC)"

up-logs: ## Start all services and follow logs
	@echo "$(BLUE)🚀 Starting services with logs...$(NC)"
	docker compose up

down: ## Stop and remove all services
	@echo "$(BLUE)🛑 Stopping services...$(NC)"
	docker compose down

restart: ## Restart all services
	@echo "$(BLUE)🔄 Restarting services...$(NC)"
	docker compose restart

logs: ## View logs from all services
	@echo "$(BLUE)📋 Showing logs (Ctrl+C to exit)...$(NC)"
	docker compose logs -f

logs-app: ## View logs from OpenWebClaw only
	docker compose logs -f openwebclaw


shell: ## Open a shell in the OpenWebClaw container
	docker compose exec openwebclaw sh


status: ## Check status of all services
	@echo "$(BLUE)📊 Service Status:$(NC)"
	@docker compose ps
	@echo ""
	@echo "$(BLUE)Health Checks:$(NC)"
	@curl -s -o /dev/null -w "App: %{http_code}\n" http://localhost:5173/health 2>/dev/null || echo "$(RED)App: Not responding$(NC)"

clean: ## Remove containers and volumes (WARNING: deletes all data!)
	@echo "$(RED)⚠️  This will delete all data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 0
	docker compose down -v
	docker compose rm -f
	@echo "$(GREEN)✅ Cleaned up!$(NC)"


update: ## Pull latest images and rebuild
	@echo "$(BLUE)⬇️  Pulling latest images...$(NC)"
	docker compose pull
	@echo "$(BLUE)🔨 Rebuilding...$(NC)"
	docker compose build --no-cache
	@echo "$(GREEN)✅ Updated! Run 'make up' to start.$(NC)"




config: ## Show current configuration
	@echo "$(BLUE)📋 Current Configuration:$(NC)"
	@cat .env 2>/dev/null || echo "$(YELLOW).env file not found$(NC)"

dev: ## Run in development mode with hot reload (requires npm)
	@echo "$(BLUE)🚀 Starting development server...$(NC)"
	@echo "Note: This runs outside Docker. Use 'make up' for Docker."
	npm run dev

init: setup generate ## Full initialization (setup + generate)