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
  return overlayLeftOfEdgeStyle({
    edgeLeft: asideLeft,
    viewportWidth,
    triggerTop,
    triggerBottom,
    adjust,
    widthRem: ENCOUNTER_TRACKER_WIDTH_REM,
  });
}

/** Token-detail hover overlay sits just left of the adversary tray. */
export const TRAY_OVERLAY_WIDTH_REM = 24;

/**
 * CSS `right` / `top` so a fixed overlay sits `gapPx` left of an edge
 * (Encounter aside, right tray, …) and vertically centers on the trigger.
 * `paddingRight` is a hover bridge so the pointer can leave the trigger
 * without the overlay dismissing.
 */
export function overlayLeftOfEdgeStyle({
  edgeLeft,
  viewportWidth,
  triggerTop,
  triggerBottom,
  adjust = 0,
  widthRem,
  gapPx = ENCOUNTER_OVERLAY_GAP_PX,
}) {
  return {
    right: encounterOverlayRightPx(edgeLeft, viewportWidth, 0, gapPx),
    top: (triggerTop + triggerBottom) / 2 + adjust,
    transform: 'translateY(-50%)',
    width: `calc(${widthRem}rem + ${gapPx}px)`,
    maxHeight: 'calc(100dvh - 110px)',
    paddingRight: `${gapPx}px`,
  };
}

/** Game Table GM Moves panel: same top whether opened from Encounter or the GM token. */
export const GM_MOVES_PANEL_TOP_PX = 90;
export const GM_MOVES_ENCOUNTER_RIGHT = 'calc(14rem)';
export const GM_MOVES_PANEL_GAP_PX = 8;

/**
 * Horizontal placement for the GM Moves panel.
 * Encounter trigger: flush left of the aside (`right: 14rem`).
 * GM token trigger: flush left of the token, same `top`.
 */
export function gmMovesOverlayStyle({
  source,
  edgeLeft,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0,
  gapPx = GM_MOVES_PANEL_GAP_PX,
} = {}) {
  const fromToken = source === 'gm-token' && Number.isFinite(edgeLeft);
  return {
    right: fromToken
      ? encounterOverlayRightPx(edgeLeft, viewportWidth, 0, gapPx)
      : GM_MOVES_ENCOUNTER_RIGHT,
    paddingRight: `${gapPx}px`,
    top: GM_MOVES_PANEL_TOP_PX,
    width: 'min(96vw, calc(14rem + 28rem + 28rem + 2rem))',
    maxHeight: 'calc(100dvh - 98px)',
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
