/**
 * V2 — load merged `activeFeatures` for adversary statblocks (SRD library rows or table elements).
 */

import { enrichHoverActionMeta } from './hover-action-enrich.js';
import { mergeDeclarativeFeatureState, resolveSourceScopeKey } from './feature-loader.js';

/**
 * @param {object} bucket
 * @param {string} name
 * @param {string} featType
 */
function resolveAdversaryRegistryTemplate(bucket, name, featType) {
  if (!bucket || typeof bucket !== 'object') return null;
  const t = featType ?? 'passive';
  const compositeKey = `${name}::${t}`;
  if (bucket[compositeKey] != null && typeof bucket[compositeKey] === 'object') {
    return bucket[compositeKey];
  }
  const plain = bucket[name];
  if (plain != null && typeof plain === 'object') return plain;
  return null;
}

/**
 * @param {object} adversaryRow — adversary data with `features[]` (`{ id, name, type, description }`), optional `id`, `instanceId`
 * @param {object} registry — full V2 registry including `adversary_features` (name → descriptor)
 * @param {{ instanceId?: string }} [opts]
 * @returns {object[]} feature rows suitable for Game Table / `applyDeclarativeFeatures` consumers
 */
export function loadAdversaryFeatures(adversaryRow, registry, opts = {}) {
  if (!adversaryRow || typeof adversaryRow !== 'object') return [];
  const instanceId = opts.instanceId ?? adversaryRow.instanceId ?? '__adv__';
  const advId = adversaryRow.id ?? '__adv_id__';
  const feats = adversaryRow.features;
  if (!Array.isArray(feats) || feats.length === 0) return [];

  const bucket = registry?.adversary_features;
  const out = [];

  for (const feat of feats) {
    if (!feat || typeof feat !== 'object') continue;
    const name = feat.name;
    if (name == null || name === '') continue;

    const featType = feat.type ?? 'passive';
    const reg = resolveAdversaryRegistryTemplate(bucket, name, featType);
    if (reg && typeof reg === 'object') {
      const row = {
        ...reg,
        name: feat.name,
        type: feat.type ?? reg.type ?? 'passive',
        description: feat.description ?? reg.description ?? '',
        id: feat.id,
        _ownerInstanceId: instanceId,
        _source: 'adversary',
        _sourceObject: reg,
        _sourceScopeKey: resolveSourceScopeKey('adversary_features', name, reg),
        _adversaryId: advId,
      };
      out.push(enrichHoverActionMeta(row));
    } else {
      out.push(
        enrichHoverActionMeta({
          ...feat,
          _ownerInstanceId: instanceId,
          _source: 'adversary',
          _sourceObject: null,
          _sourceScopeKey: `adversary:${advId}:${feat.id ?? name}`,
          _adversaryId: advId,
        })
      );
    }
  }

  return out;
}

/**
 * Merge V2 adversary feature rows + declarative `featureState` for Game Table display.
 * Feature-agnostic — no SRD name branching.
 *
 * @param {object} baseAdversary — resolved adversary fields including `features[]`
 * @param {object} [rawElement] — table element (optional `instanceId`, `featureState`, …)
 * @param {object} registry — V2 registry
 * @param {{ tableBase?: object }} [ctx] — optional table snapshot fragment for `mergeDeclarativeFeatureState`
 * @returns {object}
 */
export function mergeAdversaryV2Overlay(baseAdversary, rawElement, registry, ctx = {}) {
  const base = baseAdversary && typeof baseAdversary === 'object' ? baseAdversary : {};
  const raw = rawElement && typeof rawElement === 'object' ? rawElement : {};
  const instanceId = raw.instanceId ?? base.instanceId ?? '__adv__';
  const mergedFeatureState = mergeDeclarativeFeatureState(raw, ctx.tableBase ?? {});
  const activeFeatures = loadAdversaryFeatures({ ...base, instanceId }, registry, { instanceId });

  return {
    ...base,
    instanceId,
    featureState: mergedFeatureState,
    activeFeatures,
  };
}
