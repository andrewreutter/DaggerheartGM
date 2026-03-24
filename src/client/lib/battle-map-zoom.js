/**
 * Display-only zoom for BattleMap: math for clamping zoom and preserving the
 * point under the cursor when zoom changes. Does not affect feet / game distance.
 */

/**
 * Clamp scroll so content stays in range for current zoom and viewport.
 */
export function clampPanScroll(scrollLeft, scrollTop, { mapZoom, renderedWidthPx, renderedHeightPx, viewportW, viewportH }) {
  if (mapZoom <= 0 || renderedWidthPx <= 0 || renderedHeightPx <= 0) {
    return { scrollLeft: 0, scrollTop: 0 };
  }
  const contentW = renderedWidthPx * mapZoom;
  const contentH = renderedHeightPx * mapZoom;
  const maxLeft = Math.max(0, contentW - viewportW);
  const maxTop = Math.max(0, contentH - viewportH);
  return {
    scrollLeft: Math.max(0, Math.min(maxLeft, scrollLeft)),
    scrollTop: Math.max(0, Math.min(maxTop, scrollTop)),
  };
}

/**
 * @param {object} p
 * @param {number} p.containerW
 * @param {number} p.containerH
 * @param {number} p.renderedWidthPx — inner map width (game px)
 * @param {number} p.renderedHeightPx
 * @param {number} p.tokenSizePx — 5' token side in inner px
 * @returns {{ minZoom: number, maxZoom: number }}
 */
export function computeMapZoomBounds({
  containerW,
  containerH,
  renderedWidthPx,
  renderedHeightPx,
  tokenSizePx,
}) {
  if (
    containerW <= 0 ||
    containerH <= 0 ||
    renderedWidthPx <= 0 ||
    renderedHeightPx <= 0 ||
    tokenSizePx <= 0
  ) {
    return { minZoom: 1, maxZoom: 1 };
  }
  const fitMap = Math.min(containerW / renderedWidthPx, containerH / renderedHeightPx);
  const fitToken = Math.min(containerW, containerH) / tokenSizePx;
  let minZoom = fitMap;
  let maxZoom = fitToken;
  if (minZoom > maxZoom) {
    const mid = Math.sqrt(minZoom * maxZoom);
    minZoom = maxZoom = mid;
  }
  return { minZoom, maxZoom };
}

/**
 * @param {number} zoom
 * @param {number} minZoom
 * @param {number} maxZoom
 */
export function clampMapZoom(zoom, minZoom, maxZoom) {
  if (!Number.isFinite(zoom)) return minZoom;
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/**
 * After changing zoom, adjust scroll so the same inner-map point stays under the cursor.
 *
 * @param {object} p
 * @param {number} p.scrollLeft — outer scroll coords
 * @param {number} p.scrollTop
 * @param {number} p.viewportX — cursor x relative to scroll container client rect (0..clientWidth)
 * @param {number} p.viewportY
 * @param {number} p.oldZoom
 * @param {number} p.newZoom
 * @param {number} p.innerWidthPx — unscaled map width
 * @param {number} p.innerHeightPx
 * @param {number} p.viewportW — scroll container clientWidth
 * @param {number} p.viewportH — scroll container clientHeight
 * @returns {{ scrollLeft: number, scrollTop: number }}
 */
export function scrollAfterZoomTowardPoint({
  scrollLeft,
  scrollTop,
  viewportX,
  viewportY,
  oldZoom,
  newZoom,
  innerWidthPx,
  innerHeightPx,
  viewportW,
  viewportH,
}) {
  if (oldZoom <= 0 || newZoom <= 0) return { scrollLeft, scrollTop };
  const ox = scrollLeft + viewportX;
  const oy = scrollTop + viewportY;
  const ix = ox / oldZoom;
  const iy = oy / oldZoom;
  let nextLeft = ix * newZoom - viewportX;
  let nextTop = iy * newZoom - viewportY;
  const contentW = innerWidthPx * newZoom;
  const contentH = innerHeightPx * newZoom;
  const maxLeft = Math.max(0, contentW - viewportW);
  const maxTop = Math.max(0, contentH - viewportH);
  nextLeft = Math.max(0, Math.min(maxLeft, nextLeft));
  nextTop = Math.max(0, Math.min(maxTop, nextTop));
  return { scrollLeft: nextLeft, scrollTop: nextTop };
}
