# Frontend

The frontend is a SvelteKit 5 application that provides the user interface for Bearded Nemesis. It uses Tailwind CSS for styling and connects to the API via REST and WebSocket for real-time features.

## Running the Frontend

Make sure the shared package is built first:

```bash
pnpm --filter @bearded-nemesis/shared build
```

Start the development server:

```bash
pnpm dev
```

The frontend runs on port 5173 by default with hot module reloading enabled.

## Features

The application provides several main views:

**Song Library** displays all songs in the database with filtering by title, artist, difficulty, and ownership status. Users can mark songs as owned and rate them.

**Setlists** allows users to create and manage setlists of three types. Manual setlists are hand-picked song lists. Smart setlists use filters to dynamically generate songs. Builder setlists use the solver service to create optimized setlists based on player preferences and constraints.

**Playthroughs** provides the interface for running through a setlist in real-time. Players connect via WebSocket, and the view updates live as songs advance and ratings are submitted. Screenshot upload for OCR stat extraction is handled here.

**Authentication** includes login and registration pages with JWT token management.

## Technology Stack

**SvelteKit 5** provides the application framework with file-based routing, server-side rendering capabilities, and the Svelte 5 reactivity system with runes.

**Tailwind CSS** handles styling through utility classes. The configuration is in `tailwind.config.js`.

**Vite** serves as the build tool and development server, providing fast hot module replacement.

**TypeScript** is used throughout with strict type checking enabled.

## Project Structure

Routes follow SvelteKit's file-based routing convention in `src/routes/`. Protected routes that require authentication are organized under a route group.

Components live alongside their routes or in `src/lib/components/` for shared UI elements.

API communication is handled through fetch calls to the backend. The frontend expects the API to be available at `http://localhost:3001` during development.

WebSocket connections for playthroughs are established when entering a playthrough view and managed for the duration of the session.

## Development Commands

```bash
pnpm dev           # Start development server
pnpm build         # Build for production
pnpm preview       # Preview production build
pnpm check         # Type check with svelte-check
pnpm check:watch   # Type check in watch mode
pnpm lint          # Run ESLint and Prettier checks
pnpm format        # Format code with Prettier
```

## Building for Production

```bash
pnpm build
```

The build output goes to `.svelte-kit/output/` and uses the Node adapter for server-side rendering. The built application can be started with `node build/index.js`.
