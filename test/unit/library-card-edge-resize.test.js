import { describe, it, expect } from 'vitest';
import {
  computeResizedLibraryWidth,
  computeResizedLibraryHeight,
  snapLibraryCardWidth,
} from '../../src/client/lib/library-card-snap.js';

describe('computeResizedLibraryWidth', () => {
  it('adds delta and clamps to min/max when no snaps', () => {
    expect(computeResizedLibraryWidth(300, 20, 220, 800, [])).toBe(320);
    expect(computeResizedLibraryWidth(300, -200, 220, 800, [])).toBe(220);
    expect(computeResizedLibraryWidth(790, 20, 220, 800, [])).toBe(800);
  });

  it('snaps to nearest column width when snaps provided', () => {
    const snaps = [400, 360, 320];
    expect(computeResizedLibraryWidth(360, 25, 220, 800, snaps)).toBe(snapLibraryCardWidth(385, snaps));
    expect(computeResizedLibraryWidth(360, -30, 220, 800, snaps)).toBe(snapLibraryCardWidth(330, snaps));
  });

  it('treats null snapWidths like empty snaps', () => {
    expect(computeResizedLibraryWidth(400, 10, 220, 800, null)).toBe(410);
  });
});

describe('computeResizedLibraryHeight', () => {
  it('adds delta and clamps', () => {
    expect(computeResizedLibraryHeight(176, 24, 48, 400)).toBe(200);
    expect(computeResizedLibraryHeight(176, -200, 48, 400)).toBe(48);
    expect(computeResizedLibraryHeight(390, 50, 48, 400)).toBe(400);
  });
});
