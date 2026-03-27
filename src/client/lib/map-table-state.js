/**
 * Multi-map + named views (cameras). Legacy rows used `mapConfig` + `gmMapView` only.
 * Normalized rows: `maps`, `mapViews`, `gmActiveViewId`; `activeMapId` is derived from the active view.
 */

export const DEFAULT_LEGACY_MAP_ID = 'm-default';

/**
 * @param {string|null|undefined} mapId — `null`/`undefined` = legacy single-map placement (default map id)
 * @returns {string}
 */
export function effectiveTokenMapId(mapId) {
  return mapId ?? DEFAULT_LEGACY_MAP_ID;
}

export function newViewId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultMapRow(mc, id, name) {
  return {
    id,
    name: name || 'Map 1',
    mapImageUrl: mc.mapImageUrl ?? null,
    mapDimension: mc.mapDimension ?? 'width',
    mapSizeFt: mc.mapSizeFt ?? 100,
    mapImageNaturalWidth: mc.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: mc.mapImageNaturalHeight ?? null,
    shareWithPlayers: true,
  };
}

/**
 * Ensure `maps`, `mapViews`, `gmActiveViewId`, `activeMapId`; migrate from legacy `gmMapView` / `mapConfig`.
 * Mutates `state` in place (for attachDerivedMapConfig on server snapshots).
 * @param {object} state — table_state.data-like (may include legacy `mapConfig`)
 */
export function ensureMapStateShape(state) {
  if (!state || typeof state !== 'object') return state;
  const normalized = normalizeMapState(state);
  Object.assign(state, normalized);
  return state;
}

/**
 * Immutable: returns a shallow clone of state with `maps`, `mapViews`, `gmActiveViewId`, `activeMapId` normalized.
 * @param {object} state
 */
export function normalizeMapState(state) {
  if (!state || typeof state !== 'object') return state;
  const out = { ...state };
  const mc = out.mapConfig || {};

  if (!out.maps || !Array.isArray(out.maps) || out.maps.length === 0) {
    const id = DEFAULT_LEGACY_MAP_ID;
    out.maps = [defaultMapRow(mc, id, 'Map 1')];
    out.activeMapId = out.activeMapId && out.maps.some(m => m.id === out.activeMapId) ? out.activeMapId : id;
    out.gmMapView = {
      mapId: out.activeMapId,
      mapViewZoomRatio: mc.mapViewZoomRatio ?? null,
      mapViewPanNorm: mc.mapViewPanNorm ?? null,
    };
  } else {
    out.maps = out.maps.map(m => ({
      ...m,
      shareWithPlayers: m.shareWithPlayers !== false,
    }));
    if (!out.activeMapId || !out.maps.some(m => m.id === out.activeMapId)) {
      out.activeMapId = out.maps[0].id;
    }
    if (!out.gmMapView || typeof out.gmMapView !== 'object') {
      out.gmMapView = { mapId: out.activeMapId, mapViewZoomRatio: null, mapViewPanNorm: null };
    } else {
      out.gmMapView = { ...out.gmMapView };
      if (!out.maps.some(m => m.id === out.gmMapView.mapId)) {
        out.gmMapView.mapId = out.activeMapId;
      }
    }
  }

  // Build or validate mapViews + gmActiveViewId
  const maps = out.maps;
  const hasValidViews =
    Array.isArray(out.mapViews) &&
    out.mapViews.length > 0 &&
    out.mapViews.every(v => v && typeof v.mapId === 'string' && maps.some(m => m.id === v.mapId));

  if (!hasValidViews) {
    const gm = out.gmMapView || {};
    const legacyActive = out.activeMapId || maps[0].id;
    const mapViews = [];
    for (let i = 0; i < maps.length; i++) {
      const m = maps[i];
      const isFirstMap = i === 0;
      let mapViewZoomRatio = null;
      let mapViewPanNorm = null;
      if (gm.mapId === m.id) {
        mapViewZoomRatio = gm.mapViewZoomRatio ?? null;
        mapViewPanNorm = gm.mapViewPanNorm ?? null;
      } else if (maps.length === 1 && (!gm.mapId || gm.mapId === m.id)) {
        mapViewZoomRatio = mc.mapViewZoomRatio ?? null;
        mapViewPanNorm = mc.mapViewPanNorm ?? null;
      }
      mapViews.push({
        id: newViewId(),
        mapId: m.id,
        name: 'Main',
        mapViewZoomRatio,
        mapViewPanNorm,
        broadcastToPlayers: isFirstMap,
      });
    }
    out.mapViews = mapViews;
    const pick = mapViews.find(v => v.mapId === legacyActive) || mapViews[0];
    out.gmActiveViewId = pick.id;
  } else {
    out.mapViews = out.mapViews.map(v => ({
      ...v,
      name: (v.name && String(v.name).trim()) || 'View',
      broadcastToPlayers: !!v.broadcastToPlayers,
    }));
    const hasValidActiveId =
      out.gmActiveViewId != null && out.mapViews.some(v => v.id === out.gmActiveViewId);
    const gmMapFreeExplore =
      out.gmActiveViewId === null &&
      out.gmMapView &&
      typeof out.gmMapView.mapId === 'string' &&
      maps.some(m => m.id === out.gmMapView.mapId);
    if (!hasValidActiveId && !gmMapFreeExplore) {
      out.gmActiveViewId = out.mapViews[0].id;
    }
  }

  if (out.gmActiveViewId === null && out.gmMapView?.mapId && maps.some(m => m.id === out.gmMapView.mapId)) {
    out.activeMapId = out.gmMapView.mapId;
    out.gmMapView = {
      mapId: out.gmMapView.mapId,
      mapViewZoomRatio: out.gmMapView.mapViewZoomRatio ?? null,
      mapViewPanNorm: out.gmMapView.mapViewPanNorm ?? null,
    };
  } else {
    const activeView = out.mapViews.find(v => v.id === out.gmActiveViewId) || out.mapViews[0];
    out.activeMapId = activeView?.mapId ?? out.maps[0].id;
    out.gmMapView = {
      mapId: out.activeMapId,
      mapViewZoomRatio: activeView?.mapViewZoomRatio ?? null,
      mapViewPanNorm: activeView?.mapViewPanNorm ?? null,
    };
  }

  return out;
}

/**
 * Build legacy-shaped `mapConfig` for the active view's map + that view's zoom/pan.
 * @param {object} state — must have been passed through `ensureMapStateShape` / `normalizeMapState`
 */
export function deriveMapConfigFromState(state) {
  const s = normalizeMapState(state);
  if (s.gmActiveViewId === null && s.gmMapView?.mapId) {
    const map = s.maps.find(m => m.id === s.gmMapView.mapId) || s.maps[0];
    if (!map) {
      return {
        mapImageUrl: null,
        mapDimension: 'width',
        mapSizeFt: 100,
        mapImageNaturalWidth: null,
        mapImageNaturalHeight: null,
        mapViewZoomRatio: null,
        mapViewPanNorm: null,
      };
    }
    return {
      mapImageUrl: map.mapImageUrl ?? null,
      mapDimension: map.mapDimension ?? 'width',
      mapSizeFt: map.mapSizeFt ?? 100,
      mapImageNaturalWidth: map.mapImageNaturalWidth ?? null,
      mapImageNaturalHeight: map.mapImageNaturalHeight ?? null,
      mapViewZoomRatio: s.gmMapView.mapViewZoomRatio ?? null,
      mapViewPanNorm: s.gmMapView.mapViewPanNorm ?? null,
    };
  }
  const view = s.mapViews?.find(v => v.id === s.gmActiveViewId) || s.mapViews?.[0];
  const map = (view && s.maps.find(m => m.id === view.mapId)) || s.maps[0];
  if (!map) {
    return {
      mapImageUrl: null,
      mapDimension: 'width',
      mapSizeFt: 100,
      mapImageNaturalWidth: null,
      mapImageNaturalHeight: null,
      mapViewZoomRatio: null,
      mapViewPanNorm: null,
    };
  }
  return {
    mapImageUrl: map.mapImageUrl ?? null,
    mapDimension: map.mapDimension ?? 'width',
    mapSizeFt: map.mapSizeFt ?? 100,
    mapImageNaturalWidth: map.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: map.mapImageNaturalHeight ?? null,
    mapViewZoomRatio: view?.mapViewZoomRatio ?? null,
    mapViewPanNorm: view?.mapViewPanNorm ?? null,
  };
}

/**
 * Map image + default (null) framing for a map id — used for player “map tile” free explore.
 * @param {object} state — normalized table state shape
 * @param {string} mapId
 */
export function deriveMapConfigForMapId(state, mapId) {
  const s = normalizeMapState(state);
  const map = s.maps.find(m => m.id === mapId) || s.maps[0];
  if (!map) return deriveMapConfigFromState(s);
  return {
    mapImageUrl: map.mapImageUrl ?? null,
    mapDimension: map.mapDimension ?? 'width',
    mapSizeFt: map.mapSizeFt ?? 100,
    mapImageNaturalWidth: map.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: map.mapImageNaturalHeight ?? null,
    mapViewZoomRatio: null,
    mapViewPanNorm: null,
  };
}

/**
 * Player map area: derive `mapConfig` from a chosen view id (broadcast or personal).
 * @param {object} state — normalized table state
 * @param {string} viewId
 */
export function deriveMapConfigForViewId(state, viewId) {
  const s = normalizeMapState(state);
  const view = s.mapViews?.find(v => v.id === viewId);
  if (!view) return deriveMapConfigFromState(s);
  const map = s.maps.find(m => m.id === view.mapId) || s.maps[0];
  if (!map) return deriveMapConfigFromState(s);
  return {
    mapImageUrl: map.mapImageUrl ?? null,
    mapDimension: map.mapDimension ?? 'width',
    mapSizeFt: map.mapSizeFt ?? 100,
    mapImageNaturalWidth: map.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: map.mapImageNaturalHeight ?? null,
    mapViewZoomRatio: view.mapViewZoomRatio ?? null,
    mapViewPanNorm: view.mapViewPanNorm ?? null,
  };
}

/**
 * Attach `mapConfig` + ensure map fields on a resolved table state object (non-destructive).
 * @param {object} stateData — table_state.data-like
 * @returns {object}
 */
export function attachDerivedMapConfig(stateData) {
  if (!stateData || typeof stateData !== 'object') return stateData;
  const copy = normalizeMapState({ ...stateData });
  copy.mapConfig = deriveMapConfigFromState(copy);
  return copy;
}

export function newMapId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
