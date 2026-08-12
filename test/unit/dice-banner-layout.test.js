import { describe, it, expect } from 'vitest';
import {
  BANNER_CARD_SCROLL_STYLE,
  BANNER_MAX_HEIGHT,
  BANNER_STRIP_BOTTOM,
  DICE_BOTTOM_RESERVE,
} from '../../src/client/lib/dice-banner-layout.js';

describe('dice-banner-layout', () => {
  it('dice canvas bottom reserve is banner max height plus strip offset (not a disconnected guess)', () => {
    // Former bug: DICE_BOTTOM_RESERVE was a hardcoded '10rem' while banners
    // (especially RestBanner / V2 review chips) grew past that and covered settled dice.
    expect(DICE_BOTTOM_RESERVE).not.toBe('10rem');
    expect(DICE_BOTTOM_RESERVE).toBe(`calc(${BANNER_MAX_HEIGHT} + ${BANNER_STRIP_BOTTOM})`);
    expect(BANNER_STRIP_BOTTOM).toBe('2.5rem');
  });

  it('caps each banner card so it cannot grow past the reserved dice floor', () => {
    expect(BANNER_MAX_HEIGHT).toBe('min(25rem, 50vh)');
    expect(BANNER_CARD_SCROLL_STYLE.maxHeight).toBe(BANNER_MAX_HEIGHT);
    expect(BANNER_CARD_SCROLL_STYLE.overflowY).toBe('auto');
  });
});
