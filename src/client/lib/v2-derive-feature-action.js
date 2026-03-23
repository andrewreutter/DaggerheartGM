/**
 * Derive hover-card / sheet "action" metadata from merged V2 `activeFeatures` rows.
 * Replaces ad-hoc prose parsing for feature Use / roll metadata.
 */

import { buildChipsForFeature, flattenChipsForDisplay } from '../../features-v2/engine/chip-system.js';
import {
  enrichHoverActionMeta,
  extractEmbeddedResourceCostsFromText,
} from '../../features-v2/engine/hover-action-enrich.js';

const INACTIVE = Object.freeze({
  hopeCost: 0,
  stressCost: 0,
  armorMark: 0,
  armorClear: 0,
  dice: [],
  spellcastDC: null,
  spellcastVsRoll: false,
  frequency: null,
  cycle: null,
  isActive: false,
  impliesTarget: false,
  targetType: null,
  advantageCondition: null,
});

function chipIsCardPlacement(chip) {
  if (!chip || typeof chip !== 'object') return false;
  if (chip.placement === 'card') return true;
  const p = chip.placements;
  if (!p || !Array.isArray(p)) return true;
  return p.includes('card');
}

function firstAdvantageTriggerString(row) {
  const adv = row?.advantageTriggers;
  if (!Array.isArray(adv) || adv.length === 0) return null;
  const first = adv[0];
  const s = typeof first === 'string' ? first : first?._value;
  if (!s || !String(s).trim()) return null;
  return String(s).trim().replace(/\.$/, '');
}

/**
 * @param {object|null|undefined} row — merged `activeFeatures` entry (or minimal synthetic `{ name, description, chips }`)
 * @returns {object} action-shaped fields for UI compatibility (hopeCost, spellcastDC, isActive, …)
 */
export function deriveFeatureActionFromV2Row(row) {
  if (!row || typeof row !== 'object') {
    return { ...INACTIVE };
  }

  const enriched = enrichHoverActionMeta(row);
  const rawChips = buildChipsForFeature(enriched);
  const flat = flattenChipsForDisplay(rawChips).filter(chipIsCardPlacement);

  let hopeCost = 0;
  let stressCost = 0;
  let armorMark = 0;
  let armorClear = 0;
  let frequency = enriched.frequency ?? null;

  const resolveCost = (v) => {
    if (v == null || v === false) return 0;
    if (typeof v === 'function') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };

  for (const c of flat) {
    hopeCost = Math.max(hopeCost, resolveCost(c.hopeCost));
    stressCost = Math.max(stressCost, resolveCost(c.stressCost));
    armorMark = Math.max(armorMark, resolveCost(c.armorMark));
    armorClear = Math.max(armorClear, resolveCost(c.armorClear));
    if (c.frequency && !frequency) frequency = c.frequency;
  }

  if (typeof enriched.hopeCost === 'number') hopeCost = Math.max(hopeCost, enriched.hopeCost);
  if (typeof enriched.stressCost === 'number') stressCost = Math.max(stressCost, enriched.stressCost);
  if (typeof enriched.armorMark === 'number') armorMark = Math.max(armorMark, enriched.armorMark);
  if (typeof enriched.armorClear === 'number') armorClear = Math.max(armorClear, enriched.armorClear);

  const spellcastDC =
    enriched.spellcastDC != null ? Number(enriched.spellcastDC) : null;
  const spellcastVsRoll = enriched.spellcastVsRoll === true;

  const advantageCondition = firstAdvantageTriggerString(enriched);

  const impliesTarget = !!enriched.impliesTarget;
  const targetType = enriched.targetType ?? null;

  const isActive =
    hopeCost > 0 ||
    stressCost > 0 ||
    armorMark > 0 ||
    armorClear > 0 ||
    spellcastDC != null ||
    spellcastVsRoll ||
    frequency != null;

  return {
    hopeCost,
    stressCost,
    armorMark,
    armorClear,
    dice: [],
    spellcastDC: Number.isFinite(spellcastDC) ? spellcastDC : null,
    spellcastVsRoll,
    frequency,
    cycle: frequency,
    isActive,
    impliesTarget,
    targetType,
    advantageCondition,
  };
}

function findActiveFeatureRow(displayEl, featureName) {
  if (!featureName) return null;
  return (displayEl?.activeFeatures || []).find((r) => r.name === featureName) ?? null;
}

/**
 * Action metadata for `handleFeatureUse` / roll builders — merged feature row + optional sub-option.
 */
export function buildActionForFeatureUse(displayEl, feature, subFeature) {
  const row = findActiveFeatureRow(displayEl, feature?.name);
  const baseRow = row
    ? enrichHoverActionMeta(row)
    : enrichHoverActionMeta({
        name: feature?.name,
        description: feature?.description || feature?.text || '',
        chips: [],
      });

  let action = deriveFeatureActionFromV2Row(baseRow);

  if (!subFeature) return action;

  const subSyn = enrichHoverActionMeta({
    name: subFeature.name,
    description: subFeature.description || '',
    chips: [],
  });
  let subAction = deriveFeatureActionFromV2Row(subSyn);
  const embedded = extractEmbeddedResourceCostsFromText(subFeature.description || '');
  subAction = {
    ...subAction,
    hopeCost: Math.max(subAction.hopeCost, embedded.hopeCost),
    stressCost: Math.max(subAction.stressCost, embedded.stressCost),
    armorMark: Math.max(subAction.armorMark, embedded.armorMark),
    armorClear: Math.max(subAction.armorClear, embedded.armorClear),
    frequency: subAction.frequency || embedded.frequency,
  };

  const hopeInName = subFeature.name?.match(/\((\d+)\s*[Hh]ope\)/);
  if (hopeInName) subAction.hopeCost = parseInt(hopeInName[1], 10);

  if (typeof subFeature.hopeCost === 'number') subAction.hopeCost = subFeature.hopeCost;

  if (row) {
    const parentAction = deriveFeatureActionFromV2Row(enrichHoverActionMeta(row));
    if (subAction.stressCost === 0) subAction.stressCost = parentAction.stressCost;
    if (subAction.hopeCost === 0) subAction.hopeCost = parentAction.hopeCost;
    if (!subAction.spellcastVsRoll && parentAction.spellcastVsRoll) subAction.spellcastVsRoll = true;
    if (subAction.spellcastDC == null && parentAction.spellcastDC != null) {
      subAction.spellcastDC = parentAction.spellcastDC;
    }
  }

  subAction.isActive =
    subAction.hopeCost > 0 ||
    subAction.stressCost > 0 ||
    subAction.armorMark > 0 ||
    subAction.armorClear > 0 ||
    subAction.spellcastDC != null ||
    subAction.spellcastVsRoll ||
    subAction.frequency != null;
  subAction.cycle = subAction.frequency;

  return subAction;
}
