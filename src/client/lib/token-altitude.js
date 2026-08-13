/**
 * Pure helpers for battle-map token altitude (feet above/below ground).
 * No React/DOM dependency so this is directly unit-testable.
 */

/** Altitude snap increment when dragging the floating control. */
export const ALTITUDE_STEP_FT = 5;

/** Width of the floating altitude label/control in unzoomed map-local pixels. */
export const ALTITUDE_CONTROL_WIDTH_PX = 40;

/** Gap between the control's right edge and the token's left edge (map-local px). */
export const ALTITUDE_CONTROL_GAP_PX = 4;

/**
 * Format an altitude in feet for the map HUD (`"50'"`, `"-20'"`, `"0'"`).
 *
 * @param {number} ft
 * @returns {string}
 */
export function formatAltitudeFt(ft) {
  const n = Number(ft);
  const value = Number.isFinite(n) ? n : 0;
  return `${value}'`;
}

/**
 * Map-local pixel offset of an altitude stem (signed: positive altitude → up / negative Y).
 * One foot of altitude equals one foot on the map plane (`pxPerFt`).
 *
 * @param {number} altitudeFt
 * @param {number} pxPerFt
 * @returns {number}
 */
export function altitudeStemOffsetPx(altitudeFt, pxPerFt) {
  const alt = Number(altitudeFt);
  const scale = Number(pxPerFt);
  if (!Number.isFinite(alt) || !Number.isFinite(scale) || !(scale > 0)) return 0;
  return alt * scale;
}

/**
 * Screen pixels of pointer travel per altitude step so drag rate matches stem growth.
 * The stem lives in the CSS-scaled map layer, so screen px = map-local px × `viewZoom`.
 *
 * @param {number} pxPerFt
 * @param {number} [viewZoom=1]
 * @returns {number} 0 when the scale is invalid (caller should treat as "no step")
 */
export function altitudeDragPxPerStep(pxPerFt, viewZoom = 1) {
  const scale = Number(pxPerFt) * Number(viewZoom);
  if (!(scale > 0)) return 0;
  return ALTITUDE_STEP_FT * scale;
}

/**
 * Convert a vertical pointer delta into snapped altitude *steps*.
 * `deltaPx` is `startClientY - currentClientY` so moving the pointer **up** is positive
 * (increases altitude).
 *
 * @param {number} deltaPx
 * @param {number} pxPerStep
 * @returns {number} integer step count (may be negative)
 */
export function computeAltitudeStepsFromDragDeltaPx(deltaPx, pxPerStep) {
  const step = Number(pxPerStep);
  if (!(step > 0) || !Number.isFinite(deltaPx)) return 0;
  return Math.round(deltaPx / step);
}

/**
 * True when `(pointX, pointY)` (map-local px) sits inside the token footprint box
 * extended left by `expandLeftPx` (the altitude control width + gap) and vertically
 * to the stem tip when `stemOffsetPx` is set. Used to keep bullseye hover-focus while
 * the pointer moves from a token onto the stem or altitude control.
 *
 * @param {object} opts
 * @param {number} opts.pointX
 * @param {number} opts.pointY
 * @param {number} opts.tokenLeftPx
 * @param {number} opts.tokenTopPx
 * @param {number} opts.tokenWidthPx
 * @param {number} opts.tokenHeightPx
 * @param {number} [opts.expandLeftPx]
 * @param {number} [opts.stemOffsetPx] - signed map-local px (positive = up); 0 keeps the original token box
 * @returns {boolean}
 */
export function isPointInExpandedHoverZone({
  pointX,
  pointY,
  tokenLeftPx,
  tokenTopPx,
  tokenWidthPx,
  tokenHeightPx,
  expandLeftPx = 0,
  stemOffsetPx = 0,
}) {
  const left = tokenLeftPx - (Number(expandLeftPx) || 0);
  const right = tokenLeftPx + tokenWidthPx;
  const tokenBottom = tokenTopPx + tokenHeightPx;
  const offset = Number(stemOffsetPx);
  const stem = Number.isFinite(offset) ? offset : 0;
  const centerY = tokenTopPx + tokenHeightPx / 2;
  const tipY = centerY - stem;
  const top = Math.min(tokenTopPx, tipY);
  const bottom = Math.max(tokenBottom, tipY);
  return pointX >= left && pointX <= right && pointY >= top && pointY <= bottom;
}
