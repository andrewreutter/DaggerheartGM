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
 * Player map strip (map tiles + saved cameras): only useful when there is more than one choice.
 * @param {number} tileCount — {@link countPlayerMapStripTiles}
 */
export function shouldShowPlayerMapViewStrip(tileCount) {
  return tileCount > 1;
}
