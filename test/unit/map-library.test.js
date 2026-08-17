import { describe, it, expect } from 'vitest';
import {
  applyLibraryArtToSceneMaps,
  applyLibraryMapMetaToTableMap,
  buildAddMapOpFromLibraryItem,
  buildEmptyLibraryMap,
  editorSliceToLibraryMap,
  isLibraryMapPersistable,
  libraryMapToEditorSlice,
  persistLibraryMap,
  shouldDiscardNewLibraryMap,
  syncLibraryMapOntoTableMaps,
} from '../../src/client/lib/map-library.js';
import { applyTableOp } from '../../src/client/lib/table-ops.js';
import { regenerateSceneIdsForTablePlacement } from '../../src/client/lib/scene-id-remap.js';

describe('shouldDiscardNewLibraryMap / isLibraryMapPersistable', () => {
  it('discards only when never saved and neither name nor image', () => {
    expect(shouldDiscardNewLibraryMap({ savedOnce: false, name: '', mapImageUrl: null })).toBe(true);
    expect(shouldDiscardNewLibraryMap({ savedOnce: false, name: '  ', imageUrl: '' })).toBe(true);
    expect(shouldDiscardNewLibraryMap({ savedOnce: true, name: '', mapImageUrl: null })).toBe(false);
    expect(shouldDiscardNewLibraryMap({ savedOnce: false, name: 'Cave' })).toBe(false);
    expect(shouldDiscardNewLibraryMap({ savedOnce: false, mapImageUrl: 'https://x/y.jpg' })).toBe(false);
  });

  it('persists image-only new maps', () => {
    expect(isLibraryMapPersistable({ name: '', mapImageUrl: 'https://x/y.jpg' })).toBe(true);
    expect(isLibraryMapPersistable({ name: 'Named' })).toBe(true);
    expect(isLibraryMapPersistable({ name: '', imageUrl: '' })).toBe(false);
  });
});

describe('buildAddMapOpFromLibraryItem', () => {
  it('copies views/dressing and sets libraryMapId', () => {
    const item = {
      ...buildEmptyLibraryMap('lib-1'),
      name: 'Crossroads',
      mapImageUrl: 'https://ex/map.jpg',
      mapViews: [{ id: 'v1', name: 'Main', mapViewVisibleNorm: { x: 0, y: 0, w: 1, h: 1 } }],
      dressingElements: [{ instanceId: 'd1', elementType: 'drawShape', shapeTool: 'rect', tokenX: 10, tokenY: 10 }],
    };
    const op = buildAddMapOpFromLibraryItem(item, { mapId: 'table-map-1' });
    expect(op.op).toBe('add-map');
    expect(op.mapId).toBe('table-map-1');
    expect(op.libraryMapId).toBe('lib-1');
    expect(op.librarySyncImage).toBe(true);
    expect(op.mapImageUrl).toBe('https://ex/map.jpg');
    expect(op.mapViews).toHaveLength(1);
    expect(op.mapViews[0].id).not.toBe('v1');
    expect(op.mapViews[0].mapId).toBe('table-map-1');
    expect(op.dressingElements).toHaveLength(1);
    expect(op.dressingElements[0].instanceId).not.toBe('d1');
    expect(op.dressingElements[0].mapId).toBe('table-map-1');
  });
});

describe('applyTableOp add-map library payload', () => {
  it('sets libraryMapId and appends dressing', () => {
    const state = {
      maps: [{ id: 'm0', name: 'Map 1' }],
      mapViews: [{ id: 'v0', mapId: 'm0', name: 'Main' }],
      activeMapId: 'm0',
      gmActiveViewId: 'v0',
      activeElements: [],
    };
    const item = {
      id: 'lib-9',
      name: 'Library Map',
      mapImageUrl: 'https://ex/a.jpg',
      mapViews: [{ id: 'lv', name: 'Cam' }],
      dressingElements: [{ instanceId: 'old', elementType: 'mapImage', imageUrl: 'https://ex/i.png' }],
    };
    const op = buildAddMapOpFromLibraryItem(item, { mapId: 'm-new' });
    const result = applyTableOp(op, state);
    expect(result.maps).toHaveLength(2);
    const added = result.maps.find((m) => m.id === 'm-new');
    expect(added.libraryMapId).toBe('lib-9');
    expect(added.mapImageUrl).toBe('https://ex/a.jpg');
    expect(result.activeElements).toHaveLength(1);
    expect(result.activeElements[0].mapId).toBe('m-new');
    expect(result.mapViews.filter((v) => v.mapId === 'm-new').length).toBeGreaterThanOrEqual(1);
  });
});

describe('syncLibraryMapOntoTableMaps', () => {
  it('patches image/meta only when librarySyncImage is not false', () => {
    const maps = [
      { id: 'a', libraryMapId: 'lib', name: 'Old', mapImageUrl: 'old.jpg', librarySyncImage: true },
      { id: 'b', libraryMapId: 'lib', name: 'Fork', mapImageUrl: 'fork.jpg', librarySyncImage: false },
      { id: 'c', libraryMapId: 'other', name: 'Other', mapImageUrl: 'x.jpg' },
    ];
    const { maps: next, changed } = syncLibraryMapOntoTableMaps(maps, {
      id: 'lib',
      name: 'New',
      mapImageUrl: 'new.jpg',
    });
    expect(changed).toBe(true);
    expect(next[0].mapImageUrl).toBe('new.jpg');
    expect(next[0].name).toBe('New');
    expect(next[1].mapImageUrl).toBe('fork.jpg');
    expect(next[2].mapImageUrl).toBe('x.jpg');
  });

  it('returns same reference when fork-only table has nothing to sync', () => {
    const maps = [{ id: 'b', libraryMapId: 'lib', librarySyncImage: false, mapImageUrl: 'fork.jpg' }];
    const { changed, maps: next } = syncLibraryMapOntoTableMaps(maps, { id: 'lib', mapImageUrl: 'new.jpg' });
    expect(changed).toBe(false);
    expect(next).toBe(maps);
  });
});

describe('applyLibraryMapMetaToTableMap', () => {
  it('skips forked rows', () => {
    const row = { id: 'm', librarySyncImage: false, mapImageUrl: 'a' };
    expect(applyLibraryMapMetaToTableMap(row, { mapImageUrl: 'b' })).toBe(row);
  });
});

describe('scene remap preserves libraryMapId', () => {
  it('keeps libraryMapId while remapping scene-local map id', () => {
    const remapped = regenerateSceneIdsForTablePlacement({
      maps: [{ id: 'scene-map', name: 'X', libraryMapId: 'srd-map-crossroads', mapImageUrl: 'https://ex/m.jpg' }],
      mapViews: [{ id: 'v', mapId: 'scene-map', name: 'Main' }],
      activeElements: [],
    });
    expect(remapped.maps[0].id).not.toBe('scene-map');
    expect(remapped.maps[0].libraryMapId).toBe('srd-map-crossroads');
    expect(remapped.mapViews[0].mapId).toBe(remapped.maps[0].id);
  });
});

describe('applyLibraryArtToSceneMaps', () => {
  it('stamps current library art and resolved id', () => {
    const scene = {
      maps: [{ id: 'm', libraryMapId: 'old', mapImageUrl: 'stale.jpg', name: 'Old' }],
    };
    const next = applyLibraryArtToSceneMaps(scene, {
      old: { id: 'cloned', name: 'Fresh', mapImageUrl: 'fresh.jpg' },
    });
    expect(next.maps[0].libraryMapId).toBe('cloned');
    expect(next.maps[0].mapImageUrl).toBe('fresh.jpg');
    expect(next.maps[0].name).toBe('Fresh');
  });
});

describe('libraryMapToEditorSlice camera round-trip', () => {
  it('defaults to the first camera when gmActiveViewId is omitted', () => {
    const slice = libraryMapToEditorSlice({
      mapViews: [
        { id: 'cam-a', name: 'A' },
        { id: 'cam-b', name: 'B' },
      ],
    });
    expect(slice.gmActiveViewId).toBe('cam-a');
  });

  it('keeps the selected camera (not camera 1) after flatten/expand', () => {
    const slice = libraryMapToEditorSlice({
      name: 'Cave',
      mapImageUrl: 'https://ex/m.jpg',
      mapViews: [
        { id: 'cam-a', name: 'A' },
        { id: 'cam-b', name: 'B' },
      ],
      gmActiveViewId: 'cam-b',
    });
    expect(slice.gmActiveViewId).toBe('cam-b');
    const row = persistLibraryMap(editorSliceToLibraryMap(slice, { id: 'lib-1', name: 'Cave' }));
    expect(row.gmActiveViewId).toBe('cam-b');
    expect(libraryMapToEditorSlice(row).gmActiveViewId).toBe('cam-b');
  });

  it('keeps map-layer (null camera) after flatten/expand', () => {
    const slice = libraryMapToEditorSlice({
      name: 'Cave',
      mapImageUrl: 'https://ex/m.jpg',
      mapViews: [{ id: 'cam-a', name: 'A' }],
      gmActiveViewId: null,
    });
    expect(slice.gmActiveViewId).toBeNull();
    const row = persistLibraryMap(editorSliceToLibraryMap(slice, { name: 'Cave' }));
    expect(libraryMapToEditorSlice(row).gmActiveViewId).toBeNull();
  });
});
