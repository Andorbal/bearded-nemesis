#!/bin/bash
set -euo pipefail

# Script to run Claude Code in a sandboxed Docker container
# The container is automatically removed when you exit Claude.
#
# Usage: ./run-claude.sh [--build] [--shell]
#   --build  Force rebuild the Docker image before running
#   --shell  Start a zsh shell instead of Claude Code

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse arguments
FORCE_BUILD=false
START_SHELL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            FORCE_BUILD=true
            shift
            ;;
        --shell)
            START_SHELL=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--build] [--shell]"
            exit 1
            ;;
    esac
done

# Check if .env file exists, create if needed
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}No .env file found, creating from template...${NC}"
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo -e "${YELLOW}Created .env file at $SCRIPT_DIR/.env${NC}"
    echo ""
fi

# Source environment variables (if file exists)
if [ -f "$SCRIPT_DIR/.env" ]; then
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/.env"
fi

# Set defaults for build args
TZ="${TZ:-America/Los_Angeles}"
CLAUDE_CODE_VERSION="${CLAUDE_CODE_VERSION:-latest}"
GIT_DELTA_VERSION="${GIT_DELTA_VERSION:-0.18.2}"
ZSH_IN_DOCKER_VERSION="${ZSH_IN_DOCKER_VERSION:-1.2.0}"

IMAGE_NAME="claude-sandbox"

# Check if image exists or if we need to build
IMAGE_EXISTS=$(docker images -q "$IMAGE_NAME" 2>/dev/null)

if [ -z "$IMAGE_EXISTS" ] || [ "$FORCE_BUILD" = true ]; then
    echo -e "${GREEN}Building Claude Code sandbox image...${NC}"
    docker build \
        --build-arg TZ="$TZ" \
        --build-arg CLAUDE_CODE_VERSION="$CLAUDE_CODE_VERSION" \
        --build-arg GIT_DELTA_VERSION="$GIT_DELTA_VERSION" \
        --build-arg ZSH_IN_DOCKER_VERSION="$ZSH_IN_DOCKER_VERSION" \
        -t "$IMAGE_NAME" \
        "$SCRIPT_DIR"
    echo ""
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

# Determine the command to run
# Both modes run firewall setup first for consistent security
if [ "$START_SHELL" = true ]; then
    FINAL_CMD="exec zsh"
    echo -e "${YELLOW}Starting interactive shell (type 'claude' to run Claude Code)${NC}"
else
    FINAL_CMD="exec claude"
    echo -e "${YELLOW}Starting Claude Code (container will auto-remove on exit)${NC}"
fi

echo ""

# Run the container with --rm so it auto-removes on exit
# This replicates all the settings from docker-compose.yml
# Using --entrypoint and passing command as a single string to sh -c
# Connect to the main project's network for proper routing to host services
docker run --rm -it \
    --name claude-sandbox \
    --memory=3g \
    --memory-swap=3g \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    --add-host=host.docker.internal:host-gateway \
    -v "$PROJECT_ROOT:/workspace:delegated" \
    -v claude-bash-history:/commandhistory \
    -v claude-config:/home/node/.claude \
    -v "$SCRIPT_DIR/allowed-domains.local.txt:/etc/claude-firewall/allowed-domains.local.txt:ro" \
    -e NODE_OPTIONS="--max-old-space-size=4096" \
    -e CLAUDE_CONFIG_DIR="/home/node/.claude" \
    -e POWERLEVEL9K_DISABLE_GITSTATUS=true \
    -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    -e DATABASE_URL="postgresql://rockband:rockband@host.docker.internal:5434/rockband" \
    -e SOLVER_URL="http://host.docker.internal:8081" \
    -w /workspace \
    --entrypoint sh \
    "$IMAGE_NAME" \
    -c "sudo /usr/local/bin/init-firewall.sh && $FINAL_CMD"

echo ""
echo -e "${GREEN}Container stopped and removed.${NC}"
