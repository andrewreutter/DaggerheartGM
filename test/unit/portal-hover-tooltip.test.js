import { describe, it, expect } from 'vitest';
import {
  clampPortalHoverTooltipY,
  isClampPingPong,
  computePortalHoverTooltipPosition,
  computePortalHoverTooltipPositionBelow,
  PORTAL_HOVER_TOOLTIP_WIDTH,
  PORTAL_HOVER_TOOLTIP_GAP,
  PORTAL_HOVER_TOOLTIP_BOTTOM_PAD,
  PORTAL_TOOLTIP_MAX_Y_CLAMPS_PER_SESSION,
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

describe('clampPortalHoverTooltipY', () => {
  const pad = PORTAL_HOVER_TOOLTIP_BOTTOM_PAD;
  const innerH = 800;

  it('leaves top unchanged when panel fits below the viewport bottom', () => {
    expect(clampPortalHoverTooltipY(100, 200, innerH, pad)).toBe(100);
  });

  it('shifts up when the panel would extend past the bottom edge', () => {
    const h = 300;
    const top = 600;
    const maxTop = innerH - pad - h;
    expect(clampPortalHoverTooltipY(top, h, innerH, pad)).toBe(maxTop);
  });

  it('pins to top pad when taller than usable viewport (scroll inside panel)', () => {
    const usable = innerH - 2 * pad;
    expect(clampPortalHoverTooltipY(400, usable + 50, innerH, pad)).toBe(pad);
  });

  it('clamps from a rounded top (subpixel trigger positions map to one clamp path)', () => {
    const h = 200;
    const a = Math.round(clampPortalHoverTooltipY(Math.round(100.4), h, innerH, pad));
    const b = Math.round(clampPortalHoverTooltipY(Math.round(100.45), h, innerH, pad));
    expect(a).toBe(b);
  });
});

describe('isClampPingPong', () => {
  it('returns false when there is no prior clamp pair', () => {
    expect(isClampPingPong(10, 20, { from: null, to: null })).toBe(false);
  });

  it('detects A→B then B→A oscillation (skip second update)', () => {
    const last = { from: 100, to: 50 };
    expect(isClampPingPong(50, 100, last)).toBe(true);
  });

  it('allows a new clamp when not the reverse of the last pair', () => {
    const last = { from: 100, to: 50 };
    expect(isClampPingPong(50, 40, last)).toBe(false);
  });

  it('does not stop a 3-way y cycle (session cap in hook is required for React #185)', () => {
    const nextY = (y) => (y === 100 ? 80 : y === 80 ? 60 : 100);
    let y = 100;
    let pair = { from: null, to: null };
    let steps = 0;
    while (steps < 30) {
      const n = nextY(y);
      if (n === y) break;
      if (isClampPingPong(y, n, pair)) break;
      pair = { from: y, to: n };
      y = n;
      steps++;
    }
    expect(steps).toBe(30);
    expect(PORTAL_TOOLTIP_MAX_Y_CLAMPS_PER_SESSION).toBeLessThan(steps);
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
