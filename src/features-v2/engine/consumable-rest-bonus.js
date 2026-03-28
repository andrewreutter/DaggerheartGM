/**
 * Consumables that set `restBonusActive` on `featureState['consumables:<id>']` (e.g. Potion of Stability).
 * Host / loader scan this shape without duplicating regex orchestration.
 */

/**
 * @param {object} [featureState]
 * @param {(scopeKey: string, bag: object) => void} fn
 */
export function forEachConsumableRestBonusPending(featureState, fn) {
  if (!featureState || typeof featureState !== 'object' || typeof fn !== 'function') return;
  for (const [k, bag] of Object.entries(featureState)) {
    if (!k.startsWith('consumables:')) continue;
    if (bag && typeof bag === 'object' && bag.restBonusActive === true) fn(k, bag);
  }
}

/** @param {object} [featureState] */
export function hasConsumableRestBonusPending(featureState) {
  let hit = false;
  forEachConsumableRestBonusPending(featureState, () => {
    hit = true;
  });
  return hit;
}

/**
 * Returns a new `featureState` object with `restBonusActive` cleared from consumable scope bags, or `null` if unchanged.
 * @param {object} [featureState]
 */
export function stripConsumableRestBonusPending(featureState) {
  if (!featureState || typeof featureState !== 'object') return null;
  let nextFs = null;
  forEachConsumableRestBonusPending(featureState, (k, bag) => {
    if (!nextFs) nextFs = { ...featureState };
    const { restBonusActive: _rb, ...restBag } = bag;
    if (Object.keys(restBag).length === 0) delete nextFs[k];
    else nextFs[k] = restBag;
  });
  return nextFs;
}
