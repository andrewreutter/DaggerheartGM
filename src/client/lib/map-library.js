/**
 * Library Map item helpers — convert between `collection: 'maps'` rows and
 * table / scene-editor slices. Shared image URL + name/artist/size live on the
 * library row; cameras, overlays, and dressing are defaults that become
 * table-local after add.
 */

import { generateId } from './helpers.js';
import { DEFAULT_MAP_SIZE_FT } from './map-dimensions-ft.js';
import { attachDerivedMapConfig, newMapId, newViewId } from './map-table-state.js';
import { normalizeMapArtistFields } from './map-artist.js';

const EDITOR_MAP_ID = 'lib-map';
const EDITOR_VIEW_ID = 'lib-view';

/** @param {object} [item] */
export function libraryMapImageUrl(item) {
  if (!item || typeof item !== 'object') return null;
  for (const key of ['mapImageUrl', 'imageUrl']) {
    const u = item[key];
    if (typeof u === 'string' && u.trim()) return u.trim();
  }
  return null;
}

/** @param {object} [item] */
export function hasLibraryMapImage(item) {
  return Boolean(libraryMapImageUrl(item));
}

/** New-map autosave may persist when named or when art is present. */
export function isLibraryMapPersistable(data) {
  const name = typeof data?.name === 'string' && data.name.trim();
  return Boolean(name || hasLibraryMapImage(data));
}

/**
 * Create-New discard: never saved, and still neither a name nor an image.
 * @param {{ name?: string, imageUrl?: string, mapImageUrl?: string, savedOnce?: boolean }} [opts]
 */
export function shouldDiscardNewLibraryMap(opts = {}) {
  if (opts.savedOnce) return false;
  return !isLibraryMapPersistable(opts);
}

/** @param {string} [id] */
export function buildEmptyLibraryMap(id) {
  return {
    id: id || generateId(),
    name: '',
    is_public: false,
    imageUrl: null,
    mapImageUrl: null,
    mapImageNaturalWidth: null,
    mapImageNaturalHeight: null,
    mapSizeFt: DEFAULT_MAP_SIZE_FT,
    mapDimension: 'width',
    mapAiImagePrompt: null,
    artist: '',
    artistUrl: '',
    mapViews: [],
    overlayPng: null,
    dressingElements: [],
  };
}

/**
 * @param {object[]} [elements]
 * @param {string|null} [mapId]
 */
export function collectDressingForMap(elements, mapId) {
  return (Array.isArray(elements) ? elements : []).filter((el) => {
    if (!el || (el.elementType !== 'mapImage' && el.elementType !== 'drawShape')) return false;
    if (mapId == null) return true;
    return el.mapId == null || el.mapId === mapId;
  });
}

/**
 * Expand a library map row into a one-map table slice for MapTableEditor.
 * @param {object} [item]
 */
export function libraryMapToEditorSlice(item) {
  const imageUrl = libraryMapImageUrl(item);
  const map = {
    id: EDITOR_MAP_ID,
    name: (item?.name && String(item.name).trim()) || 'Map',
    mapImageUrl: imageUrl,
    mapDimension: item?.mapDimension === 'height' ? 'height' : 'width',
    mapSizeFt: item?.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
    mapImageNaturalWidth: item?.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: item?.mapImageNaturalHeight ?? null,
    mapAiImagePrompt: item?.mapAiImagePrompt ?? null,
    overlayPng: item?.overlayPng ?? null,
    shareWithPlayers: true,
    ...normalizeMapArtistFields(item?.artist, item?.artistUrl),
  };
  let mapViews = Array.isArray(item?.mapViews)
    ? item.mapViews.filter(Boolean).map((v) => ({ ...v, mapId: EDITOR_MAP_ID }))
    : [];
  if (mapViews.length === 0) {
    mapViews = [{
      id: EDITOR_VIEW_ID,
      mapId: EDITOR_MAP_ID,
      name: 'Main',
      mapViewZoomRatio: null,
      mapViewPanNorm: null,
      mapViewVisibleNorm: null,
      broadcastToPlayers: false,
    }];
  }
  const dressing = (Array.isArray(item?.dressingElements) ? item.dressingElements : []).map((el) => ({
    ...el,
    mapId: EDITOR_MAP_ID,
  }));
  return attachDerivedMapConfig({
    maps: [map],
    mapViews,
    activeMapId: EDITOR_MAP_ID,
    gmActiveViewId: mapViews[0]?.id ?? null,
    gmMapView: null,
    activeElements: dressing,
    sessionCountdowns: [],
    tableBattleMods: {},
    conditionsHistory: [],
    featureCountdowns: {},
  });
}

/**
 * Flatten an editor slice back to the library row shape (no table-only keys).
 * @param {object} [slice]
 * @param {object} [existing]
 */
export function editorSliceToLibraryMap(slice, existing = {}) {
  const map = (slice?.maps || [])[0] || {};
  const imageUrl = libraryMapImageUrl({
    mapImageUrl: map.mapImageUrl ?? existing.mapImageUrl,
    imageUrl: existing.imageUrl,
  });
  const credit = normalizeMapArtistFields(
    existing.artist !== undefined ? existing.artist : map.artist,
    existing.artistUrl !== undefined ? existing.artistUrl : map.artistUrl,
  );
  const name = typeof existing.name === 'string' ? existing.name : (map.name || '');
  return {
    id: existing.id,
    name,
    is_public: !!existing.is_public,
    imageUrl,
    mapImageUrl: imageUrl,
    mapImageNaturalWidth: map.mapImageNaturalWidth ?? existing.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: map.mapImageNaturalHeight ?? existing.mapImageNaturalHeight ?? null,
    mapSizeFt: map.mapSizeFt ?? existing.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
    mapDimension: map.mapDimension === 'height' ? 'height' : (existing.mapDimension || 'width'),
    mapAiImagePrompt: map.mapAiImagePrompt ?? existing.mapAiImagePrompt ?? null,
    artist: credit.artist,
    artistUrl: credit.artistUrl,
    overlayPng: map.overlayPng ?? existing.overlayPng ?? null,
    mapViews: Array.isArray(slice?.mapViews) ? slice.mapViews : (existing.mapViews || []),
    dressingElements: collectDressingForMap(slice?.activeElements, map.id),
  };
}

/** Drop table-shaped keys before writing a `maps` library row. */
export function persistLibraryMap(formData) {
  if (!formData || typeof formData !== 'object') return buildEmptyLibraryMap();
  if (Array.isArray(formData.maps) && formData.maps.length) {
    return editorSliceToLibraryMap(formData, formData);
  }
  const imageUrl = libraryMapImageUrl(formData);
  const credit = normalizeMapArtistFields(formData.artist, formData.artistUrl);
  return {
    id: formData.id,
    name: typeof formData.name === 'string' ? formData.name : '',
    is_public: !!formData.is_public,
    imageUrl,
    mapImageUrl: imageUrl,
    mapImageNaturalWidth: formData.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: formData.mapImageNaturalHeight ?? null,
    mapSizeFt: formData.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
    mapDimension: formData.mapDimension === 'height' ? 'height' : 'width',
    mapAiImagePrompt: formData.mapAiImagePrompt ?? null,
    artist: credit.artist,
    artistUrl: credit.artistUrl,
    overlayPng: formData.overlayPng ?? null,
    mapViews: Array.isArray(formData.mapViews) ? formData.mapViews : [],
    dressingElements: Array.isArray(formData.dressingElements) ? formData.dressingElements : [],
  };
}

/**
 * Fresh view / dressing ids for placing a library map onto a table.
 * @param {object} [item]
 * @param {string} newMapIdValue
 */
export function remapLibraryViewsAndDressing(item, newMapIdValue) {
  const viewIdMap = new Map();
  const srcViews = Array.isArray(item?.mapViews) ? item.mapViews : [];
  const mapViews = srcViews.filter(Boolean).map((v) => {
    const nid = newViewId();
    if (v.id != null) viewIdMap.set(v.id, nid);
    return { ...v, id: nid, mapId: newMapIdValue };
  });
  const dressingElements = (Array.isArray(item?.dressingElements) ? item.dressingElements : []).map((el) => ({
    ...el,
    instanceId: generateId(),
    mapId: newMapIdValue,
    viewId: el?.viewId != null ? (viewIdMap.get(el.viewId) ?? null) : el?.viewId,
  }));
  return { mapViews, dressingElements };
}

/**
 * Build an `add-map` op from a library row (new table ids, `libraryMapId` set).
 * @param {object} item
 * @param {{ mapId?: string }} [opts]
 */
export function buildAddMapOpFromLibraryItem(item, opts = {}) {
  const id = (typeof opts.mapId === 'string' && opts.mapId.trim()) ? opts.mapId.trim() : newMapId();
  const imageUrl = libraryMapImageUrl(item);
  const credit = normalizeMapArtistFields(item?.artist, item?.artistUrl);
  const srcViews = Array.isArray(item?.mapViews) ? item.mapViews.filter(Boolean) : [];
  const { mapViews, dressingElements } = remapLibraryViewsAndDressing(item, id);
  const name = item?.name && String(item.name).trim() ? String(item.name).trim() : undefined;
  return {
    op: 'add-map',
    mapId: id,
    name,
    mapImageUrl: imageUrl,
    mapImageNaturalWidth: item?.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: item?.mapImageNaturalHeight ?? null,
    mapSizeFt: item?.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
    mapDimension: item?.mapDimension === 'height' ? 'height' : 'width',
    mapAiImagePrompt: item?.mapAiImagePrompt ?? null,
    artist: credit.artist,
    artistUrl: credit.artistUrl,
    overlayPng: item?.overlayPng ?? null,
    libraryMapId: item?.id ?? null,
    librarySyncImage: true,
    ...(srcViews.length ? { mapViews } : {}),
    ...(dressingElements.length ? { dressingElements } : {}),
    ...(!srcViews.length && Array.isArray(opts.extraCameraVisibleNorms) && opts.extraCameraVisibleNorms.length
      ? { extraCameraVisibleNorms: opts.extraCameraVisibleNorms }
      : {}),
  };
}

/**
 * Image + name/artist/size only. Skips rows with `librarySyncImage === false`.
 * @param {object} tableMap
 * @param {object} libraryItem
 */
export function applyLibraryMapMetaToTableMap(tableMap, libraryItem) {
  if (!tableMap || !libraryItem) return tableMap;
  if (tableMap.librarySyncImage === false) return tableMap;
  const imageUrl = libraryMapImageUrl(libraryItem);
  const credit = normalizeMapArtistFields(libraryItem.artist, libraryItem.artistUrl);
  const next = {
    ...tableMap,
    name: (libraryItem.name && String(libraryItem.name).trim()) || tableMap.name,
    artist: credit.artist,
    artistUrl: credit.artistUrl,
    mapSizeFt: libraryItem.mapSizeFt ?? tableMap.mapSizeFt,
    mapDimension: libraryItem.mapDimension === 'height' ? 'height' : (libraryItem.mapDimension || tableMap.mapDimension),
    mapImageUrl: imageUrl,
    mapImageNaturalWidth: libraryItem.mapImageNaturalWidth ?? tableMap.mapImageNaturalWidth,
    mapImageNaturalHeight: libraryItem.mapImageNaturalHeight ?? tableMap.mapImageNaturalHeight,
    mapAiImagePrompt: libraryItem.mapAiImagePrompt ?? tableMap.mapAiImagePrompt,
  };
  const keys = [
    'name', 'artist', 'artistUrl', 'mapSizeFt', 'mapDimension',
    'mapImageUrl', 'mapImageNaturalWidth', 'mapImageNaturalHeight', 'mapAiImagePrompt',
  ];
  if (keys.every((k) => next[k] === tableMap[k])) return tableMap;
  return next;
}

/**
 * @param {object[]} maps
 * @param {object} libraryItem
 * @returns {{ maps: object[], changed: boolean }}
 */
export function syncLibraryMapOntoTableMaps(maps, libraryItem) {
  const libId = libraryItem?.id;
  if (!libId || !Array.isArray(maps)) return { maps: maps || [], changed: false };
  let changed = false;
  const next = maps.map((m) => {
    if (!m || m.libraryMapId !== libId) return m;
    const patched = applyLibraryMapMetaToTableMap(m, libraryItem);
    if (patched !== m) changed = true;
    return patched;
  });
  return { maps: changed ? next : maps, changed };
}

/**
 * Stamp current library art onto scene `maps[]` before table placement.
 * Cameras / dressing stay as the scene snapshot. Legacy rows without
 * `libraryMapId` are left unchanged (embedded `mapImageUrl` fallback).
 * @param {object} scene
 * @param {Map<string, object>|Record<string, object>} mapsById
 */
export function applyLibraryArtToSceneMaps(scene, mapsById) {
  const lookup = mapsById instanceof Map
    ? mapsById
    : new Map(Object.entries(mapsById || {}));
  const maps = Array.isArray(scene?.maps) ? scene.maps : [];
  return {
    ...scene,
    maps: maps.map((m) => {
      if (!m?.libraryMapId) return m;
      const lib = lookup.get(m.libraryMapId);
      if (!lib) return m;
      const imageUrl = libraryMapImageUrl(lib);
      return {
        ...m,
        libraryMapId: lib.id || m.libraryMapId,
        mapImageUrl: imageUrl ?? m.mapImageUrl,
        mapImageNaturalWidth: lib.mapImageNaturalWidth ?? m.mapImageNaturalWidth,
        mapImageNaturalHeight: lib.mapImageNaturalHeight ?? m.mapImageNaturalHeight,
        mapSizeFt: lib.mapSizeFt ?? m.mapSizeFt,
        mapDimension: lib.mapDimension ?? m.mapDimension,
        name: (lib.name && String(lib.name).trim()) || m.name,
        artist: lib.artist ?? m.artist,
        artistUrl: lib.artistUrl ?? m.artistUrl,
      };
    }),
  };
}

/**
 * Build a library row from a table/scene map + its views/dressing.
 * @param {object} tableMap
 * @param {{ mapViews?: object[], dressingElements?: object[], id?: string }} [opts]
 */
export function tableMapToLibraryItem(tableMap, opts = {}) {
  const imageUrl = libraryMapImageUrl(tableMap);
  const credit = normalizeMapArtistFields(tableMap?.artist, tableMap?.artistUrl);
  const mapId = tableMap?.id;
  const views = (Array.isArray(opts.mapViews) ? opts.mapViews : [])
    .filter((v) => v && (v.mapId == null || v.mapId === mapId));
  return {
    id: opts.id || generateId(),
    name: (tableMap?.name && String(tableMap.name).trim()) || '',
    is_public: false,
    imageUrl,
    mapImageUrl: imageUrl,
    mapImageNaturalWidth: tableMap?.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: tableMap?.mapImageNaturalHeight ?? null,
    mapSizeFt: tableMap?.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
    mapDimension: tableMap?.mapDimension === 'height' ? 'height' : 'width',
    mapAiImagePrompt: tableMap?.mapAiImagePrompt ?? null,
    artist: credit.artist,
    artistUrl: credit.artistUrl,
    overlayPng: tableMap?.overlayPng ?? null,
    mapViews: views,
    dressingElements: collectDressingForMap(opts.dressingElements, mapId),
  };
}
