import { describe, it, expect } from 'vitest';
import {
  median,
  unionBbox,
  clusterLinesToTextBlocks,
  getArtworkMarginRects,
  addNormalizedRect,
  ocrDetectionsIndicateText,
} from '../../src/page-layout-ocr.js';

describe('page-layout-ocr', () => {
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('unionBbox', () => {
    expect(
      unionBbox({ x0: 0, y0: 0, x1: 10, y1: 5 }, { x0: 5, y0: 0, x1: 20, y1: 8 })
    ).toEqual({ x0: 0, y0: 0, x1: 20, y1: 8 });
  });

  it('clusterLinesToTextBlocks merges close vertical lines', () => {
    const detections = [
      { bbox: { x0: 0, y0: 0, x1: 100, y1: 10 }, text: 'Hello', confidence: 90 },
      { bbox: { x0: 0, y0: 12, x1: 100, y1: 22 }, text: 'world', confidence: 90 },
      { bbox: { x0: 0, y0: 80, x1: 50, y1: 95 }, text: 'Far', confidence: 90 },
    ];
    const blocks = clusterLinesToTextBlocks(detections, { minConfidence: 50, gapMultiplier: 0.5 });
    expect(blocks.length).toBe(2);
    expect(blocks[0].text).toContain('Hello');
    expect(blocks[0].text).toContain('world');
    expect(blocks[1].text).toBe('Far');
  });

  it('getArtworkMarginRects returns top margin when large enough', () => {
    const W = 800;
    const H = 1200;
    const lines = [
      { bbox: { x0: 50, y0: 400, x1: 750, y1: 450 }, text: 'x'.repeat(10), confidence: 95 },
    ];
    const rects = getArtworkMarginRects(W, H, lines);
    expect(rects.length).toBeGreaterThanOrEqual(1);
    const top = rects.find((r) => r.y0 === 0 && r.y1 <= 400);
    expect(top).toBeDefined();
  });

  it('addNormalizedRect', () => {
    const r = addNormalizedRect({ x0: 0, y0: 0, x1: 100, y1: 50 }, 200, 100);
    expect(r.nx0).toBe(0);
    expect(r.nx1).toBe(0.5);
    expect(r.ny1).toBe(0.5);
  });

  it('ocrDetectionsIndicateText is true when clustered text blocks exist', () => {
    const detections = [
      { bbox: { x0: 0, y0: 0, x1: 100, y1: 10 }, text: 'Hello', confidence: 90 },
      { bbox: { x0: 0, y0: 12, x1: 100, y1: 22 }, text: 'world', confidence: 90 },
    ];
    expect(ocrDetectionsIndicateText(detections)).toBe(true);
  });

  it('ocrDetectionsIndicateText is false for empty or low-confidence noise', () => {
    expect(ocrDetectionsIndicateText([])).toBe(false);
    expect(
      ocrDetectionsIndicateText([
        { bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, text: '?', confidence: 40 },
      ]),
    ).toBe(false);
  });
});
