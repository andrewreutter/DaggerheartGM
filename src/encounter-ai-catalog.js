/**
 * Compact SRD-derived catalogs for adversary/environment concept LLM prompts.
 * Stats authority: guide baselines in adversary-defaults (not raw SRD numbers).
 */

import { getBaselineStats } from './client/lib/adversary-defaults.js';
import { ROLES, TIERS, ENV_TYPES } from './game-constants.js';

const DESC_MAX = 140;
const PRIMARY_PER_BUCKET = 4;
const SECONDARY_FEATURE_CAP = 14;
const SECONDARY_EXP_CAP = 14;

export function truncDesc(text) {
  if (text == null) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  if (s.length <= DESC_MAX) return s;
  return `${s.slice(0, DESC_MAX - 1)}…`;
}

/**
 * All guide baselines keyed by "tier:role" for the LLM system prompt.
 */
export function buildGuideBaselinesMap() {
  const out = {};
  for (const role of ROLES) {
    for (const tier of TIERS) {
      const b = getBaselineStats(role, tier);
      if (!b) continue;
      out[`${tier}:${role}`] = {
        difficulty: b.difficulty,
        hp_max: b.hp_max,
        hp_thresholds: { ...b.hp_thresholds },
        stress_max: b.stress_max,
        attack: { modifier: b.attack?.modifier ?? 0, damage: b.attack?.damage ?? '' },
      };
    }
  }
  return out;
}

function normalizeAdvRole(role) {
  const r = String(role || '').toLowerCase().trim();
  return ROLES.includes(r) ? r : 'standard';
}

function clampTier(t) {
  const x = parseInt(t, 10);
  if (Number.isNaN(x)) return null;
  return Math.min(4, Math.max(1, x));
}

function normalizeEnvType(type) {
  const t = String(type || '').toLowerCase().trim();
  return ENV_TYPES.includes(t) ? t : 'exploration';
}

/**
 * Narrow a full adversary catalog to one tier×role axis (smaller prompt, matches form selection).
 * @param {object} full — unscoped catalog from the builder below
 */
export function scopeAdversaryAiCatalogToAxis(full, tier, role) {
  const t = clampTier(tier);
  const r = normalizeAdvRole(role);
  if (t == null || !ROLES.includes(r)) return full;
  const k = `${t}:${r}`;
  const baselineRow = full.guideBaselines[k] ?? buildGuideBaselinesMap()[k];
  const guideBaselines = baselineRow ? { [k]: baselineRow } : {};
  return {
    axes: { tiers: [t], roles: [r] },
    guideBaselines,
    examplesByTierRole: { [k]: full.examplesByTierRole[k] || [] },
    featureAndExperienceExamplesByTier: {
      [String(t)]: full.featureAndExperienceExamplesByTier[String(t)] || { featurePreviews: [], experiencePreviews: [] },
    },
    featureAndExperienceExamplesByRole: {
      [r]: full.featureAndExperienceExamplesByRole[r] || { featurePreviews: [], experiencePreviews: [] },
    },
  };
}

/**
 * Narrow a full environment catalog to one tier×type axis.
 */
export function scopeEnvironmentAiCatalogToAxis(full, tier, type) {
  const t = clampTier(tier);
  const ty = normalizeEnvType(type);
  if (t == null || !ENV_TYPES.includes(ty)) return full;
  const k = `${t}:${ty}`;
  return {
    axes: { tiers: [t], types: [ty] },
    examplesByTierType: { [k]: full.examplesByTierType[k] || [] },
    featurePreviewsByTier: {
      [String(t)]: full.featurePreviewsByTier[String(t)] || [],
    },
    featurePreviewsByType: {
      [ty]: full.featurePreviewsByType[ty] || [],
    },
  };
}

function compactPrimaryAdversaryCard(adv) {
  const features = (adv.features || []).slice(0, 4).map((f) => ({
    name: f.name || '',
    description: truncDesc(f.description),
  }));
  const experiences = (adv.experiences || []).slice(0, 4).map((e) => ({
    name: e.name || '',
    modifier: typeof e.modifier === 'number' ? e.modifier : parseInt(e.modifier, 10) || 1,
  }));
  return {
    id: adv.id,
    name: adv.name || '',
    tier: Math.min(4, Math.max(1, parseInt(adv.tier, 10) || 1)),
    role: normalizeAdvRole(adv.role),
    motive: truncDesc(adv.motive),
    description: truncDesc(adv.description),
    difficulty: adv.difficulty,
    hp_max: adv.hp_max,
    hp_thresholds: adv.hp_thresholds || { major: 0, severe: 0 },
    stress_max: adv.stress_max,
    attack: {
      name: adv.attack?.name || '',
      range: adv.attack?.range || 'Melee',
      modifier: adv.attack?.modifier ?? 0,
      trait: adv.attack?.trait || 'Phy',
      damage: adv.attack?.damage || '',
    },
    featurePreviews: features,
    experiencePreviews: experiences,
  };
}

function compactPrimaryEnvironmentCard(env) {
  const pa = env.potential_adversaries || [];
  const names = pa.map((p) => p?.name || '').filter(Boolean).slice(0, 8);
  const features = (env.features || []).slice(0, 4).map((f) => ({
    name: f.name || '',
    description: truncDesc(f.description),
  }));
  return {
    id: env.id,
    name: env.name || '',
    tier: Math.min(4, Math.max(1, parseInt(env.tier, 10) || 1)),
    type: ENV_TYPES.includes(env.type) ? env.type : 'exploration',
    description: truncDesc(env.description),
    impulses: truncDesc(env.impulses),
    difficulty: env.difficulty,
    potentialAdversaryNames: names,
    featurePreviews: features,
  };
}

/**
 * @param {object[]} adversaries — normalized SRD adversary rows
 * @param {{ focusTier?: number, focusRole?: string }} [opts] — when both set, catalog is scoped to that tier×role
 */
export function buildCompactAdversaryAiCatalog(adversaries, opts = {}) {
  const list = Array.isArray(adversaries) ? adversaries : [];
  const examplesByTierRole = {};
  for (const role of ROLES) {
    for (const tier of TIERS) {
      examplesByTierRole[`${tier}:${role}`] = [];
    }
  }
  for (const adv of list) {
    const tier = Math.min(4, Math.max(1, parseInt(adv.tier, 10) || 1));
    const role = normalizeAdvRole(adv.role);
    const k = `${tier}:${role}`;
    const bucket = examplesByTierRole[k];
    if (bucket && bucket.length < PRIMARY_PER_BUCKET) {
      bucket.push(compactPrimaryAdversaryCard(adv));
    }
  }

  const featureAndExperienceExamplesByTier = {};
  const featureAndExperienceExamplesByRole = {};

  for (const tier of TIERS) {
    const featurePreviews = [];
    const experiencePreviews = [];
    for (const adv of list) {
      const t = Math.min(4, Math.max(1, parseInt(adv.tier, 10) || 1));
      if (t !== tier) continue;
      for (const f of adv.features || []) {
        if (featurePreviews.length >= SECONDARY_FEATURE_CAP) break;
        featurePreviews.push({
          name: f.name || '',
          description: truncDesc(f.description),
        });
      }
      for (const e of adv.experiences || []) {
        if (experiencePreviews.length >= SECONDARY_EXP_CAP) break;
        experiencePreviews.push({
          name: e.name || '',
          modifier: typeof e.modifier === 'number' ? e.modifier : parseInt(e.modifier, 10) || 1,
        });
      }
    }
    featureAndExperienceExamplesByTier[String(tier)] = { featurePreviews, experiencePreviews };
  }

  for (const role of ROLES) {
    const featurePreviews = [];
    const experiencePreviews = [];
    for (const adv of list) {
      if (normalizeAdvRole(adv.role) !== role) continue;
      for (const f of adv.features || []) {
        if (featurePreviews.length >= SECONDARY_FEATURE_CAP) break;
        featurePreviews.push({
          name: f.name || '',
          description: truncDesc(f.description),
        });
      }
      for (const e of adv.experiences || []) {
        if (experiencePreviews.length >= SECONDARY_EXP_CAP) break;
        experiencePreviews.push({
          name: e.name || '',
          modifier: typeof e.modifier === 'number' ? e.modifier : parseInt(e.modifier, 10) || 1,
        });
      }
    }
    featureAndExperienceExamplesByRole[role] = { featurePreviews, experiencePreviews };
  }

  const full = {
    axes: { tiers: [...TIERS], roles: [...ROLES] },
    guideBaselines: buildGuideBaselinesMap(),
    examplesByTierRole,
    featureAndExperienceExamplesByTier,
    featureAndExperienceExamplesByRole,
  };
  const ft = clampTier(opts.focusTier);
  const fr = opts.focusRole != null ? normalizeAdvRole(opts.focusRole) : null;
  if (ft != null && fr != null && ROLES.includes(fr)) {
    return scopeAdversaryAiCatalogToAxis(full, ft, fr);
  }
  return full;
}

/**
 * @param {object[]} environments — normalized SRD environment rows
 * @param {{ focusTier?: number, focusType?: string }} [opts] — when both set, catalog is scoped to that tier×type
 */
export function buildCompactEnvironmentAiCatalog(environments, opts = {}) {
  const list = Array.isArray(environments) ? environments : [];
  const examplesByTierType = {};
  for (const type of ENV_TYPES) {
    for (const tier of TIERS) {
      examplesByTierType[`${tier}:${type}`] = [];
    }
  }
  for (const env of list) {
    const tier = Math.min(4, Math.max(1, parseInt(env.tier, 10) || 1));
    const type = ENV_TYPES.includes(env.type) ? env.type : 'exploration';
    const k = `${tier}:${type}`;
    const bucket = examplesByTierType[k];
    if (bucket && bucket.length < PRIMARY_PER_BUCKET) {
      bucket.push(compactPrimaryEnvironmentCard(env));
    }
  }

  const featurePreviewsByTier = {};
  const featurePreviewsByType = {};
  for (const tier of TIERS) {
    const featurePreviews = [];
    for (const env of list) {
      const t = Math.min(4, Math.max(1, parseInt(env.tier, 10) || 1));
      if (t !== tier) continue;
      for (const f of env.features || []) {
        if (featurePreviews.length >= SECONDARY_FEATURE_CAP) break;
        featurePreviews.push({
          name: f.name || '',
          description: truncDesc(f.description),
        });
      }
    }
    featurePreviewsByTier[String(tier)] = featurePreviews;
  }
  for (const type of ENV_TYPES) {
    const featurePreviews = [];
    for (const env of list) {
      const ty = ENV_TYPES.includes(env.type) ? env.type : 'exploration';
      if (ty !== type) continue;
      for (const f of env.features || []) {
        if (featurePreviews.length >= SECONDARY_FEATURE_CAP) break;
        featurePreviews.push({
          name: f.name || '',
          description: truncDesc(f.description),
        });
      }
    }
    featurePreviewsByType[type] = featurePreviews;
  }

  const full = {
    axes: { tiers: [...TIERS], types: [...ENV_TYPES] },
    examplesByTierType,
    featurePreviewsByTier,
    featurePreviewsByType,
  };
  const ft = clampTier(opts.focusTier);
  const fty = opts.focusType != null ? normalizeEnvType(opts.focusType) : null;
  if (ft != null && fty != null && ENV_TYPES.includes(fty)) {
    return scopeEnvironmentAiCatalogToAxis(full, ft, fty);
  }
  return full;
}
