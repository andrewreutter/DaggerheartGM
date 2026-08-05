/**
 * Display-only zoom for BattleMap: math for clamping zoom and preserving the
 * point under the cursor when zoom changes. Does not affect feet / game distance.
 */

/**
 * Convert WheelEvent deltas to pixel space (handles DOM_DELTA_LINE / PAGE).
 * @param {Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>} e
 */
export function normalizeWheelDeltaPixels(e, viewportW, viewportH) {
  let dx = e.deltaX;
  let dy = e.deltaY;
  if (e.deltaMode === 1) {
    dx *= 16;
    dy *= 16;
  } else if (e.deltaMode === 2) {
    dx *= viewportW;
    dy *= viewportH;
  }
  return { dx, dy };
}

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

/**
 * Pan so an inner-map point (px, pre-scale) is centered in the viewport at current zoom.
 */
export function computePanToCenterInnerPointPx({
  innerCenterXPx,
  innerCenterYPx,
  mapZoom,
  renderedWidthPx,
  renderedHeightPx,
  viewportW,
  viewportH,
}) {
  const sx = innerCenterXPx * mapZoom;
  const sy = innerCenterYPx * mapZoom;
  const scrollLeft = sx - viewportW / 2;
  const scrollTop = sy - viewportH / 2;
  return clampPanScroll(scrollLeft, scrollTop, {
    mapZoom,
    renderedWidthPx,
    renderedHeightPx,
    viewportW,
    viewportH,
  });
}

/**
 * Max zoom in (largest z) that still fits an axis-aligned inner bbox (+ padding), then pan to center it.
 * Inner coords are pre-scale map pixels (same space as renderedWidthPx).
 *
 * @param {object} p
 * @param {number} p.minInnerX
 * @param {number} p.minInnerY
 * @param {number} p.maxInnerX
 * @param {number} p.maxInnerY
 * @param {number} [p.paddingPx]
 */
/**
 * Zoom bounds for a plain image viewport (no game tokens): fully zoomed out fits the image in the container;
 * max zoom matches the spirit of {@link computeMapZoomBounds} using a synthetic detail size (~4% of the shorter side).
 */
export function computeImageViewportZoomBounds({
  containerW,
  containerH,
  imageWidthPx,
  imageHeightPx,
}) {
  if (
    containerW <= 0 ||
    containerH <= 0 ||
    imageWidthPx <= 0 ||
    imageHeightPx <= 0
  ) {
    return { minZoom: 1, maxZoom: 1 };
  }
  const fitMap = Math.min(containerW / imageWidthPx, containerH / imageHeightPx);
  const tokenSizePx = Math.max(24, Math.min(imageWidthPx, imageHeightPx) * 0.04);
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
 * Same wheel semantics as BattleMap: ⌘/Ctrl+wheel zoom toward cursor, Shift+wheel horizontal pan, else vertical pan.
 * Returns `null` if nothing changes (caller should not preventDefault). Otherwise `{ scrollLeft, scrollTop, mapZoom }`.
 */
export function applyViewportWheelPanZoom(e, {
  viewportW,
  viewportH,
  viewportX,
  viewportY,
  scrollLeft,
  scrollTop,
  mapZoom,
  minZoom,
  maxZoom,
  renderedWidthPx,
  renderedHeightPx,
}) {
  const { dx, dy } = normalizeWheelDeltaPixels(e, viewportW, viewportH);
  const z = mapZoom;
  const rw = renderedWidthPx;
  const rh = renderedHeightPx;
  const minZ = minZoom;
  const maxZ = maxZoom;

  const maxL = Math.max(0, rw * z - viewportW);
  const maxT = Math.max(0, rh * z - viewportH);

  const zoomChord = e.metaKey || e.ctrlKey;

  if (zoomChord) {
    if (maxZ <= minZ) return null;
    if (dy === 0 || !Number.isFinite(dy)) return null;
    const factor = Math.exp(-dy * 0.0015);
    const oldZ = mapZoom;
    const newZ = clampMapZoom(oldZ * factor, minZ, maxZ);
    if (newZ === oldZ) return null;
    const pan = scrollAfterZoomTowardPoint({
      scrollLeft,
      scrollTop,
      viewportX,
      viewportY,
      oldZoom: oldZ,
      newZoom: newZ,
      innerWidthPx: rw,
      innerHeightPx: rh,
      viewportW,
      viewportH,
    });
    return { scrollLeft: pan.scrollLeft, scrollTop: pan.scrollTop, mapZoom: newZ };
  }

  if (e.shiftKey) {
    if (maxL <= 0) return null;
    const horizDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (horizDelta === 0 || !Number.isFinite(horizDelta)) return null;
    const next = clampPanScroll(
      scrollLeft + horizDelta,
      scrollTop,
      { mapZoom: z, renderedWidthPx: rw, renderedHeightPx: rh, viewportW, viewportH },
    );
    if (next.scrollLeft === scrollLeft && next.scrollTop === scrollTop) return null;
    return { scrollLeft: next.scrollLeft, scrollTop: next.scrollTop, mapZoom: z };
  }

  if (maxT <= 0) return null;
  if (dy === 0 || !Number.isFinite(dy)) return null;
  const next = clampPanScroll(
    scrollLeft,
    scrollTop + dy,
    { mapZoom: z, renderedWidthPx: rw, renderedHeightPx: rh, viewportW, viewportH },
  );
  if (next.scrollLeft === scrollLeft && next.scrollTop === scrollTop) return null;
  return { scrollLeft: next.scrollLeft, scrollTop: next.scrollTop, mapZoom: z };
}

/**
 * True on-screen (client-pixel) center of a dragged token's ghost.
 *
 * The ghost's top-left is `clientX - grabOffsetX` (grabOffsetX/Y are already real, post-zoom
 * screen pixels — see `handlePointerDown` in `BattleMap.jsx`), and its rendered size is the
 * token's unzoomed base size scaled by the current `viewZoom` (matching the drag-ghost's actual
 * render). Forgetting the `viewZoom` factor on the half-size term here made the "follow" bullseye
 * (and the drop position — see {@link computeDragDropTopLeftLocalPx}) drift away from the ghost
 * whenever the map wasn't at exactly 100% zoom — a `viewZoom`-scaled distance too far down/right
 * when zoomed out below 1×.
 *
 * @param {object} p
 * @param {number} p.clientX — current pointer client X
 * @param {number} p.clientY — current pointer client Y
 * @param {number} p.grabOffsetX — real screen-pixel offset from the token's on-screen top-left where it was grabbed
 * @param {number} p.grabOffsetY
 * @param {number} p.tokenSizeWpx — token's unzoomed base render width (px)
 * @param {number} p.tokenSizeHpx
 * @param {number} p.viewZoom — current map zoom
 * @returns {{ x: number, y: number }} real client-pixel center of the ghost
 */
export function computeDragGhostCenterClientPx({
  clientX,
  clientY,
  grabOffsetX,
  grabOffsetY,
  tokenSizeWpx,
  tokenSizeHpx,
  viewZoom,
}) {
  return {
    x: clientX - grabOffsetX + (tokenSizeWpx * viewZoom) / 2,
    y: clientY - grabOffsetY + (tokenSizeHpx * viewZoom) / 2,
  };
}

/**
 * Local (unzoomed) map-layer top-left pixel position where a dragged token should land.
 *
 * `grabOffsetX/Y` are real (post-zoom) screen pixels, so — like the cursor term — they must be
 * divided by `viewZoom` before converting to local map-layer units; dividing only the cursor
 * term (and not the grab offset) leaves a `viewZoom`-dependent drift between the drop position
 * and where the ghost was actually rendered.
 *
 * @param {object} p
 * @param {number} p.clientX
 * @param {number} p.clientY
 * @param {number} p.rectLeft — scroll container `getBoundingClientRect().left`
 * @param {number} p.rectTop
 * @param {number} p.viewPanLeft — current pan offset (real px)
 * @param {number} p.viewPanTop
 * @param {number} p.viewZoom
 * @param {number} p.grabOffsetX — real screen-pixel offset from the token's on-screen top-left where it was grabbed
 * @param {number} p.grabOffsetY
 * @returns {{ x: number, y: number }} local (unzoomed) map-layer pixel top-left
 */
export function computeDragDropTopLeftLocalPx({
  clientX,
  clientY,
  rectLeft,
  rectTop,
  viewPanLeft,
  viewPanTop,
  viewZoom,
  grabOffsetX,
  grabOffsetY,
}) {
  return {
    x: (clientX - rectLeft + viewPanLeft - grabOffsetX) / viewZoom,
    y: (clientY - rectTop + viewPanTop - grabOffsetY) / viewZoom,
  };
}

export function computeZoomAndPanToFitInnerBounds({
  minInnerX,
  minInnerY,
  maxInnerX,
  maxInnerY,
  paddingPx = 0,
  minZoom,
  maxZoom,
  renderedWidthPx,
  renderedHeightPx,
  viewportW,
  viewportH,
}) {
  const pad = paddingPx;
  const minX = minInnerX - pad;
  const minY = minInnerY - pad;
  const maxX = maxInnerX + pad;
  const maxY = maxInnerY + pad;
  const W = Math.max(1, maxX - minX);
  const H = Math.max(1, maxY - minY);
  const zFit = Math.min(viewportW / W, viewportH / H);
  const mapZoom = clampMapZoom(zFit, minZoom, maxZoom);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scrollLeft = cx * mapZoom - viewportW / 2;
  const scrollTop = cy * mapZoom - viewportH / 2;
  const pan = clampPanScroll(scrollLeft, scrollTop, {
    mapZoom,
    renderedWidthPx,
    renderedHeightPx,
    viewportW,
    viewportH,
  });
  return { mapZoom, scrollLeft: pan.scrollLeft, scrollTop: pan.scrollTop };
}
