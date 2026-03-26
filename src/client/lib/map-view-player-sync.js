/**
 * Gating for applying GM-synced map view (`decodeMapViewState`) on the player client.
 * When the player adjusts pan/zoom locally, remote updates are skipped until they choose to follow the GM again.
 *
 * @param {boolean} isPlayer
 * @param {boolean} localOverrideActive
 * @returns {boolean}
 */
export function shouldApplyRemotePlayerMapView(isPlayer, localOverrideActive) {
  return !isPlayer || !localOverrideActive;
}
