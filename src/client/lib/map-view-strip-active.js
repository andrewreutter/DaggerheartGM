/**
 * Selection highlighting for map/camera picker tiles (BattleMap).
 * Full-map tile and a named view tile must never both read as "active" at once.
 */

export function gmMapStripFullMapTileActive({ gmActiveViewId, mapId, activeMapIdResolved }) {
  return gmActiveViewId === null && mapId === activeMapIdResolved;
}

export function playerMapStripFullMapTileActive({
  playerFreeMapExplore,
  playerFreeExploreMapId,
  mapId,
}) {
  return playerFreeMapExplore && playerFreeExploreMapId === mapId;
}
