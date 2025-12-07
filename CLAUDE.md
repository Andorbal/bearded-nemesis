# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bearded Nemesis is a Rock Band 4 setlist management application. It helps users manage their song library, track performance statistics, create optimized setlists using linear programming, and play through setlists while recording stats.

## Critical: Package Manager

**USE PNPM ONLY. DO NOT USE NPM.**

This is a pnpm workspace monorepo. Using npm will break the workspace symlinks and cause dependency resolution issues. Always use `pnpm` for all package operations.

## Architecture

**Monorepo structure using pnpm workspaces:**

- `apps/api` - Fastify TypeScript API server with PostgreSQL
- `apps/frontend` - SvelteKit 5 web application
- `apps/solver` - Python FastAPI service for OCR and linear programming optimization
- `packages/shared` - TypeScript types and constants shared between API and frontend
- `scripts` - Data import/build tools for song metadata

**Key data flow:**
1. Songs are imported via scripts that fetch from external sources (rb4.app, spreadsheets)
2. Users manage their song library and create setlists through the frontend
3. The solver service handles setlist optimization (LP) and screenshot OCR for stats extraction
4. Playthroughs support real-time multi-player sync via WebSockets

**API code organization (`apps/api/src/`):**
- `routes/` - HTTP endpoint handlers
- `repositories/` - Database operations (one per entity)
- `services/` - Business logic (setlist building, OCR, WebSocket management)
- `middleware/` - Auth and admin checks

## Development Commands

```bash
# Install dependencies (from root)
pnpm install

# Build shared package first (required before running apps)
pnpm --filter @bearded-nemesis/shared build

# Start services
docker-compose up -d              # PostgreSQL (port 5434) and Solver (port 8081)
pnpm --filter @bearded-nemesis/api dev      # API on port 3010
pnpm --filter @bearded-nemesis/frontend dev # Frontend on port 5173

# Database
pnpm --filter @bearded-nemesis/api db:migrate
pnpm --filter @bearded-nemesis/api db:seed

# Testing
pnpm --filter @bearded-nemesis/api test        # Run tests once
pnpm --filter @bearded-nemesis/api test:watch  # Watch mode

# Frontend type checking and formatting
pnpm --filter @bearded-nemesis/frontend check        # Type check
pnpm --filter @bearded-nemesis/frontend check:watch  # Watch mode
pnpm --filter @bearded-nemesis/frontend format       # Format with Prettier

# Solver tests (Python - run from apps/solver directory)
cd apps/solver && python -m pytest app/

# Build all packages
pnpm build

# Linting
pnpm lint

# Data scripts (from scripts directory)
pnpm --filter @bearded-nemesis/scripts build-songs
pnpm --filter @bearded-nemesis/scripts copy-covers
```

## Environment Setup

Copy `apps/api/.env.example` to `apps/api/.env.local`:

```
DATABASE_URL=postgres://rockband:rockband@localhost:5434/rockband
JWT_SECRET=<32+ character secret>
```

Note: Docker exposes PostgreSQL on port **5434** (not 5432) to avoid conflicts.

Additional environment variables (see `apps/api/.env.example`):
- `SOLVER_URL` - URL for Python solver service (default: http://localhost:8081)
- `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` - Token expiration times
- `SCREENSHOT_PATH` - Directory for OCR screenshot uploads

## Key Domain Concepts

- **Song difficulties** are 1-7 (the dots in Rock Band)
- **User ratings** are 1-5 stars
- **Instruments**: drums, guitar, bass, vocals
- **Setlist types**: manual (user-picked), smart (filter-based), builder (LP-optimized)
- **Playthroughs** track each session with multiple players, each rating songs independently

## Testing Patterns

Tests use Vitest and are colocated with source files (e.g., `songRepository.test.ts`).

```bash
# Run specific test file
pnpm --filter @bearded-nemesis/api test songRepository
```

## Database

- PostgreSQL 16 via Docker
- Migrations in `apps/api/src/db/migrations/` (sequential SQL files)
- Simple migration runner tracks applied migrations in `migrations` table
- When you commit changes, use "Claude" as your name and "noreply@anthropic.com" as your email address.