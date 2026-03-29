export const PORTAL_HOVER_TOOLTIP_WIDTH = 272;
export const PORTAL_HOVER_TOOLTIP_WIDTH_WIDE = 448;
export const PORTAL_HOVER_TOOLTIP_GAP = 6;
export const PORTAL_HOVER_TOOLTIP_BOTTOM_PAD = 16;

/**
 * Clamp `position: fixed` `top` so a panel of `height` px stays within the viewport
 * with `pad` margin top and bottom. If taller than the usable viewport, pin to `pad`
 * and rely on `max-height` + overflow on the panel.
 */
export function clampPortalHoverTooltipY(
  top,
  height,
  innerHeight = typeof window !== 'undefined' ? window.innerHeight : 800,
  pad = PORTAL_HOVER_TOOLTIP_BOTTOM_PAD,
) {
  const usable = innerHeight - 2 * pad;
  if (height >= usable) return pad;
  const maxTop = innerHeight - pad - height;
  return Math.max(pad, Math.min(top, maxTop));
}

/**
 * Viewport-fixed position for a hover panel beside a trigger rect (same rules as CustomSelect option hover).
 * @param {Pick<DOMRect, 'left' | 'right' | 'top'>} rect
 * @param {boolean} wide
 * @param {number} [innerWidth]
 */
export function computePortalHoverTooltipPosition(rect, wide, innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1024) {
  const panelW = wide
    ? Math.min(PORTAL_HOVER_TOOLTIP_WIDTH_WIDE, innerWidth - 24)
    : PORTAL_HOVER_TOOLTIP_WIDTH;
  const spaceRight = innerWidth - rect.right;
  const useRight = spaceRight >= panelW + PORTAL_HOVER_TOOLTIP_GAP;
  const x = useRight ? rect.right + PORTAL_HOVER_TOOLTIP_GAP : rect.left - panelW - PORTAL_HOVER_TOOLTIP_GAP;
  const y = rect.top;
  return { x, y };
}

const VIEWPORT_EDGE = 8;

/**
 * Position the panel **below** the anchor rect, horizontally centered under it (clamped to viewport).
 * Used for segmented chip banks so the tooltip does not jump per-button or cover sibling chips.
 * @param {Pick<DOMRect, 'left' | 'width' | 'right' | 'bottom'>} rect
 */
export function computePortalHoverTooltipPositionBelow(rect, wide, innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1024) {
  const panelW = wide
    ? Math.min(PORTAL_HOVER_TOOLTIP_WIDTH_WIDE, innerWidth - 24)
    : PORTAL_HOVER_TOOLTIP_WIDTH;
  let x = rect.left + rect.width / 2 - panelW / 2;
  x = Math.max(VIEWPORT_EDGE, Math.min(x, innerWidth - panelW - VIEWPORT_EDGE));
  const y = rect.bottom + PORTAL_HOVER_TOOLTIP_GAP;
  return { x, y };
}
