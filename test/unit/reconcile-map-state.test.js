import { describe, it, expect } from 'vitest';
import {
  reconcileMapsById,
  reconcileMapViewsById,
  reconcileMapConfig,
} from '../../src/client/lib/reconcile-map-state.js';

// ─── reconcileMapsById ────────────────────────────────────────────────────────

describe('reconcileMapsById', () => {
  it('returns nextMaps when prevMaps is empty', () => {
    const next = [{ id: 'map-1', mapImageUrl: 'x.png' }];
    expect(reconcileMapsById([], next)).toBe(next);
    expect(reconcileMapsById(undefined, next)).toBe(next);
  });

  it('passes through non-array nextMaps as-is', () => {
    expect(reconcileMapsById([{ id: 'map-1' }], null)).toBe(null);
  });

  it('returns the exact previous array reference when nothing changed', () => {
    const prev = [
      { id: 'map-1', mapImageUrl: 'x.png', shareWithPlayers: true },
      { id: 'map-2', mapImageUrl: 'y.png', shareWithPlayers: false },
    ];
    const next = [
      { id: 'map-1', mapImageUrl: 'x.png', shareWithPlayers: true },
      { id: 'map-2', mapImageUrl: 'y.png', shareWithPlayers: false },
    ];
    expect(reconcileMapsById(prev, next)).toBe(prev);
  });

  it('preserves prev reference for unchanged items, uses new object for changed items', () => {
    const prevA = { id: 'map-1', mapImageUrl: 'x.png' };
    const prevB = { id: 'map-2', mapImageUrl: 'y.png' };
    const prev = [prevA, prevB];

    const nextA = { id: 'map-1', mapImageUrl: 'x.png' }; // deep-equal
    const nextB = { id: 'map-2', mapImageUrl: 'z.png' }; // changed
    const result = reconcileMapsById(prev, [nextA, nextB]);

    expect(result).not.toBe(prev);
    expect(result[0]).toBe(prevA);
    expect(result[1]).toBe(nextB);
  });

  it('handles added items (no matching id in prev)', () => {
    const prev = [{ id: 'map-1', mapImageUrl: 'x.png' }];
    const newMap = { id: 'map-2', mapImageUrl: 'y.png' };
    const result = reconcileMapsById(prev, [{ id: 'map-1', mapImageUrl: 'x.png' }, newMap]);
    expect(result[1]).toBe(newMap);
  });

  it('handles removed items — returns shorter reconciled array', () => {
    const prevA = { id: 'map-1', mapImageUrl: 'x.png' };
    const prev = [prevA, { id: 'map-2', mapImageUrl: 'y.png' }];
    const next = [{ id: 'map-1', mapImageUrl: 'x.png' }];
    const result = reconcileMapsById(prev, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(prevA);
    expect(result).not.toBe(prev);
  });

  it('handles items without an id by passing the next object through', () => {
    const noId = { mapImageUrl: 'x.png' };
    const result = reconcileMapsById([{ mapImageUrl: 'x.png' }], [noId]);
    expect(result[0]).toBe(noId);
  });
});

// ─── reconcileMapViewsById ────────────────────────────────────────────────────

describe('reconcileMapViewsById', () => {
  it('returns nextMapViews when prevMapViews is empty', () => {
    const next = [{ id: 'view-1', mapId: 'map-1' }];
    expect(reconcileMapViewsById([], next)).toBe(next);
  });

  it('returns the exact previous array reference when nothing changed', () => {
    const prev = [
      { id: 'view-1', mapViewZoomRatio: 1.0, mapViewPanNorm: { x: 0, y: 0 } },
    ];
    const next = [
      { id: 'view-1', mapViewZoomRatio: 1.0, mapViewPanNorm: { x: 0, y: 0 } },
    ];
    expect(reconcileMapViewsById(prev, next)).toBe(prev);
  });

  it('preserves prev reference for unchanged views, uses new object for changed views', () => {
    const prevA = { id: 'view-1', mapViewZoomRatio: 1.0 };
    const prevB = { id: 'view-2', mapViewZoomRatio: 2.0 };
    const nextA = { id: 'view-1', mapViewZoomRatio: 1.0 }; // deep-equal
    const nextB = { id: 'view-2', mapViewZoomRatio: 3.0 }; // changed
    const result = reconcileMapViewsById([prevA, prevB], [nextA, nextB]);
    expect(result[0]).toBe(prevA);
    expect(result[1]).toBe(nextB);
  });

  it('handles added views', () => {
    const prev = [{ id: 'view-1', mapViewZoomRatio: 1.0 }];
    const newView = { id: 'view-2', mapViewZoomRatio: 1.0 };
    const result = reconcileMapViewsById(prev, [{ id: 'view-1', mapViewZoomRatio: 1.0 }, newView]);
    expect(result[1]).toBe(newView);
  });

  it('handles removed views', () => {
    const prevA = { id: 'view-1', mapViewZoomRatio: 1.0 };
    const result = reconcileMapViewsById([prevA, { id: 'view-2', mapViewZoomRatio: 2.0 }], [{ id: 'view-1', mapViewZoomRatio: 1.0 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(prevA);
  });
});

// ─── reconcileMapConfig ───────────────────────────────────────────────────────

describe('reconcileMapConfig', () => {
  it('returns the previous reference when configs are deep-equal', () => {
    const prev = { mapImageUrl: 'x.png', mapSizeFt: 100, mapDimension: { w: 200, h: 100 } };
    const next = { mapImageUrl: 'x.png', mapSizeFt: 100, mapDimension: { w: 200, h: 100 } };
    expect(reconcileMapConfig(prev, next)).toBe(prev);
  });

  it('returns the new object when configs differ', () => {
    const prev = { mapImageUrl: 'x.png', mapSizeFt: 100 };
    const next = { mapImageUrl: 'x.png', mapSizeFt: 200 };
    expect(reconcileMapConfig(prev, next)).toBe(next);
  });

  it('returns the new object when a nested field changes', () => {
    const prev = { mapDimension: { w: 200, h: 100 } };
    const next = { mapDimension: { w: 300, h: 100 } };
    expect(reconcileMapConfig(prev, next)).toBe(next);
  });

  it('returns the new object when a field is added', () => {
    const prev = { mapSizeFt: 100 };
    const next = { mapSizeFt: 100, mapImageUrl: 'new.png' };
    expect(reconcileMapConfig(prev, next)).toBe(next);
  });
});
