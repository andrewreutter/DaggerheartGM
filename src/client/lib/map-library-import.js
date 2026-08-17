/**
 * Auto-import table `maps[]` into the owner's library.
 * Dedupe by `mapImageUrl`; blanks never share a library row. Richest candidate
 * supplies library defaults; each table row still keeps its own cameras/overlays.
 */

import { generateId } from './helpers.js';
import { libraryMapImageUrl, tableMapToLibraryItem } from './map-library.js';

const GENERIC_MAP_NAME_RE = /^map\s+\d+$/i;

export function isGenericMapName(name) {
  return typeof name === 'string' && GENERIC_MAP_NAME_RE.test(name.trim());
}

/**
 * Higher is richer. Named > generic “Map N”; +artist; +views; +overlay/dressing; +image.
 * @param {object} map
 * @param {{ viewCount?: number, overlay?: boolean, dressingCount?: number }} [extra]
 */
export function scoreMapRichness(map, extra = {}) {
  const name = typeof map?.name === 'string' ? map.name.trim() : '';
  const hasImage = Boolean(libraryMapImageUrl(map));
  const hasArtist = Boolean(typeof map?.artist === 'string' && map.artist.trim());
  const viewCount = Number(extra.viewCount) || 0;
  const dressingCount = Number(extra.dressingCount) || 0;
  const overlay = extra.overlay === true || Boolean(map?.overlayPng);
  let score = 0;
  if (name && !isGenericMapName(name)) score += 40;
  else if (name) score += 5;
  if (hasArtist) score += 15;
  if (hasImage) score += 20;
  score += Math.min(viewCount, 8) * 4;
  if (overlay) score += 10;
  score += Math.min(dressingCount, 12) * 2;
  return score;
}

/**
 * @param {Array<{ map: object, viewCount?: number, overlay?: boolean, dressingCount?: number }>} candidates
 */
export function pickRichestMapForUrl(candidates) {
  const list = Array.isArray(candidates) ? candidates.filter((c) => c?.map) : [];
  if (list.length === 0) return null;
  let best = list[0];
  let bestScore = scoreMapRichness(best.map, best);
  for (let i = 1; i < list.length; i++) {
    const s = scoreMapRichness(list[i].map, list[i]);
    if (s > bestScore) {
      best = list[i];
      bestScore = s;
    }
  }
  return best.map;
}

function viewCountForMap(mapViews, mapId) {
  return (Array.isArray(mapViews) ? mapViews : []).filter((v) => v && v.mapId === mapId).length;
}

function dressingCountForMap(elements, mapId) {
  return (Array.isArray(elements) ? elements : []).filter((el) => (
    el
    && (el.elementType === 'mapImage' || el.elementType === 'drawShape')
    && (el.mapId == null || el.mapId === mapId)
  )).length;
}

/**
 * Plan library creates + table links for maps missing `libraryMapId`.
 * Image URLs already in `existingLibraryByUrl` are linked, not recreated.
 * Blanks always create a new library row.
 *
 * @param {object[]} maps
 * @param {{
 *   existingLibraryByUrl?: Map<string, object>|Record<string, object>,
 *   mapViews?: object[],
 *   elements?: object[],
 * }} [opts]
 * @returns {{ create: object[], link: Array<{ mapId: string, libraryMapId: string }> }}
 */
export function planTableMapLibraryImport(maps, opts = {}) {
  const existing = opts.existingLibraryByUrl instanceof Map
    ? opts.existingLibraryByUrl
    : new Map(Object.entries(opts.existingLibraryByUrl || {}));
  const mapViews = opts.mapViews || [];
  const elements = opts.elements || [];
  const create = [];
  const link = [];
  const urlToNewId = new Map();

  const pending = (Array.isArray(maps) ? maps : []).filter((m) => m && !m.libraryMapId);
  const byUrl = new Map();
  const blanks = [];
  for (const m of pending) {
    const url = libraryMapImageUrl(m);
    if (!url) {
      blanks.push(m);
      continue;
    }
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(m);
  }

  for (const [url, group] of byUrl) {
    const existingRow = existing.get(url);
    if (existingRow?.id) {
      for (const m of group) {
        link.push({ mapId: m.id, libraryMapId: existingRow.id });
      }
      continue;
    }
    if (urlToNewId.has(url)) {
      const libraryMapId = urlToNewId.get(url);
      for (const m of group) link.push({ mapId: m.id, libraryMapId });
      continue;
    }
    const candidates = group.map((m) => ({
      map: m,
      viewCount: viewCountForMap(mapViews, m.id),
      overlay: Boolean(m.overlayPng),
      dressingCount: dressingCountForMap(elements, m.id),
    }));
    const richest = pickRichestMapForUrl(candidates);
    const libraryId = generateId();
    urlToNewId.set(url, libraryId);
    create.push(tableMapToLibraryItem(richest, {
      id: libraryId,
      mapViews,
      dressingElements: elements,
    }));
    for (const m of group) {
      link.push({ mapId: m.id, libraryMapId: libraryId });
    }
  }

  for (const m of blanks) {
    const libraryId = generateId();
    create.push(tableMapToLibraryItem(m, {
      id: libraryId,
      mapViews,
      dressingElements: elements,
    }));
    link.push({ mapId: m.id, libraryMapId: libraryId });
  }

  return { create, link };
}
