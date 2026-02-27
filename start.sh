#!/bin/bash
# ---------------------------------------------------------------------------
# OpenWebClaw - Quick Start Script
# ---------------------------------------------------------------------------
# One-command setup and start for Docker
# ---------------------------------------------------------------------------

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        OpenWebClaw - Docker Quick Start                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check docker compose
if ! docker compose version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

# Create .env if missing
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env with defaults${NC}"
fi

# Source environment
set -a
source .env
set +a




echo ""
echo -e "${BLUE}🚀 Starting services...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}✅ Services started!${NC}"
echo ""

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  OpenWebClaw is running!                                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "   📱 App:      http://localhost:${APP_PORT:-5173}"
echo "   💬 Matrix support has been disabled."
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "   1. Open the app in your browser"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "   View logs:  docker compose logs -f"
echo "   Stop:       docker compose down"
echo "   Status:     docker compose ps"
echo ""