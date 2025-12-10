# Bearded Nemesis

Bearded Nemesis is a setlist management application for Rock Band 4. It helps players organize their song library, track performance statistics across multiple players, and create optimized setlists using linear programming. The application supports real-time multiplayer sessions where each player can rate songs independently while performance data is captured via screenshot OCR.

## Quick Start

The project uses pnpm workspaces. Make sure you have [pnpm](https://pnpm.io/) and [Docker](https://www.docker.com/) installed.

```bash
# Install dependencies
pnpm install

# Build the shared package (required before running apps)
pnpm --filter @bearded-nemesis/shared build

# Start PostgreSQL and the solver service
docker-compose up -d

# Set up environment (copy and edit as needed)
cp apps/api/.env.example apps/api/.env.local

# Run database migrations and seed data
pnpm --filter @bearded-nemesis/api db:migrate
pnpm --filter @bearded-nemesis/api db:seed

# Start the API and frontend (in separate terminals)
pnpm --filter @bearded-nemesis/api dev      # API on http://localhost:3001
pnpm --filter @bearded-nemesis/frontend dev # Frontend on http://localhost:5173
```

Docker exposes PostgreSQL on port 5434 to avoid conflicts with local installations. The default database URL in `.env.example` reflects this.

## Architecture Overview

Bearded Nemesis is structured as a monorepo with three main applications and a shared package. Songs are imported into the database using data scripts that fetch metadata from external sources. Users interact with the frontend to manage their library, build setlists, and run playthroughs. The API handles authentication, data persistence, and coordinates with the solver service for optimization and OCR tasks. During playthroughs, WebSocket connections keep all connected players synchronized in real-time.

### [API](apps/api)

The API is a Fastify server written in TypeScript that serves as the application's backend. It handles user authentication via JWT tokens, manages the PostgreSQL database through a repository pattern, and exposes REST endpoints for songs, setlists, and playthroughs. The API also maintains WebSocket connections for real-time playthrough synchronization, allowing multiple players to participate in the same session with live updates.

### [Frontend](apps/frontend)

The frontend is a SvelteKit 5 application styled with Tailwind CSS. It provides the user interface for browsing and filtering songs, creating and managing setlists, and running playthroughs. The playthrough view connects via WebSocket to show real-time updates as players progress through songs and submit ratings. Screenshot uploads are handled here and sent to the API for OCR processing.

### [Solver](apps/solver)

The solver is a Python FastAPI service that handles two computationally intensive tasks. The first is setlist optimization using HiGHS, a high-performance linear programming solver. Given a pool of candidate songs and constraints like duration limits, difficulty ranges, or minimum ratings, it finds the optimal setlist that maximizes player enjoyment based on historical ratings. The second task is OCR processing using PaddleOCR to extract performance statistics from Rock Band 4 result screen screenshots, automatically capturing scores, accuracy percentages, and note counts for each player.

### [Shared Package](packages/shared)

The shared package contains TypeScript types and constants used by both the API and frontend. This ensures type consistency across the stack for entities like songs, setlists, users, playthroughs, and WebSocket message formats. Any changes to data structures need only be made in one place.

### [Scripts](scripts)

The scripts directory contains data import tools for building the song database. These scripts fetch song metadata from external sources including rb4.app and community-maintained spreadsheets, normalize the data, and prepare it for import into the database. Cover art handling is also managed here.

## Key Concepts

Rock Band uses a 1-7 difficulty scale (represented as dots in-game) for each instrument track. Bearded Nemesis maps these into its difficulty system and combines them with user ratings on a 1-5 scale to enable smart filtering and optimization. Users can rate both how much they enjoy a song overall and how fun it is to play on each instrument.

Setlists come in three flavors. Manual setlists are hand-picked song lists. Smart setlists use filters to dynamically generate a list based on criteria like difficulty range or minimum rating. Builder setlists use the linear programming solver to find mathematically optimal setlists given constraints and player preferences.

Playthroughs are tracked sessions where one or more players work through a setlist together. Each player can submit ratings for songs as they play, and screenshots of result screens can be uploaded for automatic stat extraction. The playthrough system uses WebSockets to keep all participants synchronized.

## Data Sources

The song database was built from a combination of the [Rock Band 4 Spreadsheet](https://docs.google.com/spreadsheets/d/1gQaNlXOMxGxTt1LRs1y8pQpc3PwNvgeM9DCRqfjqAZw/edit?pli=1&gid=0#gid=0) maintained by the community and [rb4.app](https://rb4.app/).

## Component Development with Storybook

Storybook is available for developing and testing UI components in isolation. This is particularly useful for iterating on component design without running the full application.

```bash
# Start Storybook dev server
pnpm --filter @bearded-nemesis/frontend story:dev  # Opens at http://localhost:6006

# Build static Storybook site
pnpm --filter @bearded-nemesis/frontend story:build
```

Stories are colocated with components using the `.stories.ts` naming convention (e.g., `DifficultyBadge.stories.ts`). Storybook automatically picks up all Tailwind styles and SvelteKit aliases.

## Development

For detailed development commands, testing patterns, and environment configuration, see [CLAUDE.md](CLAUDE.md). That file serves as both AI assistant guidance and a comprehensive development reference.
