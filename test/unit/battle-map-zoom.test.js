import { describe, it, expect } from 'vitest';
import {
  computeMapZoomBounds,
  clampMapZoom,
  clampPanScroll,
  scrollAfterZoomTowardPoint,
} from '../../src/client/lib/battle-map-zoom.js';

describe('battle-map-zoom', () => {
  it('computeMapZoomBounds returns neutral zoom when container is unmeasured (BattleMap waits for ResizeObserver)', () => {
    const r = computeMapZoomBounds({
      containerW: 0,
      containerH: 0,
      renderedWidthPx: 800,
      renderedHeightPx: 600,
      tokenSizePx: 33,
    });
    expect(r.minZoom).toBe(1);
    expect(r.maxZoom).toBe(1);
  });

  it('computeMapZoomBounds fits full map and caps by token size', () => {
    const { minZoom, maxZoom } = computeMapZoomBounds({
      containerW: 600,
      containerH: 400,
      renderedWidthPx: 1200,
      renderedHeightPx: 800,
      tokenSizePx: 33,
    });
    expect(minZoom).toBeCloseTo(Math.min(600 / 1200, 400 / 800), 5);
    expect(maxZoom).toBeCloseTo(400 / 33, 5);
  });

  it('computeMapZoomBounds merges min/max when fitMap exceeds fitToken', () => {
    const { minZoom, maxZoom } = computeMapZoomBounds({
      containerW: 100,
      containerH: 100,
      renderedWidthPx: 50,
      renderedHeightPx: 50,
      tokenSizePx: 200,
    });
    expect(minZoom).toBe(maxZoom);
  });

  it('clampMapZoom clamps to range', () => {
    expect(clampMapZoom(0.5, 0.8, 2)).toBe(0.8);
    expect(clampMapZoom(3, 0.8, 2)).toBe(2);
    expect(clampMapZoom(1, 0.8, 2)).toBe(1);
  });

  it('clampPanScroll clamps scroll to content extents', () => {
    const p = {
      mapZoom: 1,
      renderedWidthPx: 1000,
      renderedHeightPx: 800,
      viewportW: 800,
      viewportH: 600,
    };
    expect(clampPanScroll(5000, 5000, p)).toEqual({ scrollLeft: 200, scrollTop: 200 });
  });

  it('scrollAfterZoomTowardPoint keeps point under cursor', () => {
    const r = scrollAfterZoomTowardPoint({
      scrollLeft: 100,
      scrollTop: 50,
      viewportX: 400,
      viewportY: 300,
      oldZoom: 1,
      newZoom: 2,
      innerWidthPx: 2000,
      innerHeightPx: 1500,
      viewportW: 800,
      viewportH: 600,
    });
    expect(r.scrollLeft).toBeGreaterThanOrEqual(0);
    expect(r.scrollTop).toBeGreaterThanOrEqual(0);
  });
});
