/**
 * Canonical keys for `character.featureUsage[…]` match Guide rows
 * (`getOrderedGuideFeatureEntries` → `entry.key`). Domain abilities use `ability-${id}`.
 * Fallback for features not in the guide: `${name}-${index}` in class→subclass→ancestry→community order.
 */

import { getOrderedGuideFeatureEntries } from './guide-feature-entries.js';

function flattenFeaturesForUsageKey(el) {
  return [
    ...(el.classFeatures || []),
    ...(el.subclassFeatures || []),
    ...(el.ancestryFeatures || []),
    ...(el.communityFeatures || []),
  ];
}

/**
 * @param {object} el — character element (table or library shape with classFeatures, etc.)
 * @param {string} featureName — parent feature name (e.g. `Rally`, `Prayer Dice`)
 * @returns {string|null} — same key as Guide `entry.key`, or `ability-…`, or `Name-idx` fallback, or null
 */
export function getFeatureUsageKeyForGuideFeature(el, featureName) {
  if (!el || featureName == null || featureName === '') return null;
  const name = String(featureName);

  const entries = getOrderedGuideFeatureEntries(el, () => {});
  const hit = entries.find((e) => e.row?.name === name);
  if (hit) return hit.key;

  const abilityIdx = (el.abilities || []).findIndex((a) => a.name === name);
  if (abilityIdx >= 0) {
    const a = el.abilities[abilityIdx];
    return `ability-${a.id ?? abilityIdx}`;
  }

  const flat = flattenFeaturesForUsageKey(el);
  const idx = flat.findIndex((f) => f.name === name);
  if (idx >= 0) return `${name}-${idx}`;

  return null;
}
