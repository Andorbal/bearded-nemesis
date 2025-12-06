# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all relevant packages
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

# Build shared package first, then frontend
RUN pnpm --filter @bearded-nemesis/shared build
RUN pnpm --filter @bearded-nemesis/frontend build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Copy the built SvelteKit app (adapter-node output)
# Note: adapter-node produces a self-contained bundle with no runtime dependencies
COPY --from=builder /app/apps/frontend/build ./build

ENV NODE_ENV=production
ENV PORT=3000
ENV ORIGIN=http://localhost:3000
EXPOSE 3000

CMD ["node", "build"]
