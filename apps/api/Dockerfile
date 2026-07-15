FROM node:20-alpine AS base
RUN npm install -g pnpm@9.1.0

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/whatsapp/package.json ./packages/whatsapp/
COPY packages/flow-engine/package.json ./packages/flow-engine/
COPY packages/integrations/package.json ./packages/integrations/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client (must happen before tsc)
RUN pnpm --filter @socialcart/api prisma generate

# Build all workspace packages first, then the API
RUN pnpm --filter @socialcart/shared build
RUN pnpm --filter @socialcart/whatsapp build
RUN pnpm --filter @socialcart/flow-engine build
RUN pnpm --filter @socialcart/integrations build
RUN pnpm --filter @socialcart/api build

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9.1.0
WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed to run
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/whatsapp/package.json ./packages/whatsapp/
COPY packages/flow-engine/package.json ./packages/flow-engine/
COPY packages/integrations/package.json ./packages/integrations/
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/whatsapp/dist ./packages/whatsapp/dist
COPY --from=builder /app/packages/flow-engine/dist ./packages/flow-engine/dist
COPY --from=builder /app/packages/integrations/dist ./packages/integrations/dist

# Copy Prisma schema + generated client
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client ./node_modules/.pnpm/@prisma+client@5.22.0/node_modules/@prisma/client 2>/dev/null || true
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3001

# Run migrations then start
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]
