/**
 * Selection highlighting for map/view strip tiles (BattleMap).
 * Full-map tile and a named view tile must never both read as "active" at once.
 */

export function gmMapStripFullMapTileActive({ gmActiveViewId, mapId, activeMapIdResolved }) {
  return gmActiveViewId === null && mapId === activeMapIdResolved;
}

export function playerMapStripFullMapTileActive({
  playerActivePersonalCameraId,
  playerFreeMapExplore,
  playerFreeExploreMapId,
  mapId,
}) {
  return (
    !playerActivePersonalCameraId &&
    playerFreeMapExplore &&
    playerFreeExploreMapId === mapId
  );
}
