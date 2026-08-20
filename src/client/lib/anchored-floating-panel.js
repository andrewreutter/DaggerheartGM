/** Gap between the click/token anchor and the panel edge. */
export const ANCHORED_PANEL_GAP_PX = 12;
/** Viewport inset so the panel does not hug the window chrome. */
export const ANCHORED_PANEL_MARGIN_PX = 8;
/** Shift the panel up from the pointer so it sits beside the token. */
export const ANCHORED_PANEL_TOP_OFFSET_PX = 20;

/**
 * Viewport-clamped `position: fixed` coords for a click-anchored panel.
 * Default sits to the right of the anchor (left-tray character pins).
 * `preferLeft` mirrors that — used for right-tray adversary pins.
 *
 * @param {{
 *   anchorX: number,
 *   anchorY: number,
 *   width?: number,
 *   height?: number,
 *   viewportWidth: number,
 *   viewportHeight: number,
 *   preferLeft?: boolean,
 *   gap?: number,
 *   margin?: number,
 *   topOffset?: number,
 * }} opts
 * @returns {{ left: number, top: number }}
 */
export function computeAnchoredFloatingPanelPos({
  anchorX,
  anchorY,
  width = 0,
  height = 0,
  viewportWidth,
  viewportHeight,
  preferLeft = false,
  gap = ANCHORED_PANEL_GAP_PX,
  margin = ANCHORED_PANEL_MARGIN_PX,
  topOffset = ANCHORED_PANEL_TOP_OFFSET_PX,
} = {}) {
  const w = Number.isFinite(width) ? width : 0;
  const h = Number.isFinite(height) ? height : 0;
  const vw = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  const vh = Number.isFinite(viewportHeight) ? viewportHeight : 0;
  let left = preferLeft ? anchorX - w - gap : anchorX + gap;
  if (preferLeft) {
    if (left < margin) left = anchorX + gap;
  } else if (left + w > vw - margin) {
    left = anchorX - w - gap;
  }
  const maxLeft = Math.max(margin, vw - w - margin);
  left = Math.max(margin, Math.min(maxLeft, left));
  const maxTop = Math.max(margin, vh - h - margin);
  const top = Math.max(margin, Math.min(maxTop, anchorY - topOffset));
  return { left, top };
}
