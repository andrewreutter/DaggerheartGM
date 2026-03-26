/**
 * Whether the sheet Actions strip should show (any Features or LOADOUT row has V2 card chips).
 * Pure — safe for unit tests.
 */

import { getOrderedGuideFeatureEntries, getOrderedGuideLoadoutEntries } from './guide-feature-entries.js';
import { buildFeatureCardModelForCharacter } from './build-feature-card-model.js';

/** @returns {boolean} */
export function characterHasFeatureCardActions(el, onV2CardChip, v2TableContext) {
  const orderedEntries = getOrderedGuideFeatureEntries(el, onV2CardChip);
  for (const e of orderedEntries) {
    if (e.kind !== 'guide') continue;
    const { model } = buildFeatureCardModelForCharacter(e.row, el, v2TableContext);
    if (model.cardChips?.length) return true;
  }
  for (const e of getOrderedGuideLoadoutEntries(el)) {
    const { model } = buildFeatureCardModelForCharacter(e.row, el, v2TableContext);
    if (model.cardChips?.length) return true;
  }
  return false;
}

/** Any LOADOUT (domain) card exposes V2 card chips — drives emphasis shell + hideV2CardChips on LOADOUT. */
export function characterHasLoadoutCardActions(el, v2TableContext) {
  for (const e of getOrderedGuideLoadoutEntries(el)) {
    const { model } = buildFeatureCardModelForCharacter(e.row, el, v2TableContext);
    if (model.cardChips?.length) return true;
  }
  return false;
}
