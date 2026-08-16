import { describe, it, expect } from 'vitest';
import {
  ENCOUNTER_ASIDE_WIDTH_REM,
  ENCOUNTER_OVERLAY_GAP_PX,
  ENCOUNTER_TRACKER_WIDTH_REM,
  encounterOverlayRightPx,
  encounterPotAdvOverlayStyle,
  encounterTrackerOverlayStyle,
  resolveEncounterAsideLeft,
} from '../../src/client/lib/encounter-overlay-position.js';

describe('encounter overlay position', () => {
  it('places the tracker just left of the aside', () => {
    expect(encounterOverlayRightPx(800, 1000)).toBe(1000 - 800 + ENCOUNTER_OVERLAY_GAP_PX);
  });

  it('falls back to a flush-right w-56 aside when the ref is missing', () => {
    expect(resolveEncounterAsideLeft(null, 1000)).toBe(1000 - ENCOUNTER_ASIDE_WIDTH_REM * 16);
  });

  it('reads the aside left edge from getBoundingClientRect', () => {
    const el = { getBoundingClientRect: () => ({ left: 640 }) };
    expect(resolveEncounterAsideLeft(el, 1000)).toBe(640);
  });

  it('builds tracker style from trigger midpoint and aside left', () => {
    const style = encounterTrackerOverlayStyle({
      asideLeft: 800,
      viewportWidth: 1000,
      triggerTop: 100,
      triggerBottom: 140,
      adjust: 4,
    });
    expect(style.right).toBe(212);
    expect(style.top).toBe(124);
    expect(style.width).toBe(`calc(${ENCOUNTER_TRACKER_WIDTH_REM}rem + ${ENCOUNTER_OVERLAY_GAP_PX}px)`);
  });

  it('places the potential-adversary card left of the tracker overlay', () => {
    const tracker = encounterTrackerOverlayStyle({
      asideLeft: 800,
      viewportWidth: 1000,
      triggerTop: 40,
      triggerBottom: 60,
    });
    const pot = encounterPotAdvOverlayStyle({
      asideLeft: 800,
      viewportWidth: 1000,
      triggerTop: 40,
      triggerBottom: 60,
    });
    expect(pot.right).toBe(tracker.right + ENCOUNTER_TRACKER_WIDTH_REM * 16 + ENCOUNTER_OVERLAY_GAP_PX);
  });
});
