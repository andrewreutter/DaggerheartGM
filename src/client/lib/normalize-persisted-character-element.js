/**
 * One-shot normalization for character elements loaded from DB / SSE (focus mirroring,
 * legacy flat featureUsage keys, etc.).
 */

import { getFeatureUsageKeyForGuideFeature } from './feature-usage-key.js';

function flattenLegacyFeatureList(el) {
  return [
    ...(el.classFeatures || []),
    ...(el.subclassFeatures || []),
    ...(el.ancestryFeatures || []),
    ...(el.communityFeatures || []),
  ];
}

/**
 * Legacy keys: `${name}-${index}` where index is findIndex in flattenLegacyFeatureList.
 * Canonical guide keys use prefixes (`class-Rally-0`, …) — detect legacy by matching index + name.
 */
function isLegacyFlatFeatureUsageKey(el, key) {
  const lastDash = key.lastIndexOf('-');
  if (lastDash <= 0) return false;
  const numStr = key.slice(lastDash + 1);
  if (!/^\d+$/.test(numStr)) return false;
  const name = key.slice(0, lastDash);
  const idx = parseInt(numStr, 10);
  const flat = flattenLegacyFeatureList(el);
  return flat.findIndex((f) => f.name === name) === idx;
}

function normalizeFeatureUsageObject(el) {
  const fu = el.featureUsage;
  if (!fu || typeof fu !== 'object') return el;
  let next = null;
  for (const key of Object.keys(fu)) {
    if (!isLegacyFlatFeatureUsageKey(el, key)) continue;
    const lastDash = key.lastIndexOf('-');
    const name = key.slice(0, lastDash);
    const canonical = getFeatureUsageKeyForGuideFeature(el, name);
    if (!canonical || canonical === key) continue;
    if (!next) next = { ...fu };
    const val = next[key];
    delete next[key];
    if (next[canonical] == null) {
      next[canonical] = val;
    } else if (val && typeof val === 'object' && typeof next[canonical] === 'object') {
      next[canonical] = { ...next[canonical], ...val };
    }
  }
  return next ? { ...el, featureUsage: next } : el;
}

function normalizeFocusFields(el) {
  const a = el.focusTargetInstanceId ?? el.focusTargetId;
  const b = el.focusTargetId ?? el.focusTargetInstanceId;
  const v = a != null && a !== '' ? a : b != null && b !== '' ? b : null;
  if (v == null && el.focusTargetId == null && el.focusTargetInstanceId == null) return el;
  if (String(el.focusTargetId ?? '') === String(v ?? '') && String(el.focusTargetInstanceId ?? '') === String(v ?? '')) {
    return el;
  }
  return {
    ...el,
    focusTargetId: v,
    focusTargetInstanceId: v,
  };
}

/**
 * @param {object} el — character element (table or resolved library merge)
 * @returns {object} same reference if nothing changed, else patched copy
 */
export function normalizePersistedCharacterElement(el) {
  if (!el || el.elementType !== 'character') return el;
  let next = el;
  next = normalizeFeatureUsageObject(next);
  next = normalizeFocusFields(next);
  return next;
}
