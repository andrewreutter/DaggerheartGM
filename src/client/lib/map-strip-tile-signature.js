import { effectiveTokenMapId } from './map-table-state.js';

/**
 * Lightweight signature of the on-map tokens that could affect a `MapViewStripTile`'s rendered
 * `ThumbViewportTokenProxies` (position, name/label, defeated state) for one specific map.
 *
 * Used as a cheap stand-in for `activeElements` in a `React.memo` comparator: `activeElements`
 * gets a new array/object identity on every `table_state` SSE snapshot even when nothing relevant
 * to a given map strip tile changed (e.g. an adversary token drag on a *different* map, or a
 * countdown/note edit), so comparing this string avoids re-rendering — and re-scanning
 * `activeElements` again inside `getThumbViewportTokenProxies` — for every tile on every tick.
 *
 * Over-inclusive by design: includes every token on `stripMapId`, not just ones within the current
 * thumb viewport (that culling is view-dependent and already recomputed inside the component when
 * this signature does change). Never omits a token that could affect rendering.
 *
 * @param {object[]|null|undefined} activeElements
 * @param {string|null|undefined} stripMapId
 * @returns {string}
 */
export function buildMapStripTileTokenSignature(activeElements, stripMapId) {
  if (stripMapId == null || !Array.isArray(activeElements)) return '';
  let sig = '';
  for (const el of activeElements) {
    if (el.elementType !== 'character' && el.elementType !== 'adversary' && el.elementType !== 'boardToken') continue;
    if (el.tokenX == null || el.tokenY == null) continue;
    if (effectiveTokenMapId(el.mapId) !== stripMapId) continue;
    sig += `|${el.instanceId}:${el.elementType}:${el.tokenX},${el.tokenY}:${el.name ?? el.label ?? ''}:${el.currentHp ?? ''}:${el.hp_max ?? ''}`;
  }
  return sig;
}
