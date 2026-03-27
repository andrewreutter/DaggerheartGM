import { describe, expect, it } from 'vitest';

const THUMB_MAX_W = 260;
const STRIP_H = 72;

/** Mirrors PageLayoutPreviewModal SpriteThumb: uniform scale, box equals crop (no partial slice). */
function spriteThumbLayout(bw, bh) {
  const s = Math.min(THUMB_MAX_W / bw, STRIP_H / bh);
  return { s, w: bw * s, h: bh * s };
}

describe('page layout sprite thumb', () => {
  it('fits the full crop in the max box and preserves aspect ratio', () => {
    const cases = [
      [800, 100],
      [100, 2000],
      [100, 100],
      [40, 40],
      [500, 400],
    ];
    for (const [bw, bh] of cases) {
      const { s, w, h } = spriteThumbLayout(bw, bh);
      expect(w).toBeLessThanOrEqual(THUMB_MAX_W + 1e-9);
      expect(h).toBeLessThanOrEqual(STRIP_H + 1e-9);
      expect(w / h).toBeCloseTo(bw / bh, 6);
      expect(w / s).toBeCloseTo(bw, 6);
      expect(h / s).toBeCloseTo(bh, 6);
    }
  });
});
