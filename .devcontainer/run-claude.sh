#!/bin/bash
set -euo pipefail

# Script to run Claude Code in a sandboxed Docker container

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env file exists, create if needed
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}No .env file found, creating from template...${NC}"
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo -e "${YELLOW}Created .env file at $SCRIPT_DIR/.env${NC}"
    echo ""
fi

# Source environment variables (if file exists)
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

# Note: API key is optional for Claude Max subscribers
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo -e "${YELLOW}Note: ANTHROPIC_API_KEY not set${NC}"
    echo "If you have a Claude Max subscription, this is fine - you'll authenticate via browser."
    echo "If you need API-based auth, add ANTHROPIC_API_KEY to .env"
    echo ""
fi

echo -e "${GREEN}Starting Claude Code sandbox...${NC}"
echo "Project root: $PROJECT_ROOT"
echo ""

# Build and start the container
cd "$SCRIPT_DIR"
docker compose up -d --build

echo ""
echo -e "${GREEN}Container started!${NC}"
echo ""
echo "To attach to Claude Code, run:"
echo -e "${YELLOW}  docker exec -it claude-sandbox claude${NC}"
echo ""
echo "To open an interactive shell:"
echo -e "${YELLOW}  docker exec -it claude-sandbox zsh${NC}"
echo ""
echo "To view logs:"
echo -e "${YELLOW}  docker compose -f $SCRIPT_DIR/docker-compose.yml logs -f${NC}"
echo ""
echo "To stop the container:"
echo -e "${YELLOW}  docker compose -f $SCRIPT_DIR/docker-compose.yml down${NC}"
echo ""
