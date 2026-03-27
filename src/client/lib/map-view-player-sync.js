/**
 * Gating for applying GM-synced map view (`decodeMapViewState`) on the player client.
 * When the player is viewing a personal camera (non-null id), remote GM framing is not applied.
 * When the player chose the map tile (free pan/zoom, not a broadcast view), remote GM framing is not applied.
 *
 * @param {boolean} isPlayer
 * @param {string|null|undefined} activePersonalCameraId — set when the player is editing a personal camera
 * @param {boolean} [playerFreeMapExplore]
 * @returns {boolean}
 */
export function shouldApplyRemotePlayerMapView(isPlayer, activePersonalCameraId, playerFreeMapExplore = false) {
  return !isPlayer || (!activePersonalCameraId && !playerFreeMapExplore);
}

/**
 * When a map is un-shared (`shareWithPlayers: false`), players must not keep personal framing for that map.
 *
 * @param {string|null|undefined} activeCameraId
 * @param {Array<{ id: string, mapId: string }>} personalCameras
 * @param {Array<{ id: string, shareWithPlayers?: boolean }>} maps
 */
export function personalCameraTargetsUnsharedMap(activeCameraId, personalCameras, maps) {
  if (!activeCameraId || !maps?.length) return false;
  const cam = personalCameras.find((c) => c.id === activeCameraId);
  if (!cam) return false;
  const map = maps.find((m) => m.id === cam.mapId);
  return !!(map && map.shareWithPlayers === false);
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
