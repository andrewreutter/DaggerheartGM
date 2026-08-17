/** Pixels per foot for stored map draw bitmaps (keeps payload bounded). */
export const MAP_DRAW_PX_PER_FT = 4;
/** Ephemeral scribble strokes fade to fully transparent over this duration (ms). */
export const SCRIBBLE_FADE_MS = 10_000;

/**
 * Stable key for when to reset the scribble overlay buffer — must not change on unrelated
 * `mapConfig` object churn from SSE (only dimensions + image identity).
 */
export function scribbleCanvasLayoutKey(mapWidthFt, mapHeightFt, mapImageUrl) {
  return `${Number(mapWidthFt)}|${Number(mapHeightFt)}|${String(mapImageUrl ?? '')}`;
}
/** Default brush radius ≈ three 5′ tokens in a row (15′ diameter → 7.5′ radius). */
export const DEFAULT_MAP_DRAW_BRUSH_RADIUS_FT = 7.5;
export const MAP_DRAW_BRUSH_RADIUS_FT_MIN = 1;
/** Legacy static cap; UI uses min 1′ and max 20% of map height. */
export const MAP_DRAW_BRUSH_RADIUS_FT_MAX = 45;
const MAP_DRAW_MAX_DIM_PX = 1024;
const MAP_FT_MIN = 1;

/**
 * @param {string} hex — `#rrggbb`
 * @param {number} alpha — 0..1
 */
export function hexToRgba(hex, alpha) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Alpha channel from `rgba(...)` string (opacity slider value baked into `brushRgba`).
 * @param {string} rgbaStr
 * @returns {number} 0..1
 */
export function alphaFromRgbaString(rgbaStr) {
  const m = String(rgbaStr)
    .trim()
    .match(/^rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/i);
  if (!m) return 1;
  return Math.min(1, Math.max(0, parseFloat(m[1])));
}

/** destination-out source for eraser strokes/fills — full removal (opacity slider ignored). */
export const ERASER_DESTINATION_OUT = 'rgba(0,0,0,1)';

/**
 * @param {string} [_brushRgba] — ignored; eraser always uses full destination-out
 * @returns {string} same as {@link ERASER_DESTINATION_OUT}
 */
export function eraseSourceRgba(_brushRgba) {
  return ERASER_DESTINATION_OUT;
}

/**
 * RGB triple from `rgba(r,g,b,a)` for use with `ctx.globalAlpha`.
 * @param {string} rgbaStr
 */
export function rgbStringFromRgba(rgbaStr) {
  const m = String(rgbaStr).match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return m ? `rgb(${m[1]},${m[2]},${m[3]})` : 'rgb(0,0,0)';
}

/**
 * Multiply the alpha channel of an `rgba(...)` string (for time-based fade).
 * @param {string} rgbaStr
 * @param {number} factor — 0..1
 */
export function multiplyRgbaAlpha(rgbaStr, factor) {
  const m = String(rgbaStr)
    .trim()
    .match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (!m) return rgbaStr;
  const f = Math.min(1, Math.max(0, Number(factor) || 0));
  const a = Math.min(1, Math.max(0, parseFloat(m[4]) * f));
  return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
}

/**
 * True when two draw-canvas pixel points are far enough apart to send as a scribble segment.
 * Zero-length segments render as round dots (undesirable when throttling network sends).
 * @param {{ x: number, y: number }} fromPx
 * @param {{ x: number, y: number }} toPx
 * @param {number} [minDistPx]
 */
export function isNonDegenerateScribbleSegmentPx(fromPx, toPx, minDistPx = 0.5) {
  if (!fromPx || !toPx) return false;
  const dx = toPx.x - fromPx.x;
  const dy = toPx.y - fromPx.y;
  const m = minDistPx * minDistPx;
  return dx * dx + dy * dy >= m;
}

/**
 * Filled circle — matches brush pointer-down dab (same composite as {@link strokeDrawSegment}).
 * @param {CanvasRenderingContext2D} ctx
 */
export function fillBrushDot(ctx, x, y, radiusPx, brushRgba) {
  const r = Math.max(1, radiusPx);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alphaFromRgbaString(brushRgba);
  ctx.fillStyle = rgbStringFromRgba(brushRgba);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * @param {number} mapWidthFt
 * @param {number} mapHeightFt
 * @returns {{ w: number, h: number }}
 */
export function computeMapDrawCanvasSize(mapWidthFt, mapHeightFt) {
  const mw = Math.max(MAP_FT_MIN, mapWidthFt);
  const mh = Math.max(MAP_FT_MIN, mapHeightFt);
  const rawW = Math.max(1, Math.round(mw * MAP_DRAW_PX_PER_FT));
  const rawH = Math.max(1, Math.round(mh * MAP_DRAW_PX_PER_FT));
  const scale = Math.min(1, MAP_DRAW_MAX_DIM_PX / Math.max(rawW, rawH));
  return {
    w: Math.max(1, Math.round(rawW * scale)),
    h: Math.max(1, Math.round(rawH * scale)),
  };
}

/**
 * @param {number} xFt
 * @param {number} yFt
 * @param {number} mapWidthFt
 * @param {number} mapHeightFt
 * @param {{ w: number, h: number }} drawSize
 */
export function ftToDrawPixel(xFt, yFt, mapWidthFt, mapHeightFt, drawSize) {
  const x = (xFt / mapWidthFt) * drawSize.w;
  const y = (yFt / mapHeightFt) * drawSize.h;
  return { x, y };
}

/**
 * @param {number} xPx
 * @param {number} yPx
 * @param {number} mapWidthFt
 * @param {number} mapHeightFt
 * @param {{ w: number, h: number }} drawSize
 */
export function drawPixelToFt(xPx, yPx, mapWidthFt, mapHeightFt, drawSize) {
  return {
    x: (xPx / drawSize.w) * mapWidthFt,
    y: (yPx / drawSize.h) * mapHeightFt,
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} radiusPx
 * @param {'brush' | 'eraser'} mode
 * @param {string} brushRgba — paint color + opacity (via `globalAlpha` for brush so strokes match slider)
 */
export function strokeDrawSegment(ctx, x0, y0, x1, y1, radiusPx, mode, brushRgba) {
  const r = Math.max(1, radiusPx);
  ctx.save();
  if (mode === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = ERASER_DESTINATION_OUT;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alphaFromRgbaString(brushRgba);
    ctx.strokeStyle = rgbStringFromRgba(brushRgba);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineWidth = r * 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {'brush' | 'eraser'} mode
 * @param {string} brushRgba
 */
export function fillDrawRect(ctx, x0, y0, x1, y1, mode, brushRgba) {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  ctx.save();
  if (mode === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = ERASER_DESTINATION_OUT;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alphaFromRgbaString(brushRgba);
    ctx.fillStyle = rgbStringFromRgba(brushRgba);
  }
  ctx.fillRect(l, t, Math.max(r - l, 0.5), Math.max(b - t, 0.5));
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} lineWidthPx
 * @param {string} brushRgba
 */
export function strokeOutlineRect(ctx, x0, y0, x1, y1, lineWidthPx, brushRgba) {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  const ww = Math.max(r - l, 0.5);
  const hh = Math.max(b - t, 0.5);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alphaFromRgbaString(brushRgba);
  ctx.strokeStyle = rgbStringFromRgba(brushRgba);
  ctx.lineWidth = lineWidthPx;
  ctx.strokeRect(l, t, ww, hh);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {'brush' | 'eraser'} mode
 * @param {string} brushRgba
 */
export function fillDrawEllipse(ctx, x0, y0, x1, y1, mode, brushRgba) {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const bt = Math.max(y0, y1);
  const cx = (l + r) / 2;
  const cy = (t + bt) / 2;
  const rx = Math.max((r - l) / 2, 0.5);
  const ry = Math.max((bt - t) / 2, 0.5);
  ctx.save();
  if (mode === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = ERASER_DESTINATION_OUT;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alphaFromRgbaString(brushRgba);
    ctx.fillStyle = rgbStringFromRgba(brushRgba);
  }
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} lineWidthPx
 * @param {string} brushRgba
 */
export function strokeOutlineEllipse(ctx, x0, y0, x1, y1, lineWidthPx, brushRgba) {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const bt = Math.max(y0, y1);
  const cx = (l + r) / 2;
  const cy = (t + bt) / 2;
  const rx = Math.max((r - l) / 2, 0.5);
  const ry = Math.max((bt - t) / 2, 0.5);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alphaFromRgbaString(brushRgba);
  ctx.strokeStyle = rgbStringFromRgba(brushRgba);
  ctx.lineWidth = lineWidthPx;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Remove one connected component of non-transparent pixels (4-neighbor), e.g. eraser click.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} sx — pixel X
 * @param {number} sy — pixel Y
 * @param {number} [alphaThreshold=8] — 0–255
 * @returns {boolean} true if any pixel was cleared
 */
export function floodEraseConnectedComponent(ctx, width, height, sx, sy, alphaThreshold = 8) {
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const idx = (x, y) => y * width + x;
  const start = idx(ix, iy) * 4;
  if (d[start + 3] < alphaThreshold) return false;

  const visited = new Uint8Array(width * height);
  const stack = [[ix, iy]];
  let cleared = 0;

  while (stack.length) {
    const [x, y] = stack.pop();
    const i = idx(x, y);
    if (visited[i]) continue;
    const p = i * 4;
    if (d[p + 3] < alphaThreshold) {
      visited[i] = 1;
      continue;
    }
    visited[i] = 1;
    d[p] = 0;
    d[p + 1] = 0;
    d[p + 2] = 0;
    d[p + 3] = 0;
    cleared++;

    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = idx(nx, ny);
      if (!visited[ni]) stack.push([nx, ny]);
    }
  }

  ctx.putImageData(img, 0, 0);
  return true;
}

/**
 * Skip reloading the paint canvas from `overlayPng` when the live pixels are
 * already the committed overlay (local commit, or a later hosted-URL swap).
 * Always reload when the bitmap size changed or the draw layer identity changed
 * (`sourceUrl === lastLoadedUrl` covers same-layer no-ops).
 *
 * @param {{
 *   strokeActive?: boolean,
 *   sizeChanged?: boolean,
 *   canvasAuthoritative?: boolean,
 *   sourceUrl?: string | null,
 *   lastLoadedUrl?: string | null,
 * }} opts
 * @returns {boolean}
 */
export function shouldSkipDrawOverlayReload(opts = {}) {
  if (opts.strokeActive) return true;
  if (opts.sizeChanged) return false;
  const source = opts.sourceUrl ?? null;
  const last = opts.lastLoadedUrl ?? null;
  if (source === last) return true;
  return !!opts.canvasAuthoritative;
}

/**
 * @param {string | null | undefined} dataUrl
 * @param {HTMLCanvasElement} canvas
 * @param {{ w: number, h: number }} size
 * @returns {Promise<void>}
 */
export function loadDrawDataUrlOntoCanvas(dataUrl, canvas, size) {
  const sizeChanged = canvas.width !== size.w || canvas.height !== size.h;
  if (sizeChanged) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve();
  if (!dataUrl || typeof dataUrl !== 'string') {
    ctx.clearRect(0, 0, size.w, size.h);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        ctx.clearRect(0, 0, size.w, size.h);
        ctx.drawImage(img, 0, 0, size.w, size.h);
      } catch {
        /* ignore */
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ w: number, h: number }} size
 */
export function clearDrawCanvas(canvas, size) {
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, size.w, size.h);
}
