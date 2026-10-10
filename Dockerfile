# ==============================================================================
# Multi-Stage Dockerfile for MCP Server (product-intelligence-mcp)
# TypeScript + Express + Prisma + Model Context Protocol
# ==============================================================================

# Stage 1: Build TypeScript source code & Prisma Client
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy dependency manifests and Prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build config
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript to dist/
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Create unprivileged system user
RUN addgroup --system --gid 1001 mcpuser && \
    adduser --system --uid 1001 mcpuser

# Install production-only dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Fix ownership
RUN chown -R mcpuser:mcpuser /app

USER mcpuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]

