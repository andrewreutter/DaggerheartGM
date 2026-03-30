import { effectiveTokenMapId } from './map-table-state.js';

/**
 * Left shelf entries for character tokens: unplaced first, then on the active map (dim proxies),
 * then on other maps (dim proxies — click switches map in BattleMap).
 * @param {object[]} characters
 * @param {string} activeMapIdResolved
 * @param {(el: object) => boolean} isMyCharacter
 */
export function buildCharacterTrayTokenEntries(characters, activeMapIdResolved, isMyCharacter) {
  const inTray = [];
  const onActive = [];
  const onOther = [];
  for (const el of characters) {
    const mine = isMyCharacter(el);
    if (el.tokenX == null) {
      inTray.push({
        element: el,
        instanceNum: null,
        isMyCharacter: mine,
        isProxy: false,
        isOtherMapShelf: false,
      });
      continue;
    }
    const mid = effectiveTokenMapId(el.mapId);
    if (mid === activeMapIdResolved) {
      onActive.push({
        element: el,
        instanceNum: null,
        isMyCharacter: mine,
        isProxy: true,
        isOtherMapShelf: false,
      });
    } else {
      onOther.push({
        element: el,
        instanceNum: null,
        isMyCharacter: mine,
        isProxy: true,
        isOtherMapShelf: true,
      });
    }
  }
  const byName = (a, b) =>
    String(a.element.name || '').localeCompare(String(b.element.name || ''), undefined, { sensitivity: 'base' });
  inTray.sort(byName);
  onActive.sort(byName);
  onOther.sort(byName);
  return [...inTray, ...onActive, ...onOther];
}
