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

/** Screen pixels of vertical pointer travel per altitude step. */
export const ALTITUDE_PX_PER_STEP = 10;

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
 * extended left by `expandLeftPx` (the altitude control width + gap). Used to keep
 * bullseye hover-focus while the pointer moves from the token onto the control.
 *
 * @param {object} opts
 * @param {number} opts.pointX
 * @param {number} opts.pointY
 * @param {number} opts.tokenLeftPx
 * @param {number} opts.tokenTopPx
 * @param {number} opts.tokenWidthPx
 * @param {number} opts.tokenHeightPx
 * @param {number} [opts.expandLeftPx]
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
}) {
  const left = tokenLeftPx - (Number(expandLeftPx) || 0);
  const right = tokenLeftPx + tokenWidthPx;
  const top = tokenTopPx;
  const bottom = tokenTopPx + tokenHeightPx;
  return pointX >= left && pointX <= right && pointY >= top && pointY <= bottom;
}
