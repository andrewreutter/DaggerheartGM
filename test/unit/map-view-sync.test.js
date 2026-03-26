import { describe, it, expect } from 'vitest';
import { encodeMapViewState, decodeMapViewState, shouldPersistMapViewToTable } from '../../src/client/lib/map-view-sync.js';

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
      { mapViewZoomRatio: encoded.mapViewZoomRatio, mapViewPanNorm: encoded.mapViewPanNorm },
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
