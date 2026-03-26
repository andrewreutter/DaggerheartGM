/**
 * Canonical keys for `character.featureUsage[…]` match Guide rows
 * (`getOrderedGuideFeatureEntries` → `entry.key`). Domain abilities use `ability-${id}`.
 * Fallback for features not in the guide: `${name}-${index}` in class→subclass→ancestry→community order.
 */

import {
  getOrderedGuideFeatureEntries,
  getOrderedGuideLoadoutEntries,
  resolveHopeFeatureName,
} from './guide-feature-entries.js';

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

/**
 * Human-readable label for a `featureUsage` object key (inverse of {@link getFeatureUsageKeyForGuideFeature}).
 *
 * @param {object} el — character element with `classFeatures`, `abilities`, … (merged overlay is best)
 * @param {string} key — stored `featureUsage` key
 * @returns {string}
 */
export function getDisplayLabelForFeatureUsageKey(el, key) {
  if (el == null || key == null || key === '') return String(key ?? '');
  const k = String(key);

  for (const e of getOrderedGuideFeatureEntries(el, () => {})) {
    if (e.key === k && e.row?.name) return e.row.name;
  }

  for (const e of getOrderedGuideLoadoutEntries(el)) {
    if (e.key === k) return e.row?.name || e.ability?.name || k;
  }

  const flat = flattenFeaturesForUsageKey(el);
  for (let i = 0; i < flat.length; i++) {
    const f = flat[i];
    const idx = flat.findIndex((x) => x.name === f.name);
    if (`${f.name}-${idx}` === k) return f.name;
  }

  const abs = el.abilities || [];
  for (let i = 0; i < abs.length; i++) {
    const ak = `ability-${abs[i].id ?? i}`;
    if (ak === k) return abs[i].name;
  }

  const hopeN = resolveHopeFeatureName(el);
  if (hopeN && `hope-${hopeN}` === k) return hopeN;

  if (k.length < 120 && !k.includes('::')) {
    const allNames = new Set(
      [
        ...(el.classFeatures || []).map((f) => f.name),
        ...(el.subclassFeatures || []).map((f) => f.name),
        ...(el.ancestryFeatures || []).map((f) => f.name),
        ...(el.communityFeatures || []).map((f) => f.name),
        ...(el.beastformFeatures || []).map((f) => f.name),
        hopeN,
      ].filter(Boolean)
    );
    if (allNames.has(k)) return k;
  }

  return prettifyFeatureUsageKeyFallback(k);
}

/**
 * @param {string} k
 * @returns {string}
 */
function prettifyFeatureUsageKeyFallback(k) {
  let s = k;
  if (s.startsWith('ability-')) {
    s = s.slice('ability-'.length);
    s = s.replace(/^srd-abl-/, '').replace(/^srd-/, '');
  } else {
    s = s.replace(/^(class|sub|anc|com|bf|hope)-/i, '');
    s = s.replace(/-\d+$/, '');
  }
  return s
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
