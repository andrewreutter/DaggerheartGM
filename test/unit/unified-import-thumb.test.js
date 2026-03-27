import { describe, expect, it } from 'vitest';
import { computeUnifiedImportThumbCrop } from '../../src/client/lib/unified-import-thumb.jsx';

describe('computeUnifiedImportThumbCrop', () => {
  it('clips to crop aspect: wide rect uses inner height bh*s, not full tile height', () => {
    const layout = { width: 1000, height: 800 };
    const rect = { x0: 100, y0: 50, x1: 900, y1: 150 }; // 800×100 wide strip
    const sizePx = 88;
    const { bw, bh, s } = computeUnifiedImportThumbCrop(layout, rect, sizePx);
    expect(bw).toBe(800);
    expect(bh).toBe(100);
    expect(s).toBe(sizePx / bw);
    const innerH = bh * s;
    expect(innerH).toBeLessThan(sizePx);
    expect(innerH).toBeCloseTo(11, 5);
  });

  it('square crop fills the tile on the limiting axis', () => {
    const layout = { width: 400, height: 400 };
    const rect = { x0: 0, y0: 0, x1: 200, y1: 200 };
    const sizePx = 88;
    const { bw, bh, s } = computeUnifiedImportThumbCrop(layout, rect, sizePx);
    expect(bw).toBe(200);
    expect(bh).toBe(200);
    expect(bw * s).toBe(sizePx);
    expect(bh * s).toBe(sizePx);
  });
});
