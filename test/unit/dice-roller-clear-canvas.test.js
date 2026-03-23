import { describe, it, expect } from 'vitest';
import { shouldClearDiceCanvasOnBannerDismiss } from '../../src/client/lib/dice-roller-clear-canvas.js';

describe('shouldClearDiceCanvasOnBannerDismiss', () => {
  it('clears when dismissing the banner that is currently animating', () => {
    expect(
      shouldClearDiceCanvasOnBannerDismiss({
        animatingBannerId: 'b-1',
        dismissedBannerId: 'b-1',
        dismissedResolved: false,
      })
    ).toBe(true);
  });

  it('clears when dismissing a completed roll and nothing else is animating (dice still on felt)', () => {
    expect(
      shouldClearDiceCanvasOnBannerDismiss({
        animatingBannerId: null,
        dismissedBannerId: 'b-1',
        dismissedResolved: true,
      })
    ).toBe(true);
  });

  it('does not clear when another banner is still animating (canvas shows that roll)', () => {
    expect(
      shouldClearDiceCanvasOnBannerDismiss({
        animatingBannerId: 'b-2',
        dismissedBannerId: 'b-1',
        dismissedResolved: true,
      })
    ).toBe(false);
  });

  it('does not clear when dismissing a pending banner while another roll is animating', () => {
    expect(
      shouldClearDiceCanvasOnBannerDismiss({
        animatingBannerId: 'b-2',
        dismissedBannerId: 'b-1',
        dismissedResolved: false,
      })
    ).toBe(false);
  });
});
