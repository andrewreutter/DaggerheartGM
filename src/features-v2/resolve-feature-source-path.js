/**
 * Resolves a relative path under `src/features-v2/` for viewing feature implementation source.
 * Uses generated maps from {@link ../scripts/gen-feature-source-paths.mjs}.
 */

import {
  pathByAbilityId,
  pathByAncestryKey,
  pathByArmorPropertyName,
  pathByBeastformId,
  pathByClassId,
  pathByCommunityId,
  pathByConsumableId,
  pathByItemId,
  pathBySubclassId,
  pathByWeaponPropertyName,
} from './generated/feature-source-paths.js';

/**
 * @param {object} featRow — merged activeFeatures row (GuideFeatureCard / engine)
 * @returns {string|null} relative path like `classes/Bard.js`, or null if unknown
 */
export function resolveV2FeatureSourcePath(featRow) {
  if (!featRow || typeof featRow !== 'object') return null;

  const src = featRow._source;
  const scope = featRow._sourceScopeKey;
  if (typeof scope !== 'string' || !scope.includes(':')) {
    if (src === 'weapon_property' && typeof featRow.name === 'string') {
      return pathByWeaponPropertyName[featRow.name] ?? null;
    }
    if (src === 'armor_property' && typeof featRow.name === 'string') {
      return pathByArmorPropertyName[featRow.name] ?? null;
    }
    return null;
  }

  const colon = scope.indexOf(':');
  const collection = scope.slice(0, colon);
  const id = scope.slice(colon + 1);

  switch (collection) {
    case 'abilities':
      return pathByAbilityId[id] ?? null;
    case 'classes':
      return pathByClassId[id] ?? null;
    case 'subclasses':
      return pathBySubclassId[id] ?? null;
    case 'ancestries':
      return pathByAncestryKey[id] ?? null;
    case 'communities':
      return pathByCommunityId[id] ?? null;
    case 'items':
      return pathByItemId[id] ?? null;
    case 'consumables':
      return pathByConsumableId[id] ?? null;
    case 'beastforms':
      return pathByBeastformId[id] ?? null;
    case 'weapons':
      return typeof featRow.name === 'string' ? pathByWeaponPropertyName[featRow.name] ?? null : null;
    case 'armor':
      return typeof featRow.name === 'string' ? pathByArmorPropertyName[featRow.name] ?? null : null;
    default:
      return null;
  }
}
