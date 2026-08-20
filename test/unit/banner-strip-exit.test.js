import { describe, it, expect } from 'vitest';
import {
  BANNER_STRIP_EXIT_MS,
  BANNER_STRIP_EXIT_REMOVE_DELAY_MS,
  BANNER_STRIP_EXIT_PAD_PX,
  BANNER_STRIP_PRE_ROLL_SLOT_ID,
  bannerExitTranslateX,
  bannerFlipInvertX,
  bannerSlotExitStyle,
  bannerSlotFlipStyle,
  bannerSlotId,
  buildBannerExitMotion,
  measureBannerSlots,
  prefersBannerStripExitReducedMotion,
} from '../../src/client/lib/banner-strip-exit.js';

describe('banner-strip-exit', () => {
  it('travels the banner width plus pad so the card fully leaves the overflow clip', () => {
    expect(bannerExitTranslateX(240)).toBe(240 + BANNER_STRIP_EXIT_PAD_PX);
    expect(bannerExitTranslateX(0)).toBe(BANNER_STRIP_EXIT_PAD_PX);
    expect(bannerExitTranslateX(-10)).toBe(BANNER_STRIP_EXIT_PAD_PX);
    expect(bannerExitTranslateX(100, 52)).toBe(152);
  });

  it('FLIP invert is previousLeft − nextLeft (negative = settle toward the tray)', () => {
    // Rightmost banner removed: a left neighbor at 192 moves to 400.
    expect(bannerFlipInvertX(192, 400)).toBe(192 - 400);
    expect(bannerFlipInvertX(400, 400)).toBe(0);
    expect(bannerFlipInvertX(400.2, 400)).toBe(0);
  });

  it('treats later row-reverse items (and the pre-roll slot) as the cards that follow the exit', () => {
    const previousSlots = new Map([
      ['oldest', { left: 400, width: 200, bottom: 0 }],
      ['newer', { left: 192, width: 200, bottom: 0 }],
      [BANNER_STRIP_PRE_ROLL_SLOT_ID, { left: 0, width: 180, bottom: 0 }],
    ]);
    const nextSlots = new Map([
      ['newer', { left: 400, width: 200, bottom: 0 }],
      [BANNER_STRIP_PRE_ROLL_SLOT_ID, { left: 208, width: 180, bottom: 0 }],
    ]);
    const motion = buildBannerExitMotion({
      previousSlots,
      nextSlots,
      exitingIds: ['oldest'],
    });
    expect(motion.exiting.oldest.translateX).toBe(200 + BANNER_STRIP_EXIT_PAD_PX);
    expect(motion.exiting.oldest.left).toBe(400);
    expect(motion.invert.newer).toBe(192 - 400);
    expect(motion.invert[BANNER_STRIP_PRE_ROLL_SLOT_ID]).toBe(0 - 208);
    expect(motion.invert.oldest).toBeUndefined();
  });

  it('does not invert banners to the visual right of the exiting card', () => {
    const previousSlots = new Map([
      ['right', { left: 400, width: 200, bottom: 0 }],
      ['mid', { left: 192, width: 200, bottom: 0 }],
      ['left', { left: 0, width: 180, bottom: 0 }],
    ]);
    const nextSlots = new Map([
      ['right', { left: 400, width: 200, bottom: 0 }],
      ['left', { left: 208, width: 180, bottom: 0 }],
    ]);
    const motion = buildBannerExitMotion({
      previousSlots,
      nextSlots,
      exitingIds: new Set(['mid']),
    });
    expect(motion.invert.right).toBeUndefined();
    expect(motion.invert.left).toBe(0 - 208);
  });

  it('exit style is frozen out of flow, then translates right on the end phase', () => {
    const start = bannerSlotExitStyle({
      left: 400, bottom: 0, width: 200, translateX: 216, phase: 'start',
    });
    expect(start.position).toBe('absolute');
    expect(start.pointerEvents).toBe('none');
    expect(start.transform).toBe('translateX(0px)');
    expect(start.transition).toBe('none');

    const end = bannerSlotExitStyle({
      left: 400, bottom: 0, width: 200, translateX: 216, phase: 'end',
    });
    expect(end.transform).toBe('translateX(216px)');
    expect(end.transition).toContain(`${BANNER_STRIP_EXIT_MS}ms`);
    expect(BANNER_STRIP_EXIT_REMOVE_DELAY_MS).toBeGreaterThan(BANNER_STRIP_EXIT_MS);
  });

  it('FLIP style starts at the invert and settles to 0', () => {
    const start = bannerSlotFlipStyle({ invertX: -208, phase: 'start' });
    expect(start.transform).toBe('translateX(-208px)');
    expect(start.transition).toBe('none');
    const end = bannerSlotFlipStyle({ invertX: -208, phase: 'end' });
    expect(end.transform).toBe('translateX(0px)');
  });

  it('measureBannerSlots reads strip-relative left/width/bottom', () => {
    const strip = {
      getBoundingClientRect: () => ({ left: 100, right: 700, top: 400, bottom: 500, width: 600, height: 100 }),
      querySelectorAll: () => [
        {
          getAttribute: () => 'a',
          getBoundingClientRect: () => ({ left: 400, right: 600, top: 420, bottom: 500, width: 200, height: 80 }),
        },
      ],
    };
    const { slots } = measureBannerSlots(strip);
    expect(slots.get('a')).toEqual({ left: 300, width: 200, height: 80, bottom: 0 });
  });

  it('honors prefers-reduced-motion so dismiss can skip the slide', () => {
    expect(prefersBannerStripExitReducedMotion(() => ({ matches: true }))).toBe(true);
    expect(prefersBannerStripExitReducedMotion(() => ({ matches: false }))).toBe(false);
    expect(prefersBannerStripExitReducedMotion(undefined)).toBe(false);
  });

  it('normalizes slot ids', () => {
    expect(bannerSlotId('b-1')).toBe('b-1');
    expect(bannerSlotId(null)).toBe(null);
    expect(bannerSlotId('')).toBe(null);
  });
});
