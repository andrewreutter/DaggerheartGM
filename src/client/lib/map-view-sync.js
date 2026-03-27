/**
 * Portable battle map view state for GM → players.
 *
 * Legacy: `mapViewZoomRatio` / `mapViewPanNorm` (viewport-dependent — poor cross-screen match).
 * Preferred: `mapViewVisibleNorm` — normalized inner-map rectangle { x, y, w, h } in 0..1 of
 * rendered map px; decode fits the entire rect in the viewport (uniform scale) and clips to it.
 */

import { clampMapZoom, clampPanScroll } from './battle-map-zoom.js';

/**
 * @param {object} p
 * @param {number} p.mapZoom
 * @param {number} p.scrollLeft
 * @param {number} p.scrollTop
 * @param {number} p.minZoom
 * @param {number} p.maxZoom
 * @param {number} p.renderedWidthPx
 * @param {number} p.renderedHeightPx
 * @param {number} p.viewportW
 * @param {number} p.viewportH
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function encodeMapViewVisibleNorm({
  mapZoom,
  scrollLeft,
  scrollTop,
  renderedWidthPx,
  renderedHeightPx,
  viewportW,
  viewportH,
}) {
  const z = mapZoom > 0 ? mapZoom : 1;
  const innerLeft = scrollLeft / z;
  const innerTop = scrollTop / z;
  const innerW = viewportW / z;
  const innerH = viewportH / z;
  const rw = renderedWidthPx > 0 ? renderedWidthPx : 1;
  const rh = renderedHeightPx > 0 ? renderedHeightPx : 1;
  const x = innerLeft / rw;
  const y = innerTop / rh;
  const w = innerW / rw;
  const h = innerH / rh;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    w: Math.max(0, Math.min(1, w)),
    h: Math.max(0, Math.min(1, h)),
  };
}

/**
 * @param {object} p
 * @param {number} p.mapZoom
 * @param {number} p.scrollLeft
 * @param {number} p.scrollTop
 * @param {number} p.minZoom
 * @param {number} p.maxZoom
 * @param {number} p.renderedWidthPx
 * @param {number} p.renderedHeightPx
 * @param {number} p.viewportW
 * @param {number} p.viewportH
 * @returns {{ mapViewZoomRatio: number, mapViewPanNorm: { x: number, y: number }, mapViewVisibleNorm: { x: number, y: number, w: number, h: number } }}
 */
export function encodeMapViewState({
  mapZoom,
  scrollLeft,
  scrollTop,
  minZoom,
  maxZoom,
  renderedWidthPx,
  renderedHeightPx,
  viewportW,
  viewportH,
}) {
  const z = clampMapZoom(mapZoom, minZoom, maxZoom);
  let mapViewZoomRatio = 0.5;
  if (maxZoom > minZoom && Number.isFinite(minZoom) && Number.isFinite(maxZoom)) {
    mapViewZoomRatio = (z - minZoom) / (maxZoom - minZoom);
    mapViewZoomRatio = Math.max(0, Math.min(1, mapViewZoomRatio));
  } else {
    mapViewZoomRatio = 0;
  }

  const contentW = renderedWidthPx * z;
  const contentH = renderedHeightPx * z;
  const maxL = Math.max(0, contentW - viewportW);
  const maxT = Math.max(0, contentH - viewportH);
  const panX = maxL > 0 ? scrollLeft / maxL : 0;
  const panY = maxT > 0 ? scrollTop / maxT : 0;
  const mapViewPanNorm = {
    x: Math.max(0, Math.min(1, panX)),
    y: Math.max(0, Math.min(1, panY)),
  };

  const mapViewVisibleNorm = encodeMapViewVisibleNorm({
    mapZoom: z,
    scrollLeft,
    scrollTop,
    renderedWidthPx,
    renderedHeightPx,
    viewportW,
    viewportH,
  });

  return { mapViewZoomRatio, mapViewPanNorm, mapViewVisibleNorm };
}

/**
 * @param {object|null|undefined} vn — `mapViewVisibleNorm`
 * @returns {boolean}
 */
export function isValidMapViewVisibleNorm(vn) {
  if (!vn || typeof vn !== 'object') return false;
  const { x, y, w, h } = vn;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w > 0 &&
    h > 0
  );
}

/**
 * Fit the entire stored inner-map rectangle in the viewport (uniform scale), center it, clamp zoom.
 * Optionally returns CSS clip insets so only that rectangle is visible (letterbox / clamp edge cases).
 *
 * @param {object} stored
 * @param {{ x: number, y: number, w: number, h: number }} stored.mapViewVisibleNorm
 * @param {object} ctx
 * @param {number} ctx.minZoom
 * @param {number} ctx.maxZoom
 * @param {number} ctx.renderedWidthPx
 * @param {number} ctx.renderedHeightPx
 * @param {number} ctx.viewportW
 * @param {number} ctx.viewportH
 * @returns {{ mapZoom: number, scrollLeft: number, scrollTop: number, letterboxClipPx: { top: number, right: number, bottom: number, left: number } | null } | null}
 */
export function decodeMapViewFromVisibleNorm(stored, ctx) {
  const vn = stored?.mapViewVisibleNorm;
  if (!isValidMapViewVisibleNorm(vn)) return null;

  const { minZoom, maxZoom, renderedWidthPx, renderedHeightPx, viewportW, viewportH } = ctx;
  const rw = renderedWidthPx > 0 ? renderedWidthPx : 1;
  const rh = renderedHeightPx > 0 ? renderedHeightPx : 1;

  const left = vn.x * rw;
  const top = vn.y * rh;
  const w = vn.w * rw;
  const h = vn.h * rh;

  if (w <= 0 || h <= 0 || viewportW <= 0 || viewportH <= 0) return null;

  /** Zoom so scaled rect fits inside viewport (object-fit: contain for the rect). */
  const zUncapped = Math.min(viewportW / w, viewportH / h);
  let mapZoom = clampMapZoom(zUncapped, minZoom, maxZoom);

  let scrollLeft = (left + w / 2) * mapZoom - viewportW / 2;
  let scrollTop = (top + h / 2) * mapZoom - viewportH / 2;

  const c = clampPanScroll(scrollLeft, scrollTop, {
    mapZoom,
    renderedWidthPx,
    renderedHeightPx,
    viewportW,
    viewportH,
  });
  scrollLeft = c.scrollLeft;
  scrollTop = c.scrollTop;

  /** Clip viewport to the shared rect in screen space (hides map outside R when aspect/zoom mismatch). */
  const scaledW = w * mapZoom;
  const scaledH = h * mapZoom;
  const rLeft = left * mapZoom - scrollLeft;
  const rTop = top * mapZoom - scrollTop;
  /** Clip to the shared rect in viewport px (letterbox + hide map outside R when zoom is clamped). */
  const insetTop = Math.max(0, rTop);
  const insetLeft = Math.max(0, rLeft);
  const insetRight = Math.max(0, viewportW - rLeft - scaledW);
  const insetBottom = Math.max(0, viewportH - rTop - scaledH);

  const letterboxClipPx = { top: insetTop, right: insetRight, bottom: insetBottom, left: insetLeft };

  return { mapZoom, scrollLeft, scrollTop, letterboxClipPx };
}

/**
 * @param {object} stored — from `table_state.mapConfig`
 * @param {number|null|undefined} stored.mapViewZoomRatio — 0..1; null/undefined = no stored zoom
 * @param {{x?: number, y?: number}|null|undefined} stored.mapViewPanNorm
 * @param {{x?: number, y?: number, w?: number, h?: number}|null|undefined} stored.mapViewVisibleNorm
 * @param {object} ctx
 * @param {number} ctx.minZoom
 * @param {number} ctx.maxZoom
 * @param {number} ctx.renderedWidthPx
 * @param {number} ctx.renderedHeightPx
 * @param {number} ctx.viewportW
 * @param {number} ctx.viewportH
 * @returns {{ mapZoom: number, scrollLeft: number, scrollTop: number, letterboxClipPx?: { top: number, right: number, bottom: number, left: number } | null } | null} null when nothing to apply
 */
export function decodeMapViewState(stored, ctx) {
  if (isValidMapViewVisibleNorm(stored?.mapViewVisibleNorm)) {
    return decodeMapViewFromVisibleNorm(stored, ctx);
  }

  const { minZoom, maxZoom, renderedWidthPx, renderedHeightPx, viewportW, viewportH } = ctx;
  const ratio = stored?.mapViewZoomRatio;
  const pan = stored?.mapViewPanNorm;

  const hasRatio = ratio != null && Number.isFinite(ratio);
  const hasPan = pan != null && typeof pan === 'object'
    && Number.isFinite(pan.x) && Number.isFinite(pan.y);

  if (!hasRatio && !hasPan) return null;

  let mapZoom = minZoom;
  if (hasRatio) {
    const r = Math.max(0, Math.min(1, ratio));
    if (maxZoom > minZoom) {
      mapZoom = minZoom + r * (maxZoom - minZoom);
    } else {
      mapZoom = minZoom;
    }
    mapZoom = clampMapZoom(mapZoom, minZoom, maxZoom);
  } else {
    mapZoom = clampMapZoom(minZoom, minZoom, maxZoom);
  }

  const contentW = renderedWidthPx * mapZoom;
  const contentH = renderedHeightPx * mapZoom;
  const maxL = Math.max(0, contentW - viewportW);
  const maxT = Math.max(0, contentH - viewportH);

  let scrollLeft = 0;
  let scrollTop = 0;
  if (hasPan) {
    scrollLeft = Math.max(0, Math.min(1, pan.x)) * maxL;
    scrollTop = Math.max(0, Math.min(1, pan.y)) * maxT;
  }

  const c = clampPanScroll(scrollLeft, scrollTop, {
    mapZoom,
    renderedWidthPx,
    renderedHeightPx,
    viewportW,
    viewportH,
  });
  return { mapZoom, scrollLeft: c.scrollLeft, scrollTop: c.scrollTop, letterboxClipPx: null };
}

/**
 * Only the table owner (GM) may persist normalized map view (`set-map-view`).
 * Players receive updates via `table_state` and may pan/zoom locally without persisting (see `BattleMap.jsx`).
 */
export function shouldPersistMapViewToTable({ userUid, tableOwnerUid, effectiveIsPlayer }) {
  if (effectiveIsPlayer) return false;
  if (userUid == null || tableOwnerUid == null) return false;
  return userUid === tableOwnerUid;
}
