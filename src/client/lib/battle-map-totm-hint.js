/**
 * Theatre of the Mind overlay: show when there is no battle map image yet (runs in “theatre”
 * mode regardless of whether characters/adversaries are on the table or in trays).
 */

export function getGmTotMEmptyMapHint({ tableStateReady, mapConfigHasImage }) {
  return tableStateReady && !mapConfigHasImage;
}

export function getPlayerTotMEmptyMapHint({ tableStateReady, mapConfigHasImage }) {
  return tableStateReady && !mapConfigHasImage;
}
