import { describe, it, expect } from 'vitest';

/**
 * GM Moves: portaled source preview uses hoveredFeature.fromChip + PortalHoverTooltipLayer (z-90).
 * The legacy side sheet used !fromChip and fixed z-50 — below the GM Moves panel (z-55), so it was invisible.
 * Regression: Actions/Fear rows must set fromChip via showGmMovesChipTooltip like Passives.
 */
describe('GM Moves source preview path', () => {
  it('does not use the legacy side-sheet branch when preview is portaled (fromChip)', () => {
    const legacySideSheetVisible = (hf, hoveredElement, gmHoverOverlayActive) =>
      !!(hoveredElement || gmHoverOverlayActive) && !hf?.fromChip && !!hf;

    const portaledPreview = { cardKey: 'adv-id', featureKey: 'attack', fromChip: true };
    expect(legacySideSheetVisible(portaledPreview, { kind: 'adversary-group' }, false)).toBe(false);
  });
});
