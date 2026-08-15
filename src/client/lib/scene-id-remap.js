import { generateId } from './helpers.js';
import { newMapId, newViewId } from './map-table-state.js';

function remapRef(id, lookup) {
  if (id == null) return id;
  return lookup.has(id) ? lookup.get(id) : id;
}

/**
 * Deep-clone a scene snapshot and assign fresh map / view / element ids for
 * placing that scene onto a live table. Cross-references (`mapId`, `viewId`,
 * `parentInstanceId`, `minionGroupId`, countdown `sourceRef.elementInstanceId`) are rewritten
 * through the same old→new lookups. `mapImageUrl` strings are copied as-is.
 *
 * Capture ("Create Scene") keeps original ids; remap only at add-time.
 *
 * @param {object} sceneData
 * @returns {{ maps: object[], mapViews: object[], elements: object[], sessionCountdowns: object[] }}
 */
export function regenerateSceneIdsForTablePlacement(sceneData) {
  const src = sceneData && typeof sceneData === 'object' ? sceneData : {};
  const cloned = structuredClone({
    maps: Array.isArray(src.maps) ? src.maps : [],
    mapViews: Array.isArray(src.mapViews) ? src.mapViews : [],
    activeElements: Array.isArray(src.activeElements) ? src.activeElements : [],
    sessionCountdowns: Array.isArray(src.sessionCountdowns) ? src.sessionCountdowns : [],
  });

  const mapIdMap = new Map();
  for (const m of cloned.maps) {
    if (m && m.id != null) mapIdMap.set(m.id, newMapId());
  }
  const viewIdMap = new Map();
  for (const v of cloned.mapViews) {
    if (v && v.id != null) viewIdMap.set(v.id, newViewId());
  }
  const instanceIdMap = new Map();
  for (const el of cloned.activeElements) {
    if (el && el.instanceId != null) instanceIdMap.set(el.instanceId, generateId());
  }
  const minionGroupIdMap = new Map();
  for (const el of cloned.activeElements) {
    if (el && el.minionGroupId != null && !minionGroupIdMap.has(el.minionGroupId)) {
      minionGroupIdMap.set(el.minionGroupId, generateId());
    }
  }

  const maps = cloned.maps.map((m) => {
    if (!m || typeof m !== 'object') return m;
    return { ...m, id: m.id != null ? remapRef(m.id, mapIdMap) : m.id };
  });

  const mapViews = cloned.mapViews.map((v) => {
    if (!v || typeof v !== 'object') return v;
    return {
      ...v,
      id: v.id != null ? remapRef(v.id, viewIdMap) : v.id,
      mapId: remapRef(v.mapId, mapIdMap),
    };
  });

  const elements = cloned.activeElements.map((el) => {
    if (!el || typeof el !== 'object') return el;
    const next = { ...el };
    if (next.instanceId != null) next.instanceId = remapRef(next.instanceId, instanceIdMap);
    if ('mapId' in next) next.mapId = remapRef(next.mapId, mapIdMap);
    if ('viewId' in next) next.viewId = remapRef(next.viewId, viewIdMap);
    if (next.parentInstanceId != null) {
      next.parentInstanceId = remapRef(next.parentInstanceId, instanceIdMap);
    }
    if (next.minionGroupId != null) {
      next.minionGroupId = remapRef(next.minionGroupId, minionGroupIdMap);
    }
    return next;
  });

  const sessionCountdowns = cloned.sessionCountdowns.map((cd) => {
    if (!cd || typeof cd !== 'object') return cd;
    const next = { ...cd, id: generateId() };
    if ('mapId' in next) next.mapId = remapRef(next.mapId, mapIdMap);
    if ('viewId' in next) next.viewId = remapRef(next.viewId, viewIdMap);
    if (next.sourceRef && typeof next.sourceRef === 'object') {
      next.sourceRef = { ...next.sourceRef };
      if (next.sourceRef.elementInstanceId != null) {
        next.sourceRef.elementInstanceId = remapRef(next.sourceRef.elementInstanceId, instanceIdMap);
      }
    }
    return next;
  });

  return { maps, mapViews, elements, sessionCountdowns };
}
