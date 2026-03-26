import { describe, it, expect } from 'vitest';
import {
  computePortalHoverTooltipPosition,
  computePortalHoverTooltipPositionBelow,
  PORTAL_HOVER_TOOLTIP_WIDTH,
  PORTAL_HOVER_TOOLTIP_GAP,
} from '../../src/client/lib/portal-hover-tooltip-position.js';

describe('computePortalHoverTooltipPosition', () => {
  it('places panel to the right when there is room', () => {
    const innerWidth = 1200;
    const rect = { right: 400, left: 100, top: 50 };
    const { x, y } = computePortalHoverTooltipPosition(rect, false, innerWidth);
    expect(y).toBe(50);
    expect(x).toBe(rect.right + PORTAL_HOVER_TOOLTIP_GAP);
  });

  it('places panel to the left when not enough space on the right', () => {
    const innerWidth = 400;
    const rect = { right: 380, left: 200, top: 10 };
    const { x } = computePortalHoverTooltipPosition(rect, false, innerWidth);
    const panelW = PORTAL_HOVER_TOOLTIP_WIDTH;
    expect(x).toBe(rect.left - panelW - PORTAL_HOVER_TOOLTIP_GAP);
  });
});

describe('computePortalHoverTooltipPositionBelow', () => {
  it('centers panel under anchor and places it below the rect', () => {
    const innerWidth = 1200;
    const rect = { left: 400, width: 200, right: 600, bottom: 120 };
    const { x, y } = computePortalHoverTooltipPositionBelow(rect, false, innerWidth);
    const panelW = PORTAL_HOVER_TOOLTIP_WIDTH;
    expect(y).toBe(rect.bottom + PORTAL_HOVER_TOOLTIP_GAP);
    expect(x).toBe(rect.left + rect.width / 2 - panelW / 2);
  });

  it('clamps x when centered panel would overflow the viewport', () => {
    const innerWidth = 300;
    const rect = { left: 0, width: 280, right: 280, bottom: 50 };
    const { x } = computePortalHoverTooltipPositionBelow(rect, false, innerWidth);
    const panelW = PORTAL_HOVER_TOOLTIP_WIDTH;
    expect(x).toBeLessThanOrEqual(innerWidth - panelW - 8);
    expect(x).toBeGreaterThanOrEqual(8);
  });
});
