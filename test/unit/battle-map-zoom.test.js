import { describe, it, expect } from 'vitest';
import {
  computeMapZoomBounds,
  computeImageViewportZoomBounds,
  applyViewportWheelPanZoom,
  clampMapZoom,
  clampPanScroll,
  normalizeWheelDeltaPixels,
  computePanToCenterInnerPointPx,
  computeZoomAndPanToFitInnerBounds,
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

  it('clampPanScroll uses mapZoom for content size — stale zoom vs current scroll corrupts pan (GM camera switch)', () => {
    const renderedWidthPx = 1000;
    const renderedHeightPx = 800;
    const viewportW = 400;
    const viewportH = 300;
    const zoomPrev = 0.2;
    const zoomDecoded = 0.45;
    const scrollLeft = 120;
    const scrollTop = 40;
    const pStale = { mapZoom: zoomPrev, renderedWidthPx, renderedHeightPx, viewportW, viewportH };
    const pOk = { mapZoom: zoomDecoded, renderedWidthPx, renderedHeightPx, viewportW, viewportH };
    expect(clampPanScroll(scrollLeft, scrollTop, pStale)).not.toEqual(clampPanScroll(scrollLeft, scrollTop, pOk));
  });

  it('normalizeWheelDeltaPixels scales LINE and PAGE modes', () => {
    expect(
      normalizeWheelDeltaPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 800, 600),
    ).toEqual({ dx: 0, dy: 48 });
    expect(
      normalizeWheelDeltaPixels({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 800, 600),
    ).toEqual({ dx: 0, dy: 600 });
  });

  it('computePanToCenterInnerPointPx centers a point and clamps', () => {
    const p = {
      mapZoom: 1,
      renderedWidthPx: 1000,
      renderedHeightPx: 800,
      viewportW: 400,
      viewportH: 300,
    };
    const c = computePanToCenterInnerPointPx({
      innerCenterXPx: 500,
      innerCenterYPx: 400,
      ...p,
    });
    expect(c.scrollLeft).toBe(300);
    expect(c.scrollTop).toBe(250);
  });

  it('computeZoomAndPanToFitInnerBounds picks max zoom that fits bbox', () => {
    const r = computeZoomAndPanToFitInnerBounds({
      minInnerX: 0,
      minInnerY: 0,
      maxInnerX: 100,
      maxInnerY: 100,
      paddingPx: 0,
      minZoom: 0.5,
      maxZoom: 4,
      renderedWidthPx: 1000,
      renderedHeightPx: 800,
      viewportW: 400,
      viewportH: 300,
    });
    expect(r.mapZoom).toBe(3);
    expect(r.scrollLeft).toBeGreaterThanOrEqual(0);
    expect(r.scrollTop).toBeGreaterThanOrEqual(0);
  });

  it('computeImageViewportZoomBounds fits image and allows zoom-in headroom', () => {
    const { minZoom, maxZoom } = computeImageViewportZoomBounds({
      containerW: 400,
      containerH: 300,
      imageWidthPx: 800,
      imageHeightPx: 600,
    });
    expect(minZoom).toBeCloseTo(Math.min(400 / 800, 300 / 600), 5);
    expect(maxZoom).toBeGreaterThan(minZoom);
  });

  it('applyViewportWheelPanZoom zooms with metaKey', () => {
    const e = {
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      deltaX: 0,
      deltaY: 100,
      deltaMode: 0,
    };
    const next = applyViewportWheelPanZoom(e, {
      viewportW: 400,
      viewportH: 300,
      viewportX: 200,
      viewportY: 150,
      scrollLeft: 0,
      scrollTop: 0,
      mapZoom: 0.5,
      minZoom: 0.4,
      maxZoom: 2,
      renderedWidthPx: 800,
      renderedHeightPx: 600,
    });
    expect(next).not.toBeNull();
    expect(next.mapZoom).not.toBe(0.5);
    expect(Number.isFinite(next.scrollLeft)).toBe(true);
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
