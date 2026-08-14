/**
 * Tray proxy hover → map bullseye snap helpers.
 *
 * Dim tray proxies stand in for tokens already placed on a map. Hovering an
 * active-map proxy should snap the range-band bullseye (and related highlights)
 * as if the pointer were over that token on the map.
 */

/**
 * @param {{ isProxy?: boolean, isOtherMapShelf?: boolean }} entry
 * @returns {boolean} true when this tray entry is a proxy for a token on the
 *   active map/camera (not unplaced, not another map's shelf).
 */
export function trayProxyShouldSnapBullseye({ isProxy, isOtherMapShelf } = {}) {
  return !!isProxy && !isOtherMapShelf;
}

/**
 * Build the same bullseye snap payload used when hovering a placed map token.
 *
 * @param {{ instanceId: string, tokenX?: number|null, tokenY?: number|null, altitude?: number|null }|null|undefined} element
 * @param {{ halfWidth: number, halfLength: number }|null|undefined} footprint
 * @returns {{ x: number, y: number, altitude: number, excludeInstanceId: string }|null}
 */
export function bullseyeFtForPlacedTokenHover(element, footprint) {
  if (!element || element.tokenX == null || element.tokenY == null || !footprint) return null;
  return {
    x: element.tokenX + footprint.halfWidth,
    y: element.tokenY + footprint.halfLength,
    altitude: element.altitude ?? 0,
    excludeInstanceId: element.instanceId,
  };
}
