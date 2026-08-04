/**
 * Map-state reconciliation helpers for `table_state` SSE snapshots (Fix 4 — client render costs).
 *
 * Every SSE tick delivers fresh `JSON.parse` results for `maps`, `mapViews`, and `mapConfig`,
 * so even an op that only moved a token would give these arrays/objects new identity, defeating
 * downstream `React.memo` keyed on those values. These helpers preserve the previous reference
 * when the incoming data is deep-equal to what was already in state, exactly mirroring the
 * pattern in `reconcile-active-elements.js`.
 */

/** Generic recursive deep-equal for plain JSON-shaped data (objects/arrays/primitives). */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;
  if (aIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Reconciles a `maps` array from an SSE snapshot against the previous state.
 * Maps are keyed by `id`. Items that are deep-equal to their previous counterpart
 * keep the previous object reference; if nothing changed at all the previous array
 * reference is returned so `setMaps` becomes a no-op re-render.
 *
 * @param {Array<object>|null|undefined} prevMaps Previous `maps` state.
 * @param {Array<object>|null|undefined} nextMaps New `maps` from an SSE snapshot.
 * @returns {Array<object>|null|undefined}
 */
export function reconcileMapsById(prevMaps, nextMaps) {
  if (!Array.isArray(nextMaps)) return nextMaps;
  if (!Array.isArray(prevMaps) || prevMaps.length === 0) return nextMaps;

  const prevById = new Map();
  for (const m of prevMaps) {
    if (m && m.id != null) prevById.set(m.id, m);
  }

  const reconciled = nextMaps.map((nextM) => {
    if (!nextM || nextM.id == null) return nextM;
    const prevM = prevById.get(nextM.id);
    if (!prevM || prevM === nextM) return prevM || nextM;
    return deepEqual(prevM, nextM) ? prevM : nextM;
  });

  if (
    reconciled.length === prevMaps.length &&
    reconciled.every((m, i) => m === prevMaps[i])
  ) {
    return prevMaps;
  }
  return reconciled;
}

/**
 * Reconciles a `mapViews` array from an SSE snapshot against the previous state.
 * Identical contract to `reconcileMapsById` — keyed by `id`.
 *
 * @param {Array<object>|null|undefined} prevMapViews
 * @param {Array<object>|null|undefined} nextMapViews
 * @returns {Array<object>|null|undefined}
 */
export function reconcileMapViewsById(prevMapViews, nextMapViews) {
  if (!Array.isArray(nextMapViews)) return nextMapViews;
  if (!Array.isArray(prevMapViews) || prevMapViews.length === 0) return nextMapViews;

  const prevById = new Map();
  for (const v of prevMapViews) {
    if (v && v.id != null) prevById.set(v.id, v);
  }

  const reconciled = nextMapViews.map((nextV) => {
    if (!nextV || nextV.id == null) return nextV;
    const prevV = prevById.get(nextV.id);
    if (!prevV || prevV === nextV) return prevV || nextV;
    return deepEqual(prevV, nextV) ? prevV : nextV;
  });

  if (
    reconciled.length === prevMapViews.length &&
    reconciled.every((v, i) => v === prevMapViews[i])
  ) {
    return prevMapViews;
  }
  return reconciled;
}

/**
 * Reconciles a single `mapConfig` object. Returns `prevMapConfig` when the incoming
 * value is deep-equal so the React state update is a no-op.
 *
 * @param {object} prevMapConfig Current `mapConfig` in React state.
 * @param {object} nextMapConfig Incoming merged mapConfig (already spread with DEFAULT_MAP_CONFIG).
 * @returns {object}
 */
export function reconcileMapConfig(prevMapConfig, nextMapConfig) {
  if (deepEqual(prevMapConfig, nextMapConfig)) return prevMapConfig;
  return nextMapConfig;
}
