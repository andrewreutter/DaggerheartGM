/**
 * Character calculation utilities.
 * Pure functions that compute derived stats from character selections + SRD data.
 */

import { originFeatures, weaponFeatures, armorFeatures, classFeatures } from '../../features/registry.js';
import { BEASTFORM_ITEMS } from '../../features-v2/beastforms/srd-data.js';
import { weapon_properties as v2WeaponProperties, armor_properties as v2ArmorProperties } from '../../features-v2/registry.js';
import { unwrap, unwrapAll } from '../../features-v2/engine/when.js';
import { buildTableSnapshot } from '../../features-v2/engine/table.js';
import { isV2DeclarativeSheetEnabled } from './v2-declarative-sheet.js';

const TIER_LEVELS = [1, 2, 5, 8]; // level thresholds for tiers 1–4

const DRUID_CLASS_ID = 'srd-cls-druid';

function resolveBeastformRowById(id, srdData) {
  if (!id) return null;
  const fromApi = srdData?.beastformsById?.[id];
  if (fromApi) return fromApi;
  return BEASTFORM_ITEMS.find((r) => r.id === id) || null;
}

/**
 * Display-only rows for the Features list while a Druid has `activeBeastform` set.
 * Filled during `recomputeCharacter` from the SRD beastform row (`srdData.beastformsById` or
 * generated `BEASTFORM_ITEMS` fallback) so the UI does not import registries.
 */
function assignBeastformDisplayFeatures(result, data, srdData) {
  result.beastformFeatures = [];
  const isDruid = data.classId === DRUID_CLASS_ID || result.class === 'Druid';
  if (!isDruid) return;
  const ab = data.activeBeastform;
  if (!ab || typeof ab !== 'object') return;
  const id = ab.id || ab.beastformId;
  const row = resolveBeastformRowById(id, srdData);
  if (!row?.features?.length) return;
  const formName = row.name || ab.name || 'Beastform';
  result.beastformFeatures = row.features.map((f) => ({
    name: f.name,
    description: f.description || '',
    source: formName,
    sourceType: 'beastform',
    id: f.id,
  }));
}

export function tierFromLevel(level) {
  if (level >= 8) return 4;
  if (level >= 5) return 3;
  if (level >= 2) return 2;
  return 1;
}

const TRAIT_POOL = [2, 1, 1, 0, 0, -1];
const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

export function isTraitAssignmentComplete(baseTraits) {
  if (!baseTraits) return false;
  const assigned = TRAIT_KEYS.map(k => baseTraits[k]).filter(v => v != null);
  return assigned.length === 6;
}

/**
 * Validate that the baseTraits assignment uses exactly the allowed pool.
 * Returns true if valid.
 */
export function isValidTraitAssignment(baseTraits) {
  if (!baseTraits) return false;
  const values = TRAIT_KEYS.map(k => baseTraits[k]).filter(v => v != null).sort((a, b) => b - a);
  if (values.length !== 6) return false;
  const pool = [...TRAIT_POOL].sort((a, b) => b - a);
  return values.every((v, i) => v === pool[i]);
}

/**
 * Compute final trait values = baseTraits + advancement bonuses.
 */
export function computeTraits(baseTraits, advancements, level) {
  const result = {};
  for (const k of TRAIT_KEYS) {
    result[k] = baseTraits?.[k] ?? 0;
  }
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'traits' && Array.isArray(pick.traits)) {
          for (const t of pick.traits) {
            if (t in result) result[t] += 1;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Compute max HP from class base + advancement HP picks.
 */
export function computeMaxHp(classData, advancements, level) {
  let hp = classData?.starting_hp ?? 6;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'hp') hp += 1;
      }
    }
  }
  return hp;
}

/**
 * Compute max Stress from base (6) + advancement stress picks.
 */
export function computeMaxStress(advancements, level) {
  let stress = 6;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'stress') stress += 1;
      }
    }
  }
  return stress;
}

/**
 * Compute evasion from class base + advancement evasion picks.
 */
export function computeEvasion(classData, advancements, level) {
  let evasion = classData?.starting_evasion ?? 10;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'evasion') evasion += 1;
      }
    }
  }
  return evasion;
}

/**
 * Compute proficiency from base (1) + advancement proficiency picks.
 */
export function computeProficiency(advancements, level) {
  let prof = 1;
  if (advancements) {
    for (let lvl = 2; lvl <= (level || 1); lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (pick.type === 'proficiency') prof += 1;
      }
    }
  }
  return prof;
}

/**
 * Parse an armor's base_thresholds string like "Major 3 / Severe 5" into { major, severe }.
 */
export function parseArmorThresholds(thresholdStr) {
  if (!thresholdStr) return null;
  const m = thresholdStr.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  return { major: parseInt(m[1], 10), severe: parseInt(m[2], 10) };
}

/**
 * Minimal game-state shape for `buildTableSnapshot` when unwrapping V2 `when()` on gear
 * `passiveStatMods` during `recomputeCharacter`. Mirrors P1 `reinforcedActive` into
 * `featureState.Reinforced` so V2 Reinforced predicates can see it.
 *
 * @param {object} computed — partial recompute output (traits, tier, …)
 * @param {object} raw — library / table element (runtime keys, featureState, …)
 */
export function buildV2SheetUnwrapGameState(computed = {}, raw = {}) {
  const instanceId = computed.instanceId || raw.instanceId || '__sheet__';
  const traits = computed.traits || {};
  const el = {
    ...computed,
    ...raw,
    elementType: 'character',
    instanceId,
    name: computed.name || raw.name || 'Character',
    traits,
    tier: computed.tier ?? tierFromLevel(raw.level ?? computed.level ?? 1),
    level: raw.level ?? computed.level ?? 1,
    proficiency: computed.proficiency ?? 1,
    armorScore: computed.armorScore ?? 0,
    maxArmor: computed.maxArmor ?? 0,
    currentArmor: raw.currentArmor ?? computed.currentArmor ?? 0,
  };
  const featureState = { ...(raw.featureState || {}) };
  if (raw.reinforcedActive === true) {
    featureState.Reinforced = { ...(featureState.Reinforced || {}), reinforcedActive: true };
  }
  return {
    fear: 0,
    mapConfig: null,
    activeElements: [el],
    _ownerInstanceId: instanceId,
    featureState,
  };
}

function defaultGearSheetContext() {
  return {
    computed: {
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
      tier: 1,
      level: 1,
      proficiency: 1,
    },
    raw: {},
  };
}

/**
 * Resolve `passiveStatMods` from the V2 registry when the declarative sheet flag is on
 * (with `unwrap` / `unwrapAll`), otherwise Phase 1. If V2 yields no mods (failed `when`),
 * falls back to Phase 1 when present.
 */
function resolveGearPassiveStatMods(v2Descriptor, p1Descriptor, featureName, sheetCtx) {
  const ctx = sheetCtx || defaultGearSheetContext();
  const base = buildV2SheetUnwrapGameState(ctx.computed, ctx.raw);
  const useV2 = isV2DeclarativeSheetEnabled();
  if (useV2 && v2Descriptor && v2Descriptor.passiveStatMods !== undefined) {
    const table = buildTableSnapshot({ ...base, _featureKey: featureName });
    let mods = unwrap(v2Descriptor.passiveStatMods, table);
    if (mods != null && typeof mods === 'object') {
      mods = unwrapAll(mods, table);
    }
    if (mods != null && typeof mods === 'object') {
      return mods;
    }
  }
  const p1 = p1Descriptor?.passiveStatMods;
  return p1 != null && typeof p1 === 'object' ? p1 : null;
}

/**
 * Resolve armor stats from an SRD armor item.
 */
export function resolveArmor(armorItem) {
  if (!armorItem) return null;
  const thresholds = parseArmorThresholds(armorItem.base_thresholds);
  return {
    armorScore: armorItem.base_score ?? 0,
    armorName: armorItem.name,
    armorThresholds: thresholds,
    maxArmor: armorItem.base_score ?? 0,
  };
}

/**
 * Compute armor stat and roll modifiers from the registry only.
 * Returns { traits, evasion, rollModifiers, feature, sources }.
 * No parsing — armor features must have passiveStatMods in the armor feature registry.
 *
 * When {@link isV2DeclarativeSheetEnabled}, passive mods are resolved from `src/features-v2/armor_properties`
 * (with `when()` unwrapping); Phase 1 `armorFeatures` is used as fallback when V2 yields no static mods.
 *
 * @param {object | null} armorItem
 * @param {{ computed?: object, raw?: object }} [sheetCtx] — pass `{ computed: result, raw: data }` from `recomputeCharacter` for accurate unwrap; optional for callers that only need P1-shaped mods.
 */
export function computeArmorModifiers(armorItem, sheetCtx) {
  const result = {
    traits: {},
    evasion: 0,
    rollModifiers: [],
    feature: null,
    sources: [],
  };
  if (!armorItem) return result;

  const features = armorItem.features || [];
  if (!features.length) return result;

  const feat = features[0];
  result.feature = { name: feat.name, description: feat.description || feat.text || '' };
  const v2d = v2ArmorProperties[feat.name];
  const p1d = armorFeatures[feat.name];
  const mods = resolveGearPassiveStatMods(v2d, p1d, feat.name, sheetCtx);
  if (!mods) return result;

  if (mods.traits && typeof mods.traits === 'object') {
    for (const [key, value] of Object.entries(mods.traits)) {
      if (TRAIT_KEYS.includes(key)) {
        result.traits[key] = (result.traits[key] || 0) + value;
        result.sources.push({ armor: armorItem.name, feature: feat.name, stat: key, value });
      }
    }
  }
  for (const key of TRAIT_KEYS) {
    if (mods[key] != null && typeof mods[key] === 'number' && !(mods.traits && key in mods.traits)) {
      result.traits[key] = (result.traits[key] || 0) + mods[key];
      result.sources.push({ armor: armorItem.name, feature: feat.name, stat: key, value: mods[key] });
    }
  }
  if (mods.evasion != null && typeof mods.evasion === 'number') {
    result.evasion += mods.evasion;
    result.sources.push({ armor: armorItem.name, feature: feat.name, stat: 'evasion', value: mods.evasion });
  }
  if (Array.isArray(mods.rollModifiers)) {
    for (const rm of mods.rollModifiers) {
      const rollType = (rm.trait === 'spellcast' || rm.trait === 'stealth') ? rm.trait : 'other';
      result.rollModifiers.push({
        name: feat.name,
        score: rm.bonus,
        description: rm.label || feat.description || '',
        rollType,
        autoApply: rollType === 'spellcast',
      });
    }
  }

  return result;
}

/**
 * Resolve a weapon from SRD data into the app's weapon format.
 */
export function resolveWeapon(weaponItem) {
  if (!weaponItem) return null;
  const feat = (weaponItem.features || [])[0] || null;
  return {
    name: weaponItem.name,
    damage: weaponItem.damage || '',
    damageType: weaponItem.physical_or_magical || '',
    range: weaponItem.range || '',
    trait: weaponItem.trait || '',
    burden: weaponItem.burden || '',
    feature: feat ? { name: feat.name, description: feat.description || '' } : null,
  };
}

/**
 * Effective range for display and rolls when ancestry/features modify range.
 * Giant ancestry Reach: Melee weapons become Very Close (carries through to map range bands).
 *
 * @param {{ range?: string }} weapon - weapon object with at least range
 * @param {Array<{ name: string }>} ancestryFeatures - character's ancestry (and optionally origin) features for range mutation
 * @returns {string} range string to use (e.g. 'Very Close' for Giant's Melee)
 */
export function getEffectiveWeaponRange(weapon, ancestryFeatures) {
  if (!weapon?.range) return '';
  const hasReach = (ancestryFeatures || []).some(f => f.name === 'Reach');
  if (hasReach && weapon.range === 'Melee') return 'Very Close';
  return weapon.range;
}

/**
 * Build the subset of activeFeatures used for onCharacterRender (ancestry + community + class + subclass).
 * Used during recomputeCharacter before weapons/armor are in the full activeFeatures list.
 *
 * @param {object} result - character result with ancestryFeatures, communityFeatures, classFeatures, subclassFeatures
 * @param {object|null} srdClass - resolved class SRD item
 * @param {object|null} srdSubclass - resolved subclass SRD item
 * @returns {object[]} activeFeatures (ancestry, community, class, subclass only)
 */
function buildActiveFeaturesForRender(result, srdClass, srdSubclass) {
  const active = [];
  for (const f of result.ancestryFeatures || []) {
    const hooks = originFeatures[f.name] || {};
    active.push({ ...f, ...hooks, type: 'ancestry', source: f.sourceItem ?? f.source });
  }
  for (const f of result.communityFeatures || []) {
    const hooks = originFeatures[f.name] || {};
    active.push({ ...f, ...hooks, type: 'community', source: f.sourceItem ?? f.source });
  }
  for (const f of result.classFeatures || []) {
    const hooks = classFeatures[f.name] || {};
    active.push({ ...f, ...hooks, type: 'class', source: srdClass ?? result.class });
  }
  for (const f of result.subclassFeatures || []) {
    const hooks = classFeatures[f.name] || {};
    active.push({ ...f, ...hooks, type: 'subclass', source: srdSubclass ?? result.subclass });
  }
  return active;
}

/**
 * When activeFeatures is not provided (e.g. CharacterDisplay fallback), build from ancestry + community only.
 */
function getRenderActiveFeaturesFromCharData(charData) {
  const active = [];
  for (const f of charData.ancestryFeatures || []) {
    const hooks = originFeatures[f.name] || {};
    active.push({ ...f, ...hooks, type: 'ancestry', source: f.sourceItem ?? f.source });
  }
  for (const f of charData.communityFeatures || []) {
    const hooks = originFeatures[f.name] || {};
    active.push({ ...f, ...hooks, type: 'community', source: f.sourceItem ?? f.source });
  }
  return active;
}

/**
 * Apply declarative passiveStatMods, collect declarative virtualWeapon(s), merge into weapons, run weaponsFilters.
 * No hook or ctx — all behavior from descriptor fields.
 *
 * @param {object} charData - partially-built character result (weapons, ancestryFeatures, etc.)
 * @param {object[]} [activeFeatures] - flat feature list from buildActiveFeaturesForRender; when omitted, built from ancestry + community only
 * @param {number} [weaponIdStart] - next numeric index for virtual weapon IDs (e.g. 2 → wep_2, wep_3, ...)
 * @returns {{ statMods: Array<{stat: string, value: number, source: string}>, virtualWeapons: object[], weapons: object[], thresholdBonus: number, thresholdMajorBonus: number, thresholdSevereBonus: number, thresholdBonusSources: string[] }}
 */
export function runCharacterRender(charData, activeFeatures, weaponIdStart = 0) {
  const features = Array.isArray(activeFeatures) && activeFeatures.length > 0
    ? activeFeatures
    : getRenderActiveFeaturesFromCharData(charData);
  const statMods = [];
  const virtualWeapons = [];
  let nextVirtualWeaponId = weaponIdStart;
  let thresholdMajorBonus = 0;
  let thresholdSevereBonus = 0;
  const thresholdBonusSources = [];

  for (const feature of features) {
    const name = feature.name;
    const psm = feature.passiveStatMods;
    if (psm) {
      if (psm.traits && typeof psm.traits === 'object') {
        for (const [stat, value] of Object.entries(psm.traits)) {
          if (typeof value === 'number') statMods.push({ stat, value, source: name });
        }
      }
      for (const key of Object.keys(psm)) {
        if (key === 'traits' || key === 'rollModifiers') continue;
        const value = psm[key];
        if (key === 'majorThreshold' || key === 'severeThreshold') {
          if (typeof value === 'number') {
            if (key === 'majorThreshold') {
              thresholdMajorBonus += value;
              if (name) thresholdBonusSources.push(name);
            } else {
              thresholdSevereBonus += value;
              if (name) thresholdBonusSources.push(name);
            }
          }
          continue;
        }
        if (typeof value === 'number') statMods.push({ stat: key, value, source: name });
      }
    }
    // Declarative virtualWeapon / virtualWeapons
    const toAdd = feature.virtualWeapon ? [feature.virtualWeapon] : (feature.virtualWeapons || []);
    for (const weapon of toAdd) {
      const id = `wep_${nextVirtualWeaponId++}`;
      virtualWeapons.push({
        ...weapon,
        id,
        name: weapon.name || name,
        _featureName: name,
        feature: weapon.feature || { name, description: weapon.description || '' },
      });
    }
  }

  let weapons = [...(charData.weapons || []).map(w => ({ ...w })), ...virtualWeapons];
  for (const feature of features) {
    if (typeof feature.weaponsFilter === 'function') {
      weapons = feature.weaponsFilter(weapons);
    }
  }
  for (const w of weapons) {
    w.effectiveRange = w.effectiveRange || w.range || '';
  }

  const thresholdBonus = 0; // legacy; use thresholdMajorBonus / thresholdSevereBonus
  return {
    statMods,
    virtualWeapons,
    weapons,
    thresholdBonus,
    thresholdMajorBonus,
    thresholdSevereBonus,
    thresholdBonusSources: [...new Set(thresholdBonusSources)],
  };
}

/**
 * Resolve features from an SRD ancestry item, tagging each with source info.
 */
function resolveFeatures(items, sourceType, sourceName) {
  if (!items || !Array.isArray(items)) return [];
  return items.map(f => ({
    ...f,
    sourceType,
    source: sourceName || sourceType,
  }));
}

/**
 * Build the flat activeFeatures array: merge SRD data with registry hooks and attach type/source.
 * Each entry: { ...srdData, ...registryHooks, type, source }.
 * type: 'ancestry' | 'community' | 'class' | 'subclass' | 'weapon' | 'armor'
 * source: reference to the contributing item (ancestry/community/class/subclass/armor object, or weapon object with id).
 *
 * @param {object} result - fully recomputed character result (weapons have stable ids; ancestry/community may have sourceItem)
 * @param {object|null} srdClass - resolved class SRD item
 * @param {object|null} srdSubclass - resolved subclass SRD item
 * @param {object|null} srdArmor - resolved armor SRD item
 * @returns {object[]} activeFeatures
 */
function buildActiveFeatures(result, srdClass, srdSubclass, srdArmor) {
  const active = [];

  for (const f of result.ancestryFeatures || []) {
    const hooks = originFeatures[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'ancestry',
      source: f.sourceItem ?? f.source,
    });
  }

  for (const f of result.communityFeatures || []) {
    const hooks = originFeatures[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'community',
      source: f.sourceItem ?? f.source,
    });
  }

  for (const f of result.classFeatures || []) {
    const hooks = classFeatures[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'class',
      source: srdClass ?? result.class,
    });
  }

  for (const f of result.subclassFeatures || []) {
    const hooks = classFeatures[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'subclass',
      source: srdSubclass ?? result.subclass,
    });
  }

  const allWeapons = [...(result.weapons || []), ...(result._virtualWeapons || [])];
  for (const weapon of allWeapons) {
    const feat = weapon.feature;
    if (!feat?.name) continue;
    const hooks = weaponFeatures[feat.name] || {};
    active.push({
      name: feat.name,
      description: feat.description ?? '',
      ...hooks,
      type: 'weapon',
      source: weapon,
    });
  }

  if (srdArmor?.features?.length) {
    const feat = srdArmor.features[0];
    const hooks = armorFeatures[feat.name] || {};
    active.push({
      name: feat.name,
      description: feat.description ?? feat.text ?? '',
      ...hooks,
      type: 'armor',
      source: srdArmor,
    });
  }

  return active;
}

/**
 * Collect all domain card ability IDs from level 1 picks + advancements.
 */
export function collectAbilityIds(data) {
  const ids = (data.abilityIds || []).filter(Boolean);
  if (data.advancements) {
    for (const [, adv] of Object.entries(data.advancements)) {
      if (adv.domainCardId) ids.push(adv.domainCardId);
      if (adv.picks) {
        for (const pick of adv.picks) {
          if (pick.type === 'domain_card' && pick.abilityId) ids.push(pick.abilityId);
        }
      }
    }
  }
  return [...new Set(ids)];
}

/**
 * Main recompute function: given raw character data + srdData, returns
 * the character with all derived fields recomputed.
 */
export function recomputeCharacter(data, srdData) {
  if (!data) return data;
  if (!srdData) return data;

  const result = { ...data };
  const level = data.level ?? 1;
  result.tier = tierFromLevel(level);

  // Resolve class
  const srdClass = srdData.classesById?.[data.classId] || null;
  if (srdClass) {
    result.class = srdClass.name;
    result.domains = srdClass.domains || [];
    result.hopeFeature = srdClass.hope_feature || null;
    result.classFeatures = resolveFeatures(srdClass.class_features, 'class', srdClass.name);
  } else {
    result.class = data.class || null;
    result.domains = data.domains || [];
  }

  // Resolve subclass
  const srdSubclass = srdData.subclassesById?.[data.subclassId] || null;
  if (srdSubclass) {
    result.subclass = srdSubclass.name;
    result.spellcastTrait = srdSubclass.spellcast_trait || null;
    const tier = result.tier;
    const subFeatures = [];
    if (srdSubclass.foundation_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.foundation_features, 'subclass', srdSubclass.name));
    }
    if (tier >= 2 && srdSubclass.specialization_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.specialization_features, 'subclass', srdSubclass.name));
    }
    if (tier >= 3 && srdSubclass.mastery_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.mastery_features, 'subclass', srdSubclass.name));
    }
    result.subclassFeatures = subFeatures;
  } else {
    result.subclass = data.subclass || null;
  }

  // Resolve ancestries — always from SRD; originFeatures supplies hooks at runtime
  const ancestryIds = data.ancestryIds || [];
  const ancestryNames = [];
  const ancestryFeatures = [];
  for (const aId of ancestryIds) {
    const srdAnc = srdData.ancestriesById?.[aId];
    if (!srdAnc) continue;
    ancestryNames.push(srdAnc.name);
    const resolved = resolveFeatures(srdAnc.features, 'ancestry', srdAnc.name);
    ancestryFeatures.push(...resolved.map(f => ({
      ...f,
      id: `${aId}-feat-${(f.name || '').toLowerCase().replace(/\s+/g, '-')}`,
      type: 'ancestry',
      sourceItem: srdAnc,
    })));
  }
  if (ancestryNames.length) result.ancestry = ancestryNames;
  if (ancestryFeatures.length) result.ancestryFeatures = ancestryFeatures;

  // Resolve community — always from SRD
  const srdCommunity = srdData.communitiesById?.[data.communityId] || null;
  if (srdCommunity) {
    result.community = srdCommunity.name;
    const resolved = resolveFeatures(srdCommunity.features, 'community', srdCommunity.name);
    result.communityFeatures = resolved.map(f => ({
      ...f,
      id: `${data.communityId}-feat-${(f.name || '').toLowerCase().replace(/\s+/g, '-')}`,
      type: 'community',
      sourceItem: srdCommunity,
    }));
  } else {
    result.community = data.community || null;
  }

  // Derived stats
  result.traits = computeTraits(data.baseTraits, data.advancements, level);
  result.maxHp = computeMaxHp(srdClass, data.advancements, level);
  result.maxStress = computeMaxStress(data.advancements, level);
  result.evasion = computeEvasion(srdClass, data.advancements, level);
  result.proficiency = computeProficiency(data.advancements, level);
  result.maxHope = 6;

  // Resolve armor — always recompute from armorId so clearing to null removes stale stats
  result.armorScore = 0;
  result.armorName = null;
  result.armorThresholds = null;
  result.maxArmor = 0;
  const srdArmor = srdData.armorById?.[data.armorId] || null;
  if (srdArmor) {
    const armorStats = resolveArmor(srdArmor);
    Object.assign(result, armorStats);
  }

  // Apply armor feature modifiers BEFORE weapon modifiers
  const gearSheetCtx = { computed: result, raw: data };
  const armorMods = computeArmorModifiers(srdArmor, gearSheetCtx);
  result.armorMods = armorMods;
  for (const [k, v] of Object.entries(armorMods.traits)) {
    if (result.traits && k in result.traits) result.traits[k] += v;
  }
  if (armorMods.evasion !== 0) result.evasion = (result.evasion ?? 0) + armorMods.evasion;

  // Resolve weapons — always reassign so clearing a weapon ID removes it from the display; assign stable IDs (wep_0, wep_1)
  const weapons = [];
  const primaryWeapon = srdData.weaponsById?.[data.primaryWeaponId];
  const secondaryWeapon = srdData.weaponsById?.[data.secondaryWeaponId];
  if (primaryWeapon) weapons.push({ ...resolveWeapon(primaryWeapon), id: 'wep_0' });
  if (secondaryWeapon) weapons.push({ ...resolveWeapon(secondaryWeapon), id: 'wep_1' });
  // Set effectiveRange fallback before ancestry render
  for (const w of weapons) {
    w.effectiveRange = w.effectiveRange || w.range || '';
  }
  result.weapons = weapons;

  // Run onCharacterRender and passiveStatMods over ancestry + community + class + subclass (unified loop)
  const renderFeatures = buildActiveFeaturesForRender(result, srdClass, srdSubclass);
  const characterRenderResult = runCharacterRender(result, renderFeatures, result.weapons.length);
  result.weapons = characterRenderResult.weapons;
  result._virtualWeapons = characterRenderResult.virtualWeapons;
  const ancestryMods = { traits: {}, maxHp: 0, maxStress: 0, evasion: 0 };
  for (const mod of characterRenderResult.statMods) {
    if (TRAIT_KEYS.includes(mod.stat)) {
      ancestryMods.traits[mod.stat] = (ancestryMods.traits[mod.stat] || 0) + mod.value;
      if (result.traits && mod.stat in result.traits) result.traits[mod.stat] += mod.value;
    } else if (mod.stat === 'maxHp') {
      ancestryMods.maxHp += mod.value;
      result.maxHp = (result.maxHp ?? 0) + mod.value;
    } else if (mod.stat === 'maxStress') {
      ancestryMods.maxStress += mod.value;
      result.maxStress = (result.maxStress ?? 0) + mod.value;
    } else if (mod.stat === 'evasion') {
      ancestryMods.evasion += mod.value;
      result.evasion = (result.evasion ?? 0) + mod.value;
    }
  }
  if (characterRenderResult.thresholdBonus > 0) {
    result.ancestryThresholdBonus = characterRenderResult.thresholdBonus;
    if (characterRenderResult.thresholdBonusSources?.length) result.ancestryThresholdBonusSource = characterRenderResult.thresholdBonusSources.join(', ');
  }
  if (characterRenderResult.thresholdMajorBonus != null && characterRenderResult.thresholdMajorBonus > 0) {
    result.ancestryThresholdMajorBonus = characterRenderResult.thresholdMajorBonus;
  }
  if (characterRenderResult.thresholdSevereBonus != null && characterRenderResult.thresholdSevereBonus > 0) {
    result.ancestryThresholdSevereBonus = characterRenderResult.thresholdSevereBonus;
  }
  if (characterRenderResult.thresholdBonusSources?.length) {
    result.ancestryThresholdBonusSource = characterRenderResult.thresholdBonusSources.join(', ');
  }
  result.ancestryMods = { ...ancestryMods, statMods: characterRenderResult.statMods };
  // Refresh effectiveRange for weapons mutated by ancestry features
  for (const w of result.weapons) {
    w.effectiveRange = w.effectiveRange || w.range || '';
  }

  // Apply weapon property modifiers (e.g. Cumbersome -1 Finesse, Heavy -1 Evasion)
  const weaponMods = computeWeaponModifiers(result.weapons || [], gearSheetCtx);
  result.weaponMods = weaponMods;
  for (const [k, v] of Object.entries(weaponMods.traits)) {
    if (result.traits && k in result.traits) result.traits[k] += v;
  }
  if (weaponMods.evasion !== 0) result.evasion = (result.evasion ?? 0) + weaponMods.evasion;
  if (weaponMods.armorScore !== 0) {
    result.armorScore = (result.armorScore ?? 0) + weaponMods.armorScore;
    result.maxArmor = (result.maxArmor ?? 0) + weaponMods.armorScore;
  }
  if (weaponMods.severeThreshold !== 0 && result.armorThresholds) {
    result.armorThresholds = {
      ...result.armorThresholds,
      severe: result.armorThresholds.severe + weaponMods.severeThreshold,
    };
  }

  // Resolve abilities (domain cards)
  const allAbilityIds = collectAbilityIds(result);
  if (srdData.abilitiesById && allAbilityIds.length) {
    result.abilities = allAbilityIds.map(id => srdData.abilitiesById[id]).filter(Boolean);
  }

  // Ancestry experience bonus (e.g. Clank Purposeful Design): apply to chosen experience for display.
  // Use base 2 for the chosen experience so we never double-add (saved data may already have score 3).
  const expBonusFeat = result.ancestryFeatures?.find(f => typeof originFeatures[f.name]?.experienceBonus === 'number');
  const expBonus = expBonusFeat
    ? { amount: originFeatures[expBonusFeat.name].experienceBonus, featureName: expBonusFeat.name }
    : null;
  if (expBonus) {
    const choice = data.experienceBonusChoices?.[expBonus.featureName];
    const baseScore = 2;
    result.experiences = (result.experiences || []).map(exp => ({
      ...exp,
      score: exp.id === choice ? baseScore + expBonus.amount : (exp.score ?? baseScore),
    }));
  }

  assignBeastformDisplayFeatures(result, data, srdData);

  result.activeFeatures = buildActiveFeatures(result, srdClass, srdSubclass, srdArmor);

  return result;
}

// Mapping from SRD stat name strings to internal stat keys (exported for backwards compatibility).
const WEAPON_STAT_MAP = {
  'finesse':                  { type: 'trait', key: 'finesse' },
  'agility':                  { type: 'trait', key: 'agility' },
  'strength':                 { type: 'trait', key: 'strength' },
  'instinct':                 { type: 'trait', key: 'instinct' },
  'presence':                 { type: 'trait', key: 'presence' },
  'knowledge':                { type: 'trait', key: 'knowledge' },
  'evasion':                  { type: 'evasion' },
  'armor score':              { type: 'armorScore' },
  'severe damage threshold':  { type: 'severeThreshold' },
};

/**
 * Compute weapon stat modifiers from the registry only.
 * Returns { traits, evasion, armorScore, severeThreshold, sources }.
 * No parsing — weapon features must have passiveStatMods in the weapon feature registry.
 *
 * When {@link isV2DeclarativeSheetEnabled}, passive mods come from `src/features-v2/weapon_properties`
 * first; Phase 1 `weaponFeatures` fills gaps (e.g. roll-only metadata not ported to V2).
 *
 * @param {object[]} weapons
 * @param {{ computed?: object, raw?: object }} [sheetCtx] — pass `{ computed: result, raw: data }` from `recomputeCharacter`
 */
export function computeWeaponModifiers(weapons, sheetCtx) {
  const result = {
    traits: {},
    evasion: 0,
    armorScore: 0,
    severeThreshold: 0,
    sources: [],
  };
  if (!weapons?.length) return result;

  for (const w of weapons) {
    const featureName = w.feature?.name;
    if (!featureName) continue;
    const v2d = v2WeaponProperties[featureName];
    const p1d = weaponFeatures[featureName];
    const mods = resolveGearPassiveStatMods(v2d, p1d, featureName, sheetCtx);
    if (!mods) continue;

    if (mods.traits && typeof mods.traits === 'object') {
      for (const [key, value] of Object.entries(mods.traits)) {
        if (TRAIT_KEYS.includes(key)) {
          result.traits[key] = (result.traits[key] || 0) + value;
          result.sources.push({ weapon: w.name, feature: featureName, stat: key, value });
        }
      }
    }
    for (const key of TRAIT_KEYS) {
      if (mods[key] != null && typeof mods[key] === 'number' && !(mods.traits && key in mods.traits)) {
        result.traits[key] = (result.traits[key] || 0) + mods[key];
        result.sources.push({ weapon: w.name, feature: featureName, stat: key, value: mods[key] });
      }
    }
    if (mods.evasion != null && typeof mods.evasion === 'number') {
      result.evasion += mods.evasion;
      result.sources.push({ weapon: w.name, feature: featureName, stat: 'evasion', value: mods.evasion });
    }
    if (mods.armorScore != null && typeof mods.armorScore === 'number') {
      result.armorScore += mods.armorScore;
      result.sources.push({ weapon: w.name, feature: featureName, stat: 'armor score', value: mods.armorScore });
    }
    if (mods.severeThreshold != null && typeof mods.severeThreshold === 'number') {
      result.severeThreshold += mods.severeThreshold;
      result.sources.push({ weapon: w.name, feature: featureName, stat: 'severe damage threshold', value: mods.severeThreshold });
    }
  }
  return result;
}

/**
 * Extract the numeric bonus from a Paired feature description, e.g. "+2 to primary weapon damage…" → 2.
 */
export function parsePairedBonus(featText) {
  if (!featText) return 2;
  const m = featText.match(/\+(\d+)/);
  return m ? parseInt(m[1], 10) : 2;
}

/**
 * Apply a flat numeric bonus to a damage string.
 * "d8" → "d8+2", "d8+1" → "d8+3", "2d6-1" → "2d6+1"
 */
export function applyDamageBonus(damageStr, bonus) {
  if (!damageStr || bonus === 0) return damageStr;
  const m = damageStr.trim().match(/^([^\s+\-]+)([+-]\d+)?(\s+.*)?$/);
  if (!m) return `${damageStr}+${bonus}`;
  const dice = m[1];
  const existing = m[2] ? parseInt(m[2], 10) : 0;
  const suffix = m[3] || '';
  const total = existing + bonus;
  const mod = total > 0 ? `+${total}` : total < 0 ? String(total) : '';
  return `${dice}${mod}${suffix}`;
}

/**
 * Detect paired weapons: find the secondary with a "Paired" feature and its primary partner.
 * Returns { primaryWeapon, pairedWeapon } or null.
 */
export function detectPairedWeapons(weapons) {
  if (!weapons || weapons.length < 2) return null;
  const pairedIdx = weapons.findIndex(w => w.feature?.name?.toLowerCase() === 'paired');
  if (pairedIdx === -1) return null;
  const pairedWeapon = weapons[pairedIdx];
  const primaryWeapon = weapons.find((w, i) => i !== pairedIdx);
  if (!primaryWeapon) return null;
  return { primaryWeapon, pairedWeapon };
}

/**
 * Parse a Versatile weapon's feature text and return a virtual alternate weapon.
 * Versatile feature text format: "This weapon can also be used with these statistics—{Trait}, {Range}, {Damage}."
 * Returns an alternate weapon object or null.
 */
export function parseVersatileAlternate(weapon) {
  const feat = weapon.feature;
  if (!feat || feat.name !== 'Versatile') return null;
  const text = feat.description || feat.text || '';
  const m = text.match(/—([^.]+)/);
  if (!m) return null;
  const parts = m[1].split(',').map(s => s.trim());
  if (parts.length < 3) return null;
  const [trait, range, damage] = parts;
  return {
    name: `${weapon.name} (Versatile)`,
    damage,
    damageType: weapon.damageType,
    range,
    trait,
    feature: weapon.feature,
    _versatile: true,
  };
}

/**
 * Returns an array of { original, alternate } for all Versatile weapons in the list.
 */
export function detectVersatileWeapons(weapons) {
  const result = [];
  for (const w of (weapons || [])) {
    if (w.feature?.name === 'Versatile') {
      const alternate = parseVersatileAlternate(w);
      if (alternate) result.push({ original: w, alternate });
    }
  }
  return result;
}

/**
 * Returns an array of { original, physicalVariant, magicalVariant } for all Otherworldly weapons.
 * Otherworldly feature text: "On a successful attack, you can deal physical or magic damage."
 */
export function detectOtherworldlyWeapons(weapons) {
  const result = [];
  for (const w of (weapons || [])) {
    if (w.feature?.name === 'Otherworldly') {
      const physicalVariant = { ...w, name: `${w.name} (Physical)`, damageType: 'Physical', _otherworldly: 'physical' };
      const magicalVariant = { ...w, name: `${w.name} (Magical)`, damageType: 'Magical', _otherworldly: 'magical' };
      result.push({ original: w, physicalVariant, magicalVariant });
    }
  }
  return result;
}

/**
 * Rewrite a damage string to add one extra die (for Charged feature).
 * e.g. "d8+3" → "2d8+3", "2d6" → "3d6"
 */
export function rewriteDamageForCharged(damageStr) {
  if (!damageStr) return damageStr;
  const m = damageStr.trim().match(/^(\d*)(d\d+)(.*)$/i);
  if (!m) return damageStr;
  const qty = parseInt(m[1] || '1', 10);
  return `${qty + 1}${m[2]}${m[3] || ''}`;
}

/**
 * Returns an array of { original, chargedVariant } for all Charged weapons.
 * Charged feature text: "Mark a Stress to gain +1 to your Proficiency on a primary weapon attack."
 */
export function detectChargedWeapons(weapons) {
  const result = [];
  for (const w of (weapons || [])) {
    if (w.feature?.name === 'Charged') {
      const chargedVariant = {
        ...w,
        name: `${w.name} (Charged)`,
        damage: rewriteDamageForCharged(w.damage),
        _charged: true,
      };
      result.push({ original: w, chargedVariant });
    }
  }
  return result;
}

/**
 * Check if a character has all required fields filled in.
 * Returns { complete: boolean, missing: string[] }.
 * @param {object} data — character form or resolved character data
 * @param {{ ancestryName?: string, srdData?: { ancestriesById?: Record<string, { name: string }> } }} [opts] — optional; ancestryName or srdData (to resolve ancestryIds) for experience-bonus requirement
 */
export function isCharacterComplete(data, opts) {
  if (!data) return { complete: false, missing: ['No data'] };
  const missing = [];
  if (!data.name?.trim()) missing.push('Name');
  if (!data.classId && !data.class) missing.push('Class');
  if (!data.subclassId && !data.subclass) missing.push('Subclass');
  if (!(data.ancestryIds?.length) && !data.ancestry?.length) missing.push('Ancestry');
  if (!data.communityId && !data.community) missing.push('Community');
  const experienceCount = (data.experiences || []).filter(e => e.name?.trim()).length;
  if (experienceCount < 2) missing.push('Experiences (need 2)');
  const allIds = collectAbilityIds(data);
  // data.abilities is derived from the same abilityIds by recomputeCharacter, so use Math.max
  // to avoid double-counting while still supporting Daggerstack characters that store full
  // ability objects in data.abilities rather than just IDs.
  const abilityCount = Math.max(allIds.length, (data.abilities || []).length);

  if (abilityCount < 2) missing.push('Domain Cards (need 2)');
  // Ancestry experience bonus (e.g. Clank Purposeful Design): require chosen experience
  const ancestryId = data.ancestryIds?.[0];
  const srdAnc = opts?.srdData?.ancestriesById?.[ancestryId];
  const ancestryFeatureNames = srdAnc?.features?.map(f => f.name) ?? [];
  const expBonusFeatName = ancestryFeatureNames.find(n => typeof originFeatures[n]?.experienceBonus === 'number');
  const expBonus = expBonusFeatName
    ? { amount: originFeatures[expBonusFeatName].experienceBonus, featureName: expBonusFeatName }
    : null;
  if (expBonus) {
    const choice = data.experienceBonusChoices?.[expBonus.featureName];
    const experienceIds = (data.experiences || []).map(e => e.id).filter(Boolean);
    if (choice == null || choice === '' || !experienceIds.includes(choice)) {
      missing.push(`${expBonus.featureName}: choose an experience for +${expBonus.amount}`);
    }
  }
  // Beastbound requires companion name, species, attack name, and two experiences
  if (data.subclass === 'Beastbound') {
    if (!data.companion?.name?.trim()) missing.push('Companion name');
    if (!data.companion?.species?.trim()) missing.push('Companion species');
    if (!data.companion?.attackName?.trim()) missing.push('Companion attack name');
    const companionExpCount = (data.companion?.experiences || []).filter(e => e.name?.trim()).length;
    if (companionExpCount < 2) missing.push('Companion experiences (need 2)');
  }
  return { complete: missing.length === 0, missing };
}

export { TRAIT_KEYS, TRAIT_POOL, TIER_LEVELS, WEAPON_STAT_MAP };
