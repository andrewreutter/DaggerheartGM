/**
 * Helpers for the GM Load Scene dialog (Replace vs Add, optional scene factors)
 * and authored Next Scenes (`[{ id, name }]` on the scene row and `table_state`).
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
 * Normalize authored / persisted Next Scenes to `{ id, name }[]`.
 * Drops empties and duplicate ids (first name wins). Bare id strings are kept.
 *
 * @param {unknown} value
 * @returns {Array<{ id: string, name: string }>}
 */
export function normalizeNextScenes(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const row of value) {
    if (typeof row === 'string') {
      const id = row.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: id });
      continue;
    }
    if (!row || typeof row !== 'object') continue;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id;
    out.push({ id, name });
  }
  return out;
}

/**
 * Build the table op for placing a remapped scene snapshot.
 * Scene `partySize` / `partyTier` are intentionally omitted — the live table
 * uses its actual PC count and highest character tier for BP and minion-group
 * reconcile. `nextScenes` is always written (even `[]`) so a load replaces
 * the table's previous Next Scenes list.
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
    nextScenes: normalizeNextScenes(scene?.nextScenes),
  };
  if (applySceneBattleMods) {
    const mods = sceneBattleMods(scene);
    if (mods) op.tableBattleMods = { ...mods };
  }
  return op;
}
