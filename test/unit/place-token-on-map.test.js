import { describe, it, expect } from 'vitest';
import {
  pickRandomPlaceOnMapSpot,
  pickRandomPlaceOnMapSpots,
  getTokenTrayDirection,
} from '../../src/client/lib/place-token-on-map.js';

const footprint5x5 = { halfWidth: 2.5, halfLength: 2.5 };

describe('getTokenTrayDirection', () => {
  it('returns right for adversaries (right tray) and left for everything else', () => {
    expect(getTokenTrayDirection('adversary')).toBe('right');
    expect(getTokenTrayDirection('character')).toBe('left');
    expect(getTokenTrayDirection('boardToken')).toBe('left');
  });
});

describe('pickRandomPlaceOnMapSpot', () => {
  it('places within the visible viewport, clamped to map bounds', () => {
    const spot = pickRandomPlaceOnMapSpot({
      mapWidthFt: 100,
      mapHeightFt: 100,
      viewportFt: { x: 10, y: 10, width: 20, height: 20 },
      footprint: footprint5x5,
      randomFn: () => 0.5, // deterministic: middle of the range
    });
    // Viewport top-left range for a 5x5 token: x in [10, 10+20-5]=[10,25], y same.
    expect(spot.x).toBeCloseTo(10 + 0.5 * (25 - 10));
    expect(spot.y).toBeCloseTo(10 + 0.5 * (25 - 10));
  });

  it('never places a token outside the map bounds even with an off-map viewport', () => {
    const spot = pickRandomPlaceOnMapSpot({
      mapWidthFt: 30,
      mapHeightFt: 30,
      viewportFt: { x: -50, y: -50, width: 40, height: 40 },
      footprint: footprint5x5,
      randomFn: () => 0.9,
    });
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.y).toBeGreaterThanOrEqual(0);
    expect(spot.x + 5).toBeLessThanOrEqual(30 + 1e-9);
    expect(spot.y + 5).toBeLessThanOrEqual(30 + 1e-9);
  });

  it('avoids overlapping an existing token when a non-overlapping spot exists in the viewport', () => {
    let call = 0;
    // First random attempt lands exactly on the existing token; the function should
    // reject it and try again (second attempt lands elsewhere).
    const randomSeq = [0.0, 0.0, 0.99, 0.99];
    const randomFn = () => randomSeq[call++ % randomSeq.length];
    const spot = pickRandomPlaceOnMapSpot({
      mapWidthFt: 50,
      mapHeightFt: 50,
      viewportFt: { x: 0, y: 0, width: 50, height: 50 },
      footprint: footprint5x5,
      otherTokens: [{ x: 0, y: 0, footprint: footprint5x5 }],
      randomFn,
      maxAttemptsPerPass: 10,
    });
    // Should not overlap the existing token at (0,0)-(5,5): centers must be >= 5ft apart on an axis.
    const cx = spot.x + 2.5;
    const cy = spot.y + 2.5;
    const overlaps = Math.abs(cx - 2.5) < 5 && Math.abs(cy - 2.5) < 5;
    expect(overlaps).toBe(false);
  });

  it('falls back to a clamped point when no non-overlapping spot exists anywhere', () => {
    // Map is exactly the size of a single 5x5 token, and that spot is already occupied.
    const spot = pickRandomPlaceOnMapSpot({
      mapWidthFt: 5,
      mapHeightFt: 5,
      viewportFt: { x: 0, y: 0, width: 5, height: 5 },
      footprint: footprint5x5,
      otherTokens: [{ x: 0, y: 0, footprint: footprint5x5 }],
      randomFn: () => 0.5,
      maxAttemptsPerPass: 5,
    });
    expect(spot.x).toBe(0);
    expect(spot.y).toBe(0);
  });

  it('handles a token larger than the map without throwing', () => {
    const spot = pickRandomPlaceOnMapSpot({
      mapWidthFt: 3,
      mapHeightFt: 3,
      viewportFt: { x: 0, y: 0, width: 3, height: 3 },
      footprint: { halfWidth: 10, halfLength: 10 },
      randomFn: () => 0.5,
    });
    expect(Number.isFinite(spot.x)).toBe(true);
    expect(Number.isFinite(spot.y)).toBe(true);
  });
});

describe('pickRandomPlaceOnMapSpots', () => {
  it('places every item without any two batch spots overlapping each other', () => {
    // Deterministic but varying RNG (each call returns a different fraction) so overlap
    // rejection can actually find a different candidate spot on retry — without
    // batch-accumulation the first non-overlapping spot found would still be reused as-is
    // for every item and they'd end up stacked on the same coordinates.
    let call = 0;
    const randomFn = () => (call++ * 0.37) % 1;
    const spots = pickRandomPlaceOnMapSpots({
      mapWidthFt: 50,
      mapHeightFt: 50,
      viewportFt: { x: 0, y: 0, width: 50, height: 50 },
      items: [{ footprint: footprint5x5 }, { footprint: footprint5x5 }, { footprint: footprint5x5 }],
      randomFn,
      maxAttemptsPerPass: 60,
    });
    expect(spots).toHaveLength(3);
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const cxi = spots[i].x + 2.5;
        const cyi = spots[i].y + 2.5;
        const cxj = spots[j].x + 2.5;
        const cyj = spots[j].y + 2.5;
        const overlaps = Math.abs(cxi - cxj) < 5 && Math.abs(cyi - cyj) < 5;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('still avoids pre-existing otherTokens in addition to batch-mates', () => {
    let call = 0;
    const randomFn = () => (call++ * 0.37) % 1;
    const spots = pickRandomPlaceOnMapSpots({
      mapWidthFt: 50,
      mapHeightFt: 50,
      viewportFt: { x: 0, y: 0, width: 50, height: 50 },
      items: [{ footprint: footprint5x5 }],
      otherTokens: [{ x: 0, y: 0, footprint: footprint5x5 }],
      randomFn,
      maxAttemptsPerPass: 60,
    });
    const cx = spots[0].x + 2.5;
    const cy = spots[0].y + 2.5;
    const overlaps = Math.abs(cx - 2.5) < 5 && Math.abs(cy - 2.5) < 5;
    expect(overlaps).toBe(false);
  });

  it('returns an empty array for an empty items list', () => {
    expect(
      pickRandomPlaceOnMapSpots({ mapWidthFt: 50, mapHeightFt: 50, viewportFt: { x: 0, y: 0, width: 50, height: 50 }, items: [] }),
    ).toEqual([]);
  });
});
