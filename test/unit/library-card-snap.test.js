import { describe, it, expect } from 'vitest';
import {
  computeLibrarySnapWidths,
  libraryColumnCountForWidth,
  scrollContentWidthPx,
  snapLibraryCardWidth,
  libraryWidthSliderIndexFromSnapIndex,
  librarySnapIndexFromWidthSliderIndex,
} from '../../src/client/lib/library-card-snap.js';

const GAP = 8;
const MIN = 220;

describe('library-card-snap', () => {
  it('each snap width yields the expected column count', () => {
    const w = 1000;
    const snaps = computeLibrarySnapWidths(w, GAP, MIN);
    expect(snaps.length).toBeGreaterThan(1);
    for (let i = 0; i < snaps.length; i++) {
      const c = i + 1;
      const cw = snaps[i];
      expect(libraryColumnCountForWidth(w, cw, GAP)).toBe(c);
    }
  });

  it('matches max-width formula per column count', () => {
    const w = 1000;
    const snaps = computeLibrarySnapWidths(w, GAP, MIN);
    expect(snaps[0]).toBe(Math.floor(w / 1));
    expect(snaps[1]).toBe(Math.floor((w - GAP) / 2));
  });

  it('snapLibraryCardWidth picks nearest allowed width', () => {
    const snaps = [500, 400, 300];
    expect(snapLibraryCardWidth(498, snaps)).toBe(500);
    expect(snapLibraryCardWidth(350, snaps)).toBe(400);
  });

  it('width slider index inverts snap order so range right = wider cards', () => {
    const n = 5;
    expect(libraryWidthSliderIndexFromSnapIndex(n, 0)).toBe(n - 1);
    expect(libraryWidthSliderIndexFromSnapIndex(n, n - 1)).toBe(0);
    for (let i = 0; i < n; i++) {
      expect(librarySnapIndexFromWidthSliderIndex(n, libraryWidthSliderIndexFromSnapIndex(n, i))).toBe(i);
    }
  });

  it('scrollContentWidthPx subtracts horizontal padding from clientWidth', () => {
    const el = { clientWidth: 400 };
    const orig = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
      paddingLeft: '12px',
      paddingRight: '16px',
    });
    try {
      expect(scrollContentWidthPx(el)).toBe(372);
    } finally {
      globalThis.getComputedStyle = orig;
    }
  });
});
