/** Encounter aside is `w-56` (14rem). */
export const ENCOUNTER_ASIDE_WIDTH_REM = 14;
export const ENCOUNTER_TRACKER_WIDTH_REM = 26;
export const ENCOUNTER_POT_ADV_WIDTH_REM = 24;
export const ENCOUNTER_OVERLAY_GAP_PX = 12;

/**
 * CSS `right` so an overlay's right edge sits `gapPx` left of the aside.
 * @param {number} asideLeft
 * @param {number} viewportWidth
 * @param {number} [extraWidthPx] — additional width already occupied (e.g. the tracker overlay)
 * @param {number} [gapPx]
 */
export function encounterOverlayRightPx(asideLeft, viewportWidth, extraWidthPx = 0, gapPx = ENCOUNTER_OVERLAY_GAP_PX) {
  return viewportWidth - asideLeft + gapPx + extraWidthPx;
}

/**
 * Aside left edge in viewport coordinates. Falls back to a flush-right `w-56` panel.
 * @param {Element|null|undefined} asideEl
 * @param {number} [viewportWidth]
 */
export function resolveEncounterAsideLeft(asideEl, viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0) {
  if (asideEl && typeof asideEl.getBoundingClientRect === 'function') {
    return asideEl.getBoundingClientRect().left;
  }
  return viewportWidth - ENCOUNTER_ASIDE_WIDTH_REM * 16;
}

/**
 * @param {{ asideLeft: number, viewportWidth: number, triggerTop: number, triggerBottom: number, adjust?: number }} opts
 */
export function encounterTrackerOverlayStyle({
  asideLeft,
  viewportWidth,
  triggerTop,
  triggerBottom,
  adjust = 0,
}) {
  return {
    right: encounterOverlayRightPx(asideLeft, viewportWidth),
    top: (triggerTop + triggerBottom) / 2 + adjust,
    transform: 'translateY(-50%)',
    width: `calc(${ENCOUNTER_TRACKER_WIDTH_REM}rem + ${ENCOUNTER_OVERLAY_GAP_PX}px)`,
    maxHeight: 'calc(100dvh - 110px)',
    paddingRight: `${ENCOUNTER_OVERLAY_GAP_PX}px`,
  };
}

/**
 * Potential-adversary card sits left of the environment tracker overlay.
 * @param {{ asideLeft: number, viewportWidth: number, triggerTop: number, triggerBottom: number, adjust?: number }} opts
 */
export function encounterPotAdvOverlayStyle({
  asideLeft,
  viewportWidth,
  triggerTop,
  triggerBottom,
  adjust = 0,
}) {
  const trackerOccupiedPx = ENCOUNTER_TRACKER_WIDTH_REM * 16 + ENCOUNTER_OVERLAY_GAP_PX;
  return {
    right: encounterOverlayRightPx(asideLeft, viewportWidth, trackerOccupiedPx),
    top: (triggerTop + triggerBottom) / 2 + adjust,
    transform: 'translateY(-50%)',
    width: `calc(${ENCOUNTER_POT_ADV_WIDTH_REM}rem + 8px)`,
    maxHeight: 'calc(100dvh - 110px)',
    paddingRight: '8px',
  };
}
