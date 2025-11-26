# syntax=docker/dockerfile:1

FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN bun install --frozen-lockfile

# Build types package
FROM deps AS build-types
COPY packages/types ./packages/types
RUN cd packages/types && bun run build

# Build API
FROM deps AS build
COPY --from=build-types /app/packages/types/dist ./packages/types/dist
COPY apps/api ./apps/api
RUN cd apps/api && bun run build

# Production image
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bun
USER bun

COPY --from=build --chown=bun:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=bun:nodejs /app/node_modules ./node_modules

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
