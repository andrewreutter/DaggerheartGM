# DaggerheartGM — Node.js + Python (EasyOCR) runtime
#
# Two-stage build:
#   1. builder  — installs all npm deps and builds CSS/JS
#   2. runtime  — slim image with production deps, Python + EasyOCR pre-loaded
#
# EasyOCR English model (~100MB) is downloaded at build time so the container
# starts immediately with no network dependency at runtime.

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# System libs required by EasyOCR / OpenCV / Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install EasyOCR with CPU-only PyTorch to keep image size manageable.
# --extra-index-url provides the CPU-only torch wheel.
RUN pip3 install --break-system-packages --no-cache-dir \
      easyocr \
      torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Pre-download the English recognition model so it's baked into the image
# and the first OCR request doesn't stall waiting for a download.
RUN python3 -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)"

WORKDIR /app

# Copy production node_modules and built assets from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

# Copy application source
COPY . .

EXPOSE 3456

# .env is not included in the image; set env vars at deploy time.
CMD ["node", "server.js"]
