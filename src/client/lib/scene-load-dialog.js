/**
 * Helpers for the GM Load Scene dialog (Replace vs Add, optional scene factors).
 */

export const SCENE_BATTLE_MOD_KEYS = [
  'lessDifficult',
  'slightlyMoreDangerous',
  'damageBoostPlusOne',
  'damageBoostD4',
  'damageBoostStatic',
  'moreDangerous',
];

/** @param {object} [scene] */
export function sceneBattleMods(scene) {
  if (!scene || typeof scene !== 'object') return null;
  return scene.tableBattleMods || scene.battleMods || null;
}

/** @param {object} [scene] */
export function sceneHasActiveBattleMods(scene) {
  const mods = sceneBattleMods(scene);
  if (!mods) return false;
  return SCENE_BATTLE_MOD_KEYS.some((k) => mods[k]);
}

/**
 * Load Scene / Add-to-Table for scenes always offers Replace vs Add
 * (GM-only path; players never call this).
 *
 * @param {string} collectionName
 * @returns {boolean}
 */
export function shouldOfferReplaceOrAdd(collectionName) {
  return collectionName === 'scenes';
}

/**
 * Build the table op for placing a remapped scene snapshot.
 * Scene `partySize` / `partyTier` are intentionally omitted — the live table
 * uses its actual PC count and highest character tier for BP and minion-group
 * reconcile.
 *
 * @param {{
 *   mode: 'add' | 'replace',
 *   remapped: { maps?: object[], mapViews?: object[], elements?: object[], sessionCountdowns?: object[] },
 *   applySceneBattleMods?: boolean,
 *   scene?: object,
 * }} opts
 */
export function buildSceneSnapshotTableOp({ mode, remapped, applySceneBattleMods, scene }) {
  const src = remapped && typeof remapped === 'object' ? remapped : {};
  const op = {
    op: mode === 'replace' ? 'replace-scene-snapshot' : 'add-scene-snapshot',
    maps: src.maps,
    mapViews: src.mapViews,
    elements: src.elements,
    sessionCountdowns: src.sessionCountdowns,
  };
  if (applySceneBattleMods) {
    const mods = sceneBattleMods(scene);
    if (mods) op.tableBattleMods = { ...mods };
  }
  return op;
}
