/**
 * One-shot normalization for character elements loaded from DB / SSE so dual legacy paths
 * converge without requiring a separate DB migration job.
 */

import { getFeatureUsageKeyForGuideFeature } from './feature-usage-key.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../features-v2/engine/feature-scope-keys.js';
import registry from '../../features-v2/registry.js';

const LEGACY_CONSUMABLE_FLAT_KEYS = {
  'Hopehold Flare': 'consumables:srd-cns-hopehold-flare',
  'Blinding Orb': 'consumables:srd-cns-blinding-orb',
};

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

function normalizeDruidFeatureState(fs) {
  if (!fs || typeof fs !== 'object') return fs;
  const out = { ...fs };
  const scopeKey = SRD_CLASS_DRUID_SCOPE_KEY;
  const existing = out[scopeKey] && typeof out[scopeKey] === 'object' ? { ...out[scopeKey] } : {};
  let changed = false;

  const mergeActive = (bag, viaEvolution) => {
    const ab = bag?.activeBeastform;
    if (!ab?.beastformId) return;
    if (existing.activeBeastform?.beastformId) return;
    existing.activeBeastform = {
      ...ab,
      viaEvolution: viaEvolution ? true : ab.viaEvolution === true,
    };
    changed = true;
  };

  if (out.Beastform && typeof out.Beastform === 'object') {
    mergeActive(out.Beastform, false);
    delete out.Beastform;
    changed = true;
  }
  if (out.Evolution && typeof out.Evolution === 'object') {
    mergeActive(out.Evolution, true);
    delete out.Evolution;
    changed = true;
  }
  if (changed) {
    out[scopeKey] = existing;
  }
  return changed ? out : fs;
}

function applyLegacyCharacterRuntimeMigrations(el) {
  const rows = registry?.legacyCharacterRuntimeMigrations;
  if (!Array.isArray(rows) || rows.length === 0) return el;
  let fs = el.featureState && typeof el.featureState === 'object' ? { ...el.featureState } : null;
  let anyMerge = false;
  for (const row of rows) {
    const legacyKey = row?.legacyKey;
    if (!legacyKey || !(legacyKey in el)) continue;
    const raw = el[legacyKey];
    const merged = typeof row.mergeValue === 'function' ? row.mergeValue(raw) : raw;
    const scopeKey = row.scopeKey;
    const stateKey = row.stateKey;
    if (!scopeKey || !stateKey) continue;
    if (merged == null || merged === '') continue;
    if (!fs) fs = {};
    const bag = { ...(fs[scopeKey] && typeof fs[scopeKey] === 'object' ? fs[scopeKey] : {}) };
    if (bag[stateKey] != null) continue;
    bag[stateKey] = merged;
    anyMerge = true;
    fs[scopeKey] = bag;
  }
  const rest = { ...el };
  let removedLegacy = false;
  for (const row of rows) {
    const legacyKey = row?.legacyKey;
    if (legacyKey && legacyKey in rest) {
      delete rest[legacyKey];
      removedLegacy = true;
    }
  }
  if (fs && (anyMerge || removedLegacy)) rest.featureState = fs;
  if (!removedLegacy) return anyMerge ? rest : el;
  return rest;
}

function normalizeConsumableFlatKeys(fs) {
  if (!fs || typeof fs !== 'object') return fs;
  let out = null;
  for (const [legacyName, scopeKey] of Object.entries(LEGACY_CONSUMABLE_FLAT_KEYS)) {
    if (fs[legacyName] == null || typeof fs[legacyName] !== 'object') continue;
    if (fs[scopeKey] != null && typeof fs[scopeKey] === 'object') continue;
    if (!out) out = { ...fs };
    out[scopeKey] = { ...(out[scopeKey] || {}), ...out[legacyName] };
    delete out[legacyName];
  }
  return out || fs;
}

/**
 * @param {object} el — character element (table or resolved library merge)
 * @returns {object} same reference if nothing changed, else patched copy
 */
export function normalizePersistedCharacterElement(el) {
  if (!el || el.elementType !== 'character') return el;
  let next = el;
  next = applyLegacyCharacterRuntimeMigrations(next);
  next = normalizeFeatureUsageObject(next);
  next = normalizeFocusFields(next);
  const fs0 = next.featureState;
  if (fs0 && typeof fs0 === 'object') {
    let fs = normalizeDruidFeatureState(fs0);
    fs = normalizeConsumableFlatKeys(fs);
    if (fs !== fs0) {
      next = { ...next, featureState: fs };
    }
  }
  return next;
}
