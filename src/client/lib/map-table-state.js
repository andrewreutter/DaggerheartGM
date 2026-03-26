/**
 * Multi-map + GM broadcast camera (zoom/pan) shared state.
 * Legacy single-map rows use `mapConfig` only; normalized rows use `maps`, `activeMapId`, `gmMapView`.
 */

export const DEFAULT_LEGACY_MAP_ID = 'm-default';

/**
 * @param {string|null|undefined} mapId — `null`/`undefined` = legacy single-map placement (default map id)
 * @returns {string}
 */
export function effectiveTokenMapId(mapId) {
  return mapId ?? DEFAULT_LEGACY_MAP_ID;
}

/**
 * Ensure `maps`, `activeMapId`, `gmMapView` exist; migrate from legacy `mapConfig` when needed.
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
 * Immutable: returns a shallow clone of state with `maps`, `activeMapId`, `gmMapView` normalized.
 * @param {object} state
 */
export function normalizeMapState(state) {
  if (!state || typeof state !== 'object') return state;
  const out = { ...state };
  if (!out.maps || !Array.isArray(out.maps) || out.maps.length === 0) {
    const mc = out.mapConfig || {};
    const id = DEFAULT_LEGACY_MAP_ID;
    out.maps = [
      {
        id,
        name: 'Map 1',
        mapImageUrl: mc.mapImageUrl ?? null,
        mapDimension: mc.mapDimension ?? 'width',
        mapSizeFt: mc.mapSizeFt ?? 100,
        mapImageNaturalWidth: mc.mapImageNaturalWidth ?? null,
        mapImageNaturalHeight: mc.mapImageNaturalHeight ?? null,
      },
    ];
    out.activeMapId =
      out.activeMapId && out.maps.some(m => m.id === out.activeMapId) ? out.activeMapId : id;
    out.gmMapView = {
      mapId: out.activeMapId,
      mapViewZoomRatio: mc.mapViewZoomRatio ?? null,
      mapViewPanNorm: mc.mapViewPanNorm ?? null,
    };
  } else {
    out.maps = out.maps.map(m => ({ ...m }));
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
  return out;
}

/**
 * Build legacy-shaped `mapConfig` for the active map + GM broadcast framing when it targets that map.
 * @param {object} state — must have been passed through `ensureMapStateShape`
 */
export function deriveMapConfigFromState(state) {
  const s = state.maps?.length ? state : normalizeMapState(state);
  const map = s.maps.find(m => m.id === s.activeMapId) || s.maps[0];
  const gv = s.gmMapView || {};
  const viewMatches = gv.mapId === s.activeMapId;
  return {
    mapImageUrl: map.mapImageUrl ?? null,
    mapDimension: map.mapDimension ?? 'width',
    mapSizeFt: map.mapSizeFt ?? 100,
    mapImageNaturalWidth: map.mapImageNaturalWidth ?? null,
    mapImageNaturalHeight: map.mapImageNaturalHeight ?? null,
    mapViewZoomRatio: viewMatches ? gv.mapViewZoomRatio ?? null : null,
    mapViewPanNorm: viewMatches ? gv.mapViewPanNorm ?? null : null,
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
