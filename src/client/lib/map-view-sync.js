/**
 * Portable battle map view state for GM → players: zoom/pan normalized per viewport
 * because min/max zoom and rendered px depend on each client's container size.
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
 * @returns {{ mapViewZoomRatio: number, mapViewPanNorm: { x: number, y: number } }}
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
  const x = maxL > 0 ? scrollLeft / maxL : 0;
  const y = maxT > 0 ? scrollTop / maxT : 0;
  const mapViewPanNorm = {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };

  return { mapViewZoomRatio, mapViewPanNorm };
}

/**
 * @param {object} stored — from `table_state.mapConfig`
 * @param {number|null|undefined} stored.mapViewZoomRatio — 0..1; null/undefined = no stored zoom
 * @param {{x?: number, y?: number}|null|undefined} stored.mapViewPanNorm
 * @param {object} ctx
 * @param {number} ctx.minZoom
 * @param {number} ctx.maxZoom
 * @param {number} ctx.renderedWidthPx
 * @param {number} ctx.renderedHeightPx
 * @param {number} ctx.viewportW
 * @param {number} ctx.viewportH
 * @returns {{ mapZoom: number, scrollLeft: number, scrollTop: number } | null} null when nothing to apply
 */
export function decodeMapViewState(stored, ctx) {
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
  return { mapZoom, scrollLeft: c.scrollLeft, scrollTop: c.scrollTop };
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
