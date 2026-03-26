import { buildFeatureCardModelForCharacter } from './build-feature-card-model.js';

/**
 * Whether a V2 action card chip belongs in the "Used or too costly" subsection
 * (sheet Actions strip / expanded card chip rows) vs the primary chip row.
 *
 * @param {object} params
 * @param {boolean} params.usedThisCycle — frequency-gated chip already used this session/rest/long-rest cycle
 * @param {boolean} params.resourceUnaffordable — engine: Hope/Stress/Armor costs cannot be paid
 */
export function shouldMoveV2ActionChipToUnusableSubsection({ usedThisCycle, resourceUnaffordable }) {
  return !!(usedThisCycle || resourceUnaffordable);
}

/**
 * Whether the sheet Actions strip should show the global "Used or too costly" block
 * (at least one chip is used-this-cycle or unaffordable). Mirrors {@link GuideFeatureCardChips} placement rules.
 *
 * @param {Array<{ row: object, key: string }>} entries — guide or loadout entries with card chips
 */
export function hasAnyUnusableActionChipsForSheet(entries, el, v2TableContext) {
  if (!entries?.length) return false;
  for (const entry of entries) {
    const { model } = buildFeatureCardModelForCharacter(entry.row, el, v2TableContext);
    const effectiveKey = entry.key || model.name;
    const isUsed = !!(el?.featureUsage?.[effectiveKey]?.used);
    for (const chip of model.cardChips || []) {
      const chipUsed = !!(chip.frequency && isUsed);
      const resourceUnaffordable = !!chip.resourceUnaffordable;
      if (shouldMoveV2ActionChipToUnusableSubsection({ usedThisCycle: chipUsed, resourceUnaffordable })) {
        return true;
      }
    }
  }
  return false;
}

/** True if this guide/loadout row contributes at least one used-or-unaffordable chip. */
export function entryHasUnusableActionChipsForSheet(entry, el, v2TableContext) {
  return hasAnyUnusableActionChipsForSheet([entry], el, v2TableContext);
}
