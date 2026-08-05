import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LEGACY_MAP_ID,
  attachDerivedMapConfig,
  deriveMapConfigFromState,
  effectiveTokenMapId,
  mapConfigHasImage,
  normalizeMapState,
} from '../../src/client/lib/map-table-state.js';

describe('map-table-state', () => {
  it('mapConfigHasImage is false for missing, empty, or non-string urls', () => {
    expect(mapConfigHasImage(null)).toBe(false);
    expect(mapConfigHasImage(undefined)).toBe(false);
    expect(mapConfigHasImage({})).toBe(false);
    expect(mapConfigHasImage({ mapImageUrl: '' })).toBe(false);
    expect(mapConfigHasImage({ mapImageUrl: '   ' })).toBe(false);
  });

  it('mapConfigHasImage is true for non-empty mapImageUrl', () => {
    expect(mapConfigHasImage({ mapImageUrl: 'https://x/map.png' })).toBe(true);
    expect(mapConfigHasImage({ mapImageUrl: ' data:,' })).toBe(true);
  });

  it('effectiveTokenMapId maps null/undefined to default legacy id', () => {
    expect(effectiveTokenMapId(null)).toBe(DEFAULT_LEGACY_MAP_ID);
    expect(effectiveTokenMapId(undefined)).toBe(DEFAULT_LEGACY_MAP_ID);
    expect(effectiveTokenMapId('m-other')).toBe('m-other');
  });

  it('normalizeMapState migrates legacy mapConfig into maps + gmMapView', () => {
    const n = normalizeMapState({
      mapConfig: {
        mapImageUrl: 'https://x/map.png',
        mapSizeFt: 50,
        mapViewZoomRatio: 0.25,
        mapViewPanNorm: { x: 0.5, y: 0.5 },
      },
    });
    expect(n.maps.length).toBe(1);
    expect(n.maps[0].id).toBe(DEFAULT_LEGACY_MAP_ID);
    expect(n.maps[0].mapSizeFt).toBe(50);
    expect(n.activeMapId).toBe(DEFAULT_LEGACY_MAP_ID);
    expect(n.gmMapView.mapId).toBe(DEFAULT_LEGACY_MAP_ID);
    expect(n.gmMapView.mapViewZoomRatio).toBe(0.25);
    expect(n.gmMapView.mapViewPanNorm).toEqual({ x: 0.5, y: 0.5 });
  });

  it('deriveMapConfigFromState merges active map content with GM broadcast view', () => {
    const state = normalizeMapState({
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'https://img/a',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      activeMapId: 'a',
      gmMapView: { mapId: 'a', mapViewZoomRatio: 0.8, mapViewPanNorm: { x: 0.1, y: 0.2 } },
    });
    const mc = deriveMapConfigFromState(state);
    expect(mc.mapImageUrl).toBe('https://img/a');
    expect(mc.mapViewZoomRatio).toBe(0.8);
    expect(mc.mapViewPanNorm).toEqual({ x: 0.1, y: 0.2 });
  });

  it('attachDerivedMapConfig adds mapConfig to a snapshot', () => {
    const out = attachDerivedMapConfig({
      mapConfig: { mapImageUrl: 'u', mapSizeFt: 80, mapViewZoomRatio: 0.3, mapViewPanNorm: { x: 0, y: 1 } },
    });
    expect(out.maps?.length).toBe(1);
    expect(out.mapConfig.mapSizeFt).toBe(80);
  });

  it('normalizeMapState defaults mapViews[].locked to false when migrating legacy state', () => {
    const n = normalizeMapState({
      mapConfig: { mapImageUrl: 'https://x/map.png', mapSizeFt: 50 },
    });
    expect(n.mapViews.length).toBeGreaterThan(0);
    for (const v of n.mapViews) {
      expect(v.locked).toBe(false);
    }
  });

  it('normalizeMapState normalizes locked on pre-existing mapViews missing the field', () => {
    const n = normalizeMapState({
      maps: [{ id: 'm1', name: 'M', mapImageUrl: 'x', mapDimension: 'width', mapSizeFt: 100, mapImageNaturalWidth: null, mapImageNaturalHeight: null }],
      mapViews: [{ id: 'v1', mapId: 'm1', name: 'Main', broadcastToPlayers: true }],
      gmActiveViewId: 'v1',
    });
    expect(n.mapViews[0].locked).toBe(false);
  });

  it('normalizeMapState preserves locked: true on pre-existing mapViews', () => {
    const n = normalizeMapState({
      maps: [{ id: 'm1', name: 'M', mapImageUrl: 'x', mapDimension: 'width', mapSizeFt: 100, mapImageNaturalWidth: null, mapImageNaturalHeight: null }],
      mapViews: [{ id: 'v1', mapId: 'm1', name: 'Main', broadcastToPlayers: true, locked: true }],
      gmActiveViewId: 'v1',
    });
    expect(n.mapViews[0].locked).toBe(true);
  });
});
