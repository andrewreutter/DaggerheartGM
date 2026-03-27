import { describe, it, expect } from 'vitest';
import {
  clampCropRectToLayout,
  loadPageLayoutFromFile,
} from '../../src/client/lib/page-layout-load.js';

describe('loadPageLayoutFromFile', () => {
  it('rejects non-image files', async () => {
    const f = new File(['x'], 'note.txt', { type: 'text/plain' });
    await expect(loadPageLayoutFromFile(f)).rejects.toThrow(/Not an image/);
  });
});

describe('clampCropRectToLayout', () => {
  it('returns null for empty or tiny rects', () => {
    expect(clampCropRectToLayout(null, 100, 100)).toBeNull();
    expect(clampCropRectToLayout({ x0: 0, y0: 0, x1: 2, y1: 2 }, 100, 100)).toBeNull();
  });

  it('normalizes inverted corners and clamps to image bounds', () => {
    expect(clampCropRectToLayout({ x0: 90, y0: 80, x1: 10, y1: 20 }, 100, 100)).toEqual({
      x0: 10,
      y0: 20,
      x1: 90,
      y1: 80,
    });
    expect(clampCropRectToLayout({ x0: -5, y0: 0, x1: 200, y1: 50 }, 100, 80)).toEqual({
      x0: 0,
      y0: 0,
      x1: 100,
      y1: 50,
    });
  });
});
