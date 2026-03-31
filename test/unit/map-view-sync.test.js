import { describe, it, expect } from 'vitest';
import {
  encodeMapViewState,
  encodeMapViewVisibleNorm,
  decodeMapViewState,
  shouldPersistMapViewToTable,
} from '../../src/client/lib/map-view-sync.js';

describe('map-view-sync', () => {
  const base = {
    minZoom: 0.5,
    maxZoom: 2,
    renderedWidthPx: 800,
    renderedHeightPx: 600,
    viewportW: 400,
    viewportH: 300,
  };

  it('round-trips encode → decode on the same viewport', () => {
    const mapZoom = 1.25;
    const scrollLeft = 120;
    const scrollTop = 80;
    const encoded = encodeMapViewState({
      mapZoom,
      scrollLeft,
      scrollTop,
      ...base,
    });
    const decoded = decodeMapViewState(
      {
        mapViewZoomRatio: encoded.mapViewZoomRatio,
        mapViewPanNorm: encoded.mapViewPanNorm,
        mapViewVisibleNorm: encoded.mapViewVisibleNorm,
      },
      base
    );
    expect(decoded).not.toBeNull();
    expect(decoded.mapZoom).toBeCloseTo(mapZoom, 5);
    expect(decoded.scrollLeft).toBeCloseTo(scrollLeft, 5);
    expect(decoded.scrollTop).toBeCloseTo(scrollTop, 5);
  });

  it('decode returns null when no stored view', () => {
    expect(decodeMapViewState({}, base)).toBeNull();
    expect(decodeMapViewState({ mapViewZoomRatio: null }, base)).toBeNull();
    expect(decodeMapViewState({ mapViewPanNorm: null }, base)).toBeNull();
  });

  it('decode applies ratio-only with scroll at origin', () => {
    const d = decodeMapViewState({ mapViewZoomRatio: 1, mapViewPanNorm: null }, base);
    expect(d.mapZoom).toBeCloseTo(2, 5);
    expect(d.scrollLeft).toBe(0);
    expect(d.scrollTop).toBe(0);
  });

  it('mapViewVisibleNorm round-trips on the same viewport (preferred decode path)', () => {
    const encoded = encodeMapViewState({
      mapZoom: 1,
      scrollLeft: 100,
      scrollTop: 50,
      ...base,
    });
    const decoded = decodeMapViewState({ mapViewVisibleNorm: encoded.mapViewVisibleNorm }, base);
    expect(decoded).not.toBeNull();
    const reNorm = encodeMapViewVisibleNorm({
      mapZoom: decoded.mapZoom,
      scrollLeft: decoded.scrollLeft,
      scrollTop: decoded.scrollTop,
      renderedWidthPx: base.renderedWidthPx,
      renderedHeightPx: base.renderedHeightPx,
      viewportW: base.viewportW,
      viewportH: base.viewportH,
    });
    expect(reNorm.x).toBeCloseTo(encoded.mapViewVisibleNorm.x, 5);
    expect(reNorm.y).toBeCloseTo(encoded.mapViewVisibleNorm.y, 5);
    expect(reNorm.w).toBeCloseTo(encoded.mapViewVisibleNorm.w, 5);
    expect(reNorm.h).toBeCloseTo(encoded.mapViewVisibleNorm.h, 5);
  });

  it('mapViewVisibleNorm decode uses same aspect viewport so inner rect matches across sizes', () => {
    const narrow = { ...base, viewportW: 200, viewportH: 150 };
    const encoded = encodeMapViewState({
      mapZoom: 1,
      scrollLeft: 40,
      scrollTop: 30,
      ...narrow,
    });
    const wide = { ...base, viewportW: 400, viewportH: 300 };
    const decoded = decodeMapViewState({ mapViewVisibleNorm: encoded.mapViewVisibleNorm }, wide);
    expect(decoded).not.toBeNull();
    const reNorm = encodeMapViewVisibleNorm({
      mapZoom: decoded.mapZoom,
      scrollLeft: decoded.scrollLeft,
      scrollTop: decoded.scrollTop,
      renderedWidthPx: wide.renderedWidthPx,
      renderedHeightPx: wide.renderedHeightPx,
      viewportW: wide.viewportW,
      viewportH: wide.viewportH,
    });
    expect(reNorm.x).toBeCloseTo(encoded.mapViewVisibleNorm.x, 5);
    expect(reNorm.y).toBeCloseTo(encoded.mapViewVisibleNorm.y, 5);
    expect(reNorm.w).toBeCloseTo(encoded.mapViewVisibleNorm.w, 5);
    expect(reNorm.h).toBeCloseTo(encoded.mapViewVisibleNorm.h, 5);
  });

  it('cross-viewport decode preserves pan fractions approximately', () => {
    const narrow = { ...base, viewportW: 200, viewportH: 150 };
    const encoded = encodeMapViewState({
      mapZoom: 1,
      scrollLeft: 100,
      scrollTop: 50,
      ...narrow,
    });
    const wide = { ...base, viewportW: 500, viewportH: 400 };
    const decoded = decodeMapViewState(
      { mapViewZoomRatio: encoded.mapViewZoomRatio, mapViewPanNorm: encoded.mapViewPanNorm },
      wide
    );
    expect(decoded).not.toBeNull();
    const reEncoded = encodeMapViewState({
      mapZoom: decoded.mapZoom,
      scrollLeft: decoded.scrollLeft,
      scrollTop: decoded.scrollTop,
      ...wide,
    });
    expect(reEncoded.mapViewZoomRatio).toBeCloseTo(encoded.mapViewZoomRatio, 5);
    expect(reEncoded.mapViewPanNorm.x).toBeCloseTo(encoded.mapViewPanNorm.x, 5);
    expect(reEncoded.mapViewPanNorm.y).toBeCloseTo(encoded.mapViewPanNorm.y, 5);
  });

  it('decodeAlign topLeft pins the shared rect top edge to the viewport top (avoids centering slack above the GM frame)', () => {
    const ctx = {
      minZoom: 0.5,
      maxZoom: 3,
      renderedWidthPx: 1000,
      renderedHeightPx: 1000,
      viewportW: 800,
      viewportH: 600,
      decodeAlign: 'topLeft',
    };
    const stored = {
      mapViewVisibleNorm: { x: 0.1, y: 0.2, w: 0.4, h: 0.3 },
    };
    const d = decodeMapViewState(stored, ctx);
    expect(d).not.toBeNull();
    const vn = stored.mapViewVisibleNorm;
    const topInnerPx = vn.y * ctx.renderedHeightPx;
    const rTop = topInnerPx * d.mapZoom - d.scrollTop;
    expect(rTop).toBeCloseTo(0, 4);
  });

  it('same mapZoom but different scrollTop produces different mapViewVisibleNorm.y (stale zero-scroll must not broadcast as equivalent framing)', () => {
    const ctx = {
      minZoom: 0.39141414141414144,
      maxZoom: 23.484848484848484,
      renderedWidthPx: 1980,
      renderedHeightPx: 1980,
      viewportW: 775,
      viewportH: 1130,
    };
    const z = 2.1283454647062383;
    const panned = encodeMapViewState({
      mapZoom: z,
      scrollLeft: 1513.2896740572658,
      scrollTop: 1162.8577661431063,
      ...ctx,
    });
    const topOrigin = encodeMapViewState({
      mapZoom: z,
      scrollLeft: 1513.2896740572658,
      scrollTop: 0,
      ...ctx,
    });
    expect(panned.mapViewZoomRatio).toBeCloseTo(topOrigin.mapViewZoomRatio, 5);
    expect(panned.mapViewVisibleNorm.y).not.toBeCloseTo(topOrigin.mapViewVisibleNorm.y, 2);
  });

  it('handles minZoom === maxZoom without NaN', () => {
    const flat = { ...base, minZoom: 1, maxZoom: 1 };
    const e = encodeMapViewState({
      mapZoom: 1,
      scrollLeft: 0,
      scrollTop: 0,
      ...flat,
    });
    expect(Number.isFinite(e.mapViewZoomRatio)).toBe(true);
    const d = decodeMapViewState(
      { mapViewZoomRatio: e.mapViewZoomRatio, mapViewPanNorm: { x: 0.5, y: 0.5 } },
      flat
    );
    expect(d.mapZoom).toBe(1);
  });

  describe('shouldPersistMapViewToTable', () => {
    it('allows only the table owner when not previewing as player', () => {
      expect(shouldPersistMapViewToTable({
        userUid: 'gm-uid',
        tableOwnerUid: 'gm-uid',
        effectiveIsPlayer: false,
      })).toBe(true);
      expect(shouldPersistMapViewToTable({
        userUid: 'player-uid',
        tableOwnerUid: 'gm-uid',
        effectiveIsPlayer: false,
      })).toBe(false);
    });
    it('denies when previewing as player or owner uid unknown', () => {
      expect(shouldPersistMapViewToTable({
        userUid: 'gm-uid',
        tableOwnerUid: 'gm-uid',
        effectiveIsPlayer: true,
      })).toBe(false);
      expect(shouldPersistMapViewToTable({
        userUid: 'gm-uid',
        tableOwnerUid: undefined,
        effectiveIsPlayer: false,
      })).toBe(false);
    });
  });
});
