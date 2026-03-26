/**
 * Beastform auto-drop on the VTT: shared helpers for damage-driven exit matching
 * {@link clearBeastformState} in `src/features-v2/classes/Druid.js` / Drop chip mutations.
 */

import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../features-v2/engine/feature-scope-keys.js';

/** Engine mutations equivalent to `clearBeastformState` (scoped `featureState` + legacy mirror via table-ops). */
export function buildClearBeastformStateMutations() {
  return [
    {
      type: 'setFeatureState',
      payload: { featureKey: SRD_CLASS_DRUID_SCOPE_KEY, key: 'activeBeastform', value: null },
    },
    {
      type: 'setFeatureState',
      payload: { featureKey: SRD_CLASS_DRUID_SCOPE_KEY, key: 'evolutionTraitKey', value: null },
    },
  ];
}

/**
 * @param {object[]|undefined} activeFeatures — merged sheet rows (`mergeV2DeclarativeSheetOverlay` + beastform virtual rows)
 * @returns {boolean}
 */
export function hasDeclarativeBeastformFragileDrop(activeFeatures) {
  if (!Array.isArray(activeFeatures)) return false;
  return activeFeatures.some((f) => f && f.dropBeastformOnMajorOrGreaterDamage);
}

/**
 * Fallback when overlay is unavailable: SRD `activeBeastform.features` name list (legacy path).
 * @param {object|null|undefined} beastformBlock — enriched `element.activeBeastform`
 * @returns {boolean}
 */
export function legacyBeastformFeaturesLookFragile(beastformBlock) {
  const features = beastformBlock?.features;
  if (!Array.isArray(features)) return false;
  return features.some((f) => /fragile/i.test(f?.name || ''));
}

/**
 * @param {object} args
 * @param {number} args.currentHp — after damage
 * @param {number} args.hpLossToApply — HP boxes marked this hit
 * @param {boolean} args.hasFragile
 */
export function shouldDropBeastformFromDamage({ currentHp, hpLossToApply, hasFragile }) {
  if (currentHp === 0) return true;
  return hpLossToApply >= 2 && hasFragile;
}
