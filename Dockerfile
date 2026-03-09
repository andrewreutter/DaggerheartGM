# DaggerheartGM — Node.js runtime
#
# Two-stage build:
#   1. builder  — installs all npm deps and builds CSS/JS
#   2. runtime  — slim image with production deps

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# git + ca-certificates needed to clone the daggerheart-srd submodule when
# the build environment (e.g. Railway) doesn't initialize git submodules.
RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# If the submodule wasn't initialized before the Docker build context was sent
# (common in Railway / CI environments), clone it fresh from GitHub.
RUN if [ ! -f "daggerheart-srd/.build/03_json/abilities.json" ]; then \
      rm -rf daggerheart-srd && \
      git clone --depth 1 https://github.com/seansbox/daggerheart-srd.git daggerheart-srd; \
    fi

RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Copy production node_modules and built assets from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

# Copy application source
COPY . .

# Override the (potentially empty) submodule directory with the one that was
# populated during the builder stage (either from the build context or cloned).
COPY --from=builder /app/daggerheart-srd ./daggerheart-srd

EXPOSE 3456

# .env is not included in the image; set env vars at deploy time.
CMD ["node", "server.js"]
