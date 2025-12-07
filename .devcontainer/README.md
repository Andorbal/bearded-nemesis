# Claude Code Sandbox

A sandboxed Docker environment for running Claude Code with network restrictions and access to local development services.

## Quick Start

```bash
# Run Claude Code (container auto-removes when you exit)
.devcontainer/run-claude.sh
```

That's it. No `docker compose up`, no `docker compose down`, no cleanup needed.

## Usage

```bash
# Standard usage - launches Claude Code directly
.devcontainer/run-claude.sh

# Force rebuild the image (after Dockerfile changes)
.devcontainer/run-claude.sh --build

# Start a shell instead (run 'claude' manually when ready)
.devcontainer/run-claude.sh --shell
```

## Prerequisites

Before running the sandbox, start the main project services:

```bash
# From project root
docker-compose up -d
```

This starts PostgreSQL (port 5434) and the Solver service (port 8081), which the sandbox connects to via `host.docker.internal`.

### GitLab Access (Optional)

If you need Claude to access a private GitLab instance:

1. Add your GitLab domain to `allowed-domains.local.txt`:
   ```bash
   echo "git.yourdomain.com" >> .devcontainer/allowed-domains.local.txt
   ```

2. Add your GitLab credentials to `.devcontainer/.env`:
   ```bash
   GITLAB_HOST=git.yourdomain.com
   GITLAB_TOKEN=your_personal_access_token
   ```

3. Inside the container, configure `glab` CLI:
   ```bash
   glab config set host $GITLAB_HOST -g
   glab auth login --hostname $GITLAB_HOST --token $GITLAB_TOKEN
   ```

The `GITLAB_HOST` and `GITLAB_TOKEN` environment variables will be available in the container.

## What It Does

- **Network sandbox**: Restricts outbound traffic to only essential services (GitHub, npm, Anthropic API, etc.)
- **Persistent config**: Your Claude authentication and shell history survive container restarts
- **Host service access**: Connects to PostgreSQL and Solver running on your host machine
- **Auto-cleanup**: Container is automatically removed when you exit

## Configuring Allowed Domains

The firewall restricts outbound network access. Allowed domains are configured in two files:

| File | Purpose |
|------|---------|
| `allowed-domains.txt` | Shared domains (committed to repo) |
| `allowed-domains.local.txt` | Personal domains (gitignored) |

Both files use the same format:
- One domain per line
- Lines starting with `#` are comments
- Empty lines are ignored

To add a personal domain (e.g., your own GitLab instance):

```bash
echo "git.mycompany.com" >> .devcontainer/allowed-domains.local.txt
```

GitHub is handled separately via their API metadata, so you don't need to add GitHub domains manually.

## Files

| File | Purpose |
|------|---------|
| `run-claude.sh` | Main entry point - use this |
| `Dockerfile` | Container image definition |
| `init-firewall.sh` | Network restriction rules |
| `allowed-domains.txt` | Allowed domains (committed) |
| `allowed-domains.local.txt` | Personal allowed domains (gitignored) |
| `.env` | Local configuration (created from `.env.example`) |
| `docker-compose.yml` | Alternative for VS Code devcontainer integration |
| `devcontainer.json` | VS Code devcontainer configuration |
