import { describe, it, expect } from 'vitest';
import {
  computeMapZoomBounds,
  computeImageViewportZoomBounds,
  applyViewportWheelPanZoom,
  clampMapZoom,
  clampPanScroll,
  computeDragDropTopLeftLocalPx,
  computeDragGhostCenterClientPx,
  normalizeWheelDeltaPixels,
  computePanToCenterInnerPointPx,
  computeZoomAndPanToFitInnerBounds,
  collectPlacedTokenInnerBounds,
  ZOOM_FIT_KIND_TYPES,
  scrollAfterZoomTowardPoint,
  computeCameraViewportFt,
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

  describe('collectPlacedTokenInnerBounds', () => {
    const tokenMapId = (el) => el.mapId ?? 'm-default';
    const baseOpts = { pxPerFt: 10, tokenSizePx: 50, activeMapId: 'm-1', tokenMapId };
    const party = { elementType: 'character', tokenX: 0, tokenY: 0, mapId: 'm-1' };
    const companion = { elementType: 'boardToken', tokenX: 10, tokenY: 0, mapId: 'm-1' };
    const foe = { elementType: 'adversary', tokenX: 20, tokenY: 10, mapId: 'm-1' };
    const otherMap = { elementType: 'character', tokenX: 0, tokenY: 0, mapId: 'm-2' };
    const tray = { elementType: 'character', tokenX: null, tokenY: null, mapId: 'm-1' };

    it('fits all actors and ignores tray / other-map tokens', () => {
      const b = collectPlacedTokenInnerBounds(
        [party, companion, foe, otherMap, tray],
        { ...baseOpts, types: ZOOM_FIT_KIND_TYPES.actors },
      );
      expect(b).toEqual({ minInnerX: 0, minInnerY: 0, maxInnerX: 250, maxInnerY: 150 });
    });

    it('party excludes adversaries', () => {
      const b = collectPlacedTokenInnerBounds(
        [party, companion, foe],
        { ...baseOpts, types: ZOOM_FIT_KIND_TYPES.party },
      );
      expect(b).toEqual({ minInnerX: 0, minInnerY: 0, maxInnerX: 150, maxInnerY: 50 });
    });

    it('adversaries excludes party tokens', () => {
      const b = collectPlacedTokenInnerBounds(
        [party, companion, foe],
        { ...baseOpts, types: ZOOM_FIT_KIND_TYPES.adversaries },
      );
      expect(b).toEqual({ minInnerX: 200, minInnerY: 100, maxInnerX: 250, maxInnerY: 150 });
    });

    it('returns null when no matching placed tokens', () => {
      expect(collectPlacedTokenInnerBounds([tray, otherMap], {
        ...baseOpts,
        types: ZOOM_FIT_KIND_TYPES.actors,
      })).toBeNull();
    });
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

  describe('computeDragGhostCenterClientPx / computeDragDropTopLeftLocalPx (drag bullseye/drop drift regression)', () => {
    // A 5×5' token at pxPerFt=10 renders at 50px (unzoomed base). Grabbed dead-center means
    // grabOffsetX/Y equal half of the token's *real* (post-zoom) on-screen size.
    const pxPerFt = 10;
    const tokenSizeWpx = 50;
    const tokenSizeHpx = 50;

    it('at 100% zoom, ghost center matches the token center exactly (sanity baseline)', () => {
      const viewZoom = 1;
      const grabOffsetX = (tokenSizeWpx * viewZoom) / 2;
      const grabOffsetY = (tokenSizeHpx * viewZoom) / 2;
      // Token top-left at (0,0)ft → real on-screen center at (25,25)px; simulate grabbing there
      // and releasing the pointer at the same client position (no movement).
      const clientX = 0 + grabOffsetX;
      const clientY = 0 + grabOffsetY;
      const center = computeDragGhostCenterClientPx({
        clientX, clientY, grabOffsetX, grabOffsetY, tokenSizeWpx, tokenSizeHpx, viewZoom,
      });
      expect(center.x).toBeCloseTo(clientX, 6);
      expect(center.y).toBeCloseTo(clientY, 6);
    });

    it('when zoomed out (viewZoom < 1), an unmoved drag reports the ghost center at the true token center, not shifted down/right', () => {
      const viewZoom = 0.5;
      // Token top-left at local (0,0)px → real on-screen top-left is also (0,0) (rect at origin,
      // no pan). Real on-screen size is tokenSizeWpx*viewZoom = 25px, so true real center is (12.5,12.5).
      const grabOffsetX = 12.5; // grabbed at the token's real on-screen center
      const grabOffsetY = 12.5;
      const clientX = 12.5; // pointer stayed exactly where it grabbed (no movement)
      const clientY = 12.5;
      const center = computeDragGhostCenterClientPx({
        clientX, clientY, grabOffsetX, grabOffsetY, tokenSizeWpx, tokenSizeHpx, viewZoom,
      });
      // Regression: before the fix this returned (25, 25) — a 12.5px (real) / 2.5ft drift
      // down-and-right from the token's actual on-screen center whenever zoomed out.
      expect(center.x).toBeCloseTo(12.5, 6);
      expect(center.y).toBeCloseTo(12.5, 6);
    });

    it('when zoomed out (viewZoom < 1), releasing without moving the pointer drops the token back at its original top-left', () => {
      const viewZoom = 0.5;
      const rectLeft = 0;
      const rectTop = 0;
      const viewPanLeft = 0;
      const viewPanTop = 0;
      const grabOffsetX = 12.5; // grabbed at the token's real on-screen center (see above)
      const grabOffsetY = 12.5;
      const clientX = 12.5; // no movement since grab
      const clientY = 12.5;
      const { x, y } = computeDragDropTopLeftLocalPx({
        clientX, clientY, rectLeft, rectTop, viewPanLeft, viewPanTop, viewZoom, grabOffsetX, grabOffsetY,
      });
      // Regression: before the fix this returned (12.5, 12.5) local px (1.25ft) instead of (0, 0) —
      // a stationary drag-and-drop would silently nudge the token when the map wasn't at 100% zoom.
      expect(x / pxPerFt).toBeCloseTo(0, 6);
      expect(y / pxPerFt).toBeCloseTo(0, 6);
    });

    it('ghost center and drop position agree on where a moved token lands, at non-1x zoom', () => {
      const viewZoom = 0.5;
      const grabOffsetX = 12.5;
      const grabOffsetY = 12.5;
      // Drag 30 real px to the right, 0 vertically.
      const clientX = 12.5 + 30;
      const clientY = 12.5;
      const center = computeDragGhostCenterClientPx({
        clientX, clientY, grabOffsetX, grabOffsetY, tokenSizeWpx, tokenSizeHpx, viewZoom,
      });
      const drop = computeDragDropTopLeftLocalPx({
        clientX, clientY, rectLeft: 0, rectTop: 0, viewPanLeft: 0, viewPanTop: 0, viewZoom, grabOffsetX, grabOffsetY,
      });
      // 30 real px at 0.5x zoom = 60 local px = 6ft of movement.
      expect(center.x / viewZoom / pxPerFt).toBeCloseTo(2.5 + 6, 6); // ghost center in ft
      expect((drop.x + tokenSizeWpx / 2) / pxPerFt).toBeCloseTo(2.5 + 6, 6); // drop top-left + half-width in ft
    });
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

  it('computeCameraViewportFt converts pan/zoom into a feet rectangle', () => {
    expect(computeCameraViewportFt({
      viewPanLeft: 100,
      viewPanTop: 50,
      viewZoom: 2,
      pxPerFt: 10,
      containerWidth: 400,
      containerHeight: 300,
      mapId: 'm-1',
    })).toEqual({ x: 5, y: 2.5, width: 20, height: 15, mapId: 'm-1' });
    expect(computeCameraViewportFt({
      viewPanLeft: 0,
      viewPanTop: 0,
      viewZoom: 0,
      pxPerFt: 10,
      containerWidth: 400,
      containerHeight: 300,
    })).toBeNull();
  });
});
