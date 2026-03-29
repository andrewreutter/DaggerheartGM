/**
 * Normalize LLM adversary draft output into a safe form patch.
 */

import { randomUUID } from 'crypto';
import { ROLES } from './game-constants.js';
import { getBaselineStats, getGuideRanges } from './client/lib/adversary-defaults.js';

const RANGE_ORDER = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];
const TRAITS = new Set(['Phy', 'Mag', 'Dir']);

function clampInt(n, lo, hi) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function normalizeRole(raw) {
  const r = String(raw || '').toLowerCase().trim();
  return ROLES.includes(r) ? r : 'standard';
}

function normalizeRange(raw) {
  const s = String(raw || '').trim();
  const hit = RANGE_ORDER.find((x) => x.toLowerCase() === s.toLowerCase());
  return hit || 'Melee';
}

function normalizeTrait(raw) {
  const t = String(raw || 'Phy').trim();
  return TRAITS.has(t) ? t : 'Phy';
}

function clampToRange(val, rangeArr) {
  if (!Array.isArray(rangeArr) || rangeArr.length < 2) return val;
  const lo = Math.min(rangeArr[0], rangeArr[1]);
  const hi = Math.max(rangeArr[0], rangeArr[1]);
  return Math.max(lo, Math.min(hi, val));
}

/**
 * @param {object} raw — LLM `adversary` object
 * @param {{ lockTier?: number, lockRole?: string }} [opts] — when set, tier/role come from the form, not the draft
 * @returns {{ patch: object, warnings: string[] }}
 */
export function resolveAdversaryAiDraft(raw, opts = {}) {
  const warnings = [];
  if (!raw || typeof raw !== 'object') {
    return { patch: {}, warnings: ['Empty adversary draft'] };
  }

  const role =
    opts.lockRole != null ? normalizeRole(opts.lockRole) : normalizeRole(raw.role);
  const tier =
    opts.lockTier != null ? clampInt(opts.lockTier, 1, 4) : clampInt(raw.tier, 1, 4);
  const baseline = getBaselineStats(role, tier);
  const base = baseline || getBaselineStats('standard', tier);
  if (!baseline) {
    warnings.push(`Used standard baseline for role "${raw.role}" → ${role}.`);
  }

  const gr = getGuideRanges(role, tier);

  let difficulty = parseInt(raw.difficulty, 10);
  if (Number.isNaN(difficulty)) difficulty = base.difficulty;
  if (gr?.difficulty) difficulty = clampToRange(difficulty, gr.difficulty);

  let hp_max = parseInt(raw.hp_max, 10);
  if (Number.isNaN(hp_max)) hp_max = base.hp_max;
  if (gr?.hp_max) hp_max = clampToRange(hp_max, gr.hp_max);

  let major = raw.hp_thresholds?.major;
  let severe = raw.hp_thresholds?.severe;
  if (major == null || Number.isNaN(parseInt(major, 10))) major = base.hp_thresholds?.major ?? 0;
  else major = parseInt(major, 10);
  if (severe == null || Number.isNaN(parseInt(severe, 10))) severe = base.hp_thresholds?.severe ?? 0;
  else severe = parseInt(severe, 10);
  if (gr?.hp_thresholds?.major) major = clampToRange(major, gr.hp_thresholds.major);
  if (gr?.hp_thresholds?.severe) severe = clampToRange(severe, gr.hp_thresholds.severe);

  let stress_max = parseInt(raw.stress_max, 10);
  if (Number.isNaN(stress_max)) stress_max = base.stress_max;
  if (gr?.stress_max) stress_max = clampToRange(stress_max, gr.stress_max);

  const atkIn = raw.attack && typeof raw.attack === 'object' ? raw.attack : {};
  let atkMod = parseInt(atkIn.modifier, 10);
  if (Number.isNaN(atkMod)) atkMod = base.attack?.modifier ?? 0;
  if (gr?.attack?.modifier) atkMod = clampToRange(atkMod, gr.attack.modifier);

  let damage = typeof atkIn.damage === 'string' ? atkIn.damage.trim() : base.attack?.damage || '';
  if (!damage && base.attack?.damage) damage = base.attack.damage;

  const attack = {
    name: typeof atkIn.name === 'string' ? atkIn.name.trim() : '',
    range: normalizeRange(atkIn.range),
    modifier: atkMod,
    trait: normalizeTrait(atkIn.trait),
    damage,
  };

  const experiences = Array.isArray(raw.experiences)
    ? raw.experiences.map((e) => {
        const name = typeof e?.name === 'string' ? e.name.trim() : '';
        let mod = parseInt(e?.modifier, 10);
        if (Number.isNaN(mod)) mod = parseInt(e?.score, 10);
        if (Number.isNaN(mod)) mod = 1;
        mod = Math.max(1, Math.min(4, mod));
        return {
          id: typeof e?.id === 'string' && e.id ? e.id : randomUUID(),
          name,
          modifier: mod,
        };
      })
    : [];

  const features = Array.isArray(raw.features)
    ? raw.features.map((f) => {
        const name = typeof f?.name === 'string' ? f.name.trim() : '';
        const description = typeof f?.description === 'string' ? f.description : '';
        const typeRaw = String(f?.type || 'action').toLowerCase();
        const type = ['action', 'reaction', 'passive'].includes(typeRaw) ? typeRaw : 'action';
        return {
          id: typeof f?.id === 'string' && f.id ? f.id : randomUUID(),
          name,
          type,
          description,
        };
      })
    : [];

  const patch = {
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    motive: typeof raw.motive === 'string' ? raw.motive.trim() : '',
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    tier,
    role,
    difficulty,
    hp_max,
    hp_thresholds: { major, severe },
    stress_max,
    attack,
    experiences,
    features,
  };

  if (!patch.name) warnings.push('Adversary name was empty — user should set a name.');

  return { patch, warnings };
}
