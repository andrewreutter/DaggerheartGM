/**
 * Theatre of the Mind empty-map overlay: no map image and no combatants on the table.
 * Uses character + adversary counts from `activeElements` (not tray/map token lists — those
 * can miss elements when map/plane resolution does not match `activeMapIdResolved`).
 */

export function getGmTotMEmptyMapHint({
  tableStateReady,
  mapConfigHasImage,
  characterCount,
  adversaryCount,
}) {
  return (
    tableStateReady &&
    !mapConfigHasImage &&
    characterCount === 0 &&
    adversaryCount === 0
  );
}

export function getPlayerTotMEmptyMapHint({
  tableStateReady,
  mapConfigHasImage,
  characterCount,
  adversaryCount,
}) {
  return (
    tableStateReady &&
    !mapConfigHasImage &&
    characterCount === 0 &&
    adversaryCount === 0
  );
}
