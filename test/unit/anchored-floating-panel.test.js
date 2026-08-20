import { describe, expect, it } from 'vitest';
import {
  ANCHORED_PANEL_GAP_PX,
  ANCHORED_PANEL_MARGIN_PX,
  ANCHORED_PANEL_TOP_OFFSET_PX,
  computeAnchoredFloatingPanelPos,
} from '../../src/client/lib/anchored-floating-panel.js';

describe('computeAnchoredFloatingPanelPos', () => {
  const viewport = { viewportWidth: 1200, viewportHeight: 800 };

  it('places the panel to the right of the anchor by default (left-tray characters)', () => {
    const pos = computeAnchoredFloatingPanelPos({
      anchorX: 80,
      anchorY: 200,
      width: 224,
      height: 160,
      ...viewport,
    });
    expect(pos.left).toBe(80 + ANCHORED_PANEL_GAP_PX);
    expect(pos.top).toBe(200 - ANCHORED_PANEL_TOP_OFFSET_PX);
  });

  it('places the panel to the left of the anchor when preferLeft (right-tray adversaries)', () => {
    const pos = computeAnchoredFloatingPanelPos({
      anchorX: 1100,
      anchorY: 200,
      width: 224,
      height: 160,
      preferLeft: true,
      ...viewport,
    });
    expect(pos.left).toBe(1100 - 224 - ANCHORED_PANEL_GAP_PX);
    expect(pos.top).toBe(200 - ANCHORED_PANEL_TOP_OFFSET_PX);
  });

  it('flips a right-preferring panel left when it would overflow the viewport', () => {
    const pos = computeAnchoredFloatingPanelPos({
      anchorX: 1100,
      anchorY: 200,
      width: 224,
      height: 160,
      ...viewport,
    });
    expect(pos.left).toBe(1100 - 224 - ANCHORED_PANEL_GAP_PX);
  });

  it('clamps into the viewport inset', () => {
    const pos = computeAnchoredFloatingPanelPos({
      anchorX: 4,
      anchorY: 4,
      width: 200,
      height: 100,
      ...viewport,
    });
    expect(pos.left).toBeGreaterThanOrEqual(ANCHORED_PANEL_MARGIN_PX);
    expect(pos.top).toBe(ANCHORED_PANEL_MARGIN_PX);
  });
});
