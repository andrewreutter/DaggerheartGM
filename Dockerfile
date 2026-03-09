# DaggerheartGM — Node.js runtime
#
# Two-stage build:
#   1. builder  — installs all npm deps and builds CSS/JS
#   2. runtime  — slim image with production deps

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Copy production node_modules and built assets from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

# Copy application source
COPY . .

EXPOSE 3456

# .env is not included in the image; set env vars at deploy time.
CMD ["node", "server.js"]
