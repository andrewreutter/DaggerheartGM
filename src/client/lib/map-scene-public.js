/**
 * Scene publish gate: every referenced library Map must be public.
 */

/**
 * @param {object} scene
 * @param {Map<string, object>|Record<string, object>} mapsById
 * @returns {Array<{ id: string, name: string }>}
 */
export function collectPrivateReferencedMaps(scene, mapsById) {
  const lookup = mapsById instanceof Map
    ? mapsById
    : new Map(Object.entries(mapsById || {}));
  const seen = new Set();
  const out = [];
  const maps = Array.isArray(scene?.maps) ? scene.maps : [];
  for (const m of maps) {
    const id = m?.libraryMapId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const lib = lookup.get(id);
    if (!lib) {
      out.push({ id, name: (m.name && String(m.name).trim()) || id });
      continue;
    }
    if (lib.is_public === true) continue;
    out.push({
      id,
      name: (lib.name && String(lib.name).trim()) || (m.name && String(m.name).trim()) || id,
    });
  }
  return out;
}

/** @param {object} scene @param {Map<string, object>|Record<string, object>} mapsById */
export function sceneCanBePublic(scene, mapsById) {
  return collectPrivateReferencedMaps(scene, mapsById).length === 0;
}
