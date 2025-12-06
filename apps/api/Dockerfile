# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all relevant packages
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/src/ ./apps/api/src/
COPY apps/api/tsconfig.json ./apps/api/

# Build shared package first, then API
RUN pnpm --filter @bearded-nemesis/shared build
RUN pnpm --filter @bearded-nemesis/api build

# Production stage
FROM node:20-slim AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist/ ./packages/shared/dist/
COPY --from=builder /app/apps/api/dist/ ./apps/api/dist/

# Copy public assets (cover images)
COPY apps/api/public/ ./apps/api/public/

# Copy migrations for db:migrate at runtime
COPY apps/api/src/db/migrations/ ./apps/api/src/db/migrations/

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
