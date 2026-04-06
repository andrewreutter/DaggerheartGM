/**
 * Gating for applying GM-synced map view (`decodeMapViewState`) on the player client.
 * When the player chose the map tile (free pan/zoom, not a broadcast view), remote GM framing is not applied.
 *
 * @param {boolean} isPlayer
 * @param {boolean} [playerFreeMapExplore]
 * @returns {boolean}
 */
export function shouldApplyRemotePlayerMapView(isPlayer, playerFreeMapExplore = false) {
  return !isPlayer || !playerFreeMapExplore;
}

/**
 * True when a decoded map view resolves to the origin (top-left).
 * Small epsilon avoids flapping on sub-pixel decode differences.
 *
 * @param {{ scrollLeft?: number, scrollTop?: number } | null | undefined} decoded
 * @returns {boolean}
 */
export function isDecodedMapViewAtOrigin(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;
  return Math.abs(decoded.scrollLeft ?? 0) < 0.5 && Math.abs(decoded.scrollTop ?? 0) < 0.5;
}

/**
 * When a player returns to a GM camera they just left, prefer the last non-origin framing they already saw
 * over a transient 0,0 decode for that same camera.
 *
 * @param {object} p
 * @param {boolean} p.switchedViews
 * @param {{ scrollLeft?: number, scrollTop?: number } | null | undefined} p.liveDecoded
 * @param {{ scrollLeft?: number, scrollTop?: number } | null | undefined} p.cachedDecoded
 * @returns {boolean}
 */
export function shouldPreferCachedPlayerRemoteView({
  switchedViews = false,
  liveDecoded = null,
  cachedDecoded = null,
}) {
  if (!switchedViews || !cachedDecoded) return false;
  if (!liveDecoded) return true;
  return isDecodedMapViewAtOrigin(liveDecoded) && !isDecodedMapViewAtOrigin(cachedDecoded);
}

/**
 * Whether a player may use a GM "forced" map selection (same rules as strip tiles).
 * Named views: only the view's broadcast flag matters (parent map share is irrelevant).
 * Free-map tile: map must be shared with players (`shareWithPlayers`).
 * @param {{ maps: Array<{ id: string, shareWithPlayers?: boolean }>, mapViews: Array<{ id: string, mapId: string, broadcastToPlayers?: boolean }> }} tableLike
 * @param {{ viewId?: string | null, freeMapExploreMapId?: string | null }} focus
 */
export function playerCanAccessMapViewSelection(tableLike, focus) {
  const { maps = [], mapViews = [] } = tableLike || {};
  if (focus?.viewId) {
    const v = mapViews.find((x) => x.id === focus.viewId);
    if (!v || !v.broadcastToPlayers) return false;
    return maps.some((x) => x.id === v.mapId);
  }
  if (focus?.freeMapExploreMapId) {
    const m = maps.find((x) => x.id === focus.freeMapExploreMapId);
    return !!(m && m.shareWithPlayers !== false);
  }
  return false;
}

/**
 * @param {string|null|undefined} freeExploreMapId
 * @param {boolean} playerFreeMapExplore
 * @param {Array<{ id: string, shareWithPlayers?: boolean }>} maps
 */
export function freeMapExploreTargetsUnsharedMap(freeExploreMapId, playerFreeMapExplore, maps) {
  if (!playerFreeMapExplore || !freeExploreMapId || !maps?.length) return false;
  const map = maps.find((m) => m.id === freeExploreMapId);
  return !!(map && map.shareWithPlayers === false);
}

/**
 * Selectable tiles on the player map strip: optional free-map tile per batch, GM views.
 *
 * @param {Array<{ map: { shareWithPlayers?: boolean }, gmViews: unknown[] }>} playerViewBatches
 */
export function countPlayerMapStripTiles(playerViewBatches) {
  let n = 0;
  for (const { map: m, gmViews } of playerViewBatches) {
    if (m.shareWithPlayers !== false) n += 1;
    n += gmViews.length;
  }
  return n;
}

/**
 * Player map/camera strip: show only when there is more than one selectable tile.
 * A single tile (map-only, or one camera only, etc.) needs no switcher UI.
 *
 * @param {Array<{ map: { shareWithPlayers?: boolean }, gmViews: unknown[] }>} playerViewBatches
 */
export function shouldShowPlayerMapViewStrip(playerViewBatches) {
  return countPlayerMapStripTiles(playerViewBatches) >= 2;
}
