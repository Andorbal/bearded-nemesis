# API

The API is a Fastify server written in TypeScript that serves as the backend for Bearded Nemesis. It handles authentication, manages the PostgreSQL database, and provides REST endpoints for all application data. Real-time playthrough synchronization is handled via WebSocket connections.

## Running the API

Make sure PostgreSQL is running via Docker and the shared package is built:

```bash
docker-compose up -d postgres
pnpm --filter @bearded-nemesis/shared build
```

Copy the environment file and adjust as needed:

```bash
cp .env.example .env.local
```

Run database migrations and optionally seed sample data:

```bash
pnpm db:migrate
pnpm db:seed
```

Start the development server:

```bash
pnpm dev
```

The API runs on port 3010 by default. The development server uses tsx for TypeScript execution with hot reloading.

## Environment Variables

The `.env.example` file documents all available settings:

**DATABASE_URL** is the PostgreSQL connection string. Docker exposes PostgreSQL on port 5434 to avoid conflicts with local installations.

**JWT_SECRET** must be at least 32 characters for signing authentication tokens.

**JWT_ACCESS_EXPIRY** and **JWT_REFRESH_EXPIRY** control token lifetimes. Access tokens default to 15 minutes, refresh tokens to 7 days.

**SOLVER_URL** points to the Python solver service for setlist optimization and OCR.

**SCREENSHOT_PATH** is the directory where uploaded screenshots are stored.

## Code Organization

The source code follows a layered architecture:

**routes/** contains HTTP endpoint handlers organized by resource. Each route file registers its endpoints with Fastify and handles request validation, calling into services or repositories as needed.

**repositories/** handles all database operations. Each repository is responsible for a single entity type and contains the SQL queries for CRUD operations. Tests are colocated with their implementations.

**services/** contains business logic that spans multiple repositories or involves external services. This includes setlist building logic, WebSocket management for playthroughs, and communication with the solver service.

**middleware/** provides authentication and authorization. The auth middleware verifies JWT tokens and attaches user information to requests. Admin routes have an additional middleware check.

**db/** contains the migration runner and seed scripts. Migrations are sequential SQL files that run in order.

## API Routes

**Auth** (`/auth`) handles login, registration, token refresh, and logout.

**Songs** (`/songs`) provides endpoints for listing songs with filtering and pagination, retrieving song details, and managing user song ownership and ratings.

**Setlists** (`/setlists`) supports creating, updating, and deleting setlists of all three types (manual, smart, builder). Builder setlists communicate with the solver service for optimization.

**Playthroughs** (`/playthroughs`) manages playthrough sessions including starting, advancing, going back, capturing stats, and finishing. Screenshot uploads are handled here and forwarded to the solver for OCR.

**Admin** (`/admin`) provides admin-only endpoints for user management and system operations.

## WebSocket Support

The playthrough system uses WebSockets for real-time synchronization. When players join a playthrough, they connect via WebSocket and receive state updates as the session progresses. Events include song advancement, player joins/leaves, rating submissions, and OCR completion notifications.

The WebSocket implementation uses `@fastify/websocket` and maintains connection state in memory. Messages are typed using shared types from `@bearded-nemesis/shared` to ensure consistency between server and client.

## Database

The API uses PostgreSQL directly via the `pg` package without an ORM. This provides full control over queries and makes the SQL explicit and auditable.

Migrations live in `db/migrations/` as numbered SQL files. The migration runner tracks which migrations have been applied in a `migrations` table. To create a new migration, add a new SQL file with the next sequence number.

The seed script in `db/seed.ts` populates the database with sample data for development.

## Testing

Tests use Vitest and are colocated with their source files:

```bash
pnpm test           # Run all tests once
pnpm test:watch     # Watch mode for development
```

Repository tests verify database operations against a real PostgreSQL instance. Integration tests for WebSocket functionality test the full connection lifecycle.

## Building for Production

```bash
pnpm build
pnpm start
```

The build compiles TypeScript to JavaScript in the `dist/` directory. The production server runs the compiled code with Node.js.
