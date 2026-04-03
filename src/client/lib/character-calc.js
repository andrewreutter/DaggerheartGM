/**
 * Character calculation utilities.
 * Pure functions that compute derived stats from character selections + SRD data.
 */

import { BEASTFORM_ITEMS } from '../../features-v2/beastforms/srd-data.js';
import { weapon_properties as v2WeaponProperties, armor_properties as v2ArmorProperties } from '../../features-v2/registry.js';
import v2Abilities from '../../features-v2/abilities/index.js';
import { isWhen, unwrap, unwrapAll } from '../../features-v2/engine/when.js';
import { buildTableSnapshot } from '../../features-v2/engine/table.js';
import { v2OriginFeatureDescriptorsByName } from './v2-origin-feature-descriptors.js';
import { v2ClassSubclassFeatureDescriptorsByName } from './v2-class-subclass-feature-descriptors.js';
import { EXPERIENCE_BONUS_BY_FEATURE_NAME } from './ancestry-experience-bonus.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../features-v2/engine/feature-scope-keys.js';
import { enrichHoverActionMeta } from '../../features-v2/engine/hover-action-enrich.js';
import {
  advancementLevelToBand,
  countAutomaticProficiencyBonuses,
  dedupeTraitPicksAcrossLevelRow,
  deriveSubclassUnlockSteps,
  normalizeDomainLoadoutIds,
  expectedExperienceRowCount,
  missingLevelAdvancementChoices,
  hasAdvancementChoicesLockField,
  isAdvancementLockedThroughCurrentLevel,
} from './advancement-rules.js';

const TIER_LEVELS = [1, 2, 5, 8]; // level thresholds for tiers 1–4

const DRUID_CLASS_ID = 'srd-cls-druid';

/**
 * Active beastform id for sheet display — denormalized `activeBeastform` or Druid scoped `featureState` bag.
 * Matches engine `table.me.inBeastform` sources.
 */
function getActiveBeastformIdFromCharacterData(data) {
  const ab = data?.activeBeastform;
  if (ab && typeof ab === 'object') {
    const id = ab.id || ab.beastformId;
    if (id) return { id, legacyAb: ab };
  }
  const fs = data?.featureState;
  if (!fs || typeof fs !== 'object') return { id: null, legacyAb: null };
  const id = fs[SRD_CLASS_DRUID_SCOPE_KEY]?.activeBeastform?.beastformId ?? null;
  return { id, legacyAb: null };
}

function resolveBeastformRowById(id, srdData) {
  if (!id) return null;
  const fromApi = srdData?.beastformsById?.[id];
  if (fromApi) return fromApi;
  return BEASTFORM_ITEMS.find((r) => r.id === id) || null;
}

/**
 * SRD `trait_bonus` / `evasion_bonus` strings for the character's active beastform.
 * Table/runtime `activeBeastform` often stores only `{ id, name }` or lives in `featureState` only —
 * use this to enrich display (CharacterTraitGrid / DefenseRow) and helpers.
 *
 * @returns {{ id: string, name: string, trait_bonus?: string, evasion_bonus?: string, attack?: string, advantages?: string } | null}
 */
export function getResolvedActiveBeastformBonuses(data, srdData) {
  const { id, legacyAb } = getActiveBeastformIdFromCharacterData(data);
  if (!id) return null;
  const row = resolveBeastformRowById(id, srdData);
  if (!row) return null;
  return {
    id,
    name: row.name || legacyAb?.name || 'Beastform',
    trait_bonus: row.trait_bonus,
    evasion_bonus: row.evasion_bonus,
    attack: row.attack,
    advantages: row.advantages,
  };
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
  const { id, legacyAb } = getActiveBeastformIdFromCharacterData(data);
  if (!id) {
    return;
  }
  const row = resolveBeastformRowById(id, srdData);
  if (!row?.features?.length) return;
  const formName = row.name || legacyAb?.name || 'Beastform';
  result.beastformFeatures = row.features.map((f) => ({
    name: f.name,
    description: f.description || '',
    source: formName,
    sourceType: 'beastform',
    id: f.id,
  }));
}

/** Same shape as `parseBeastformBonus` in helpers — kept local to avoid importing helpers (helpers imports this module). */
function parseBeastformStatLine(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\w+)\s*([+-]\d+)$/i);
  if (!m) return null;
  return { stat: m[1].toLowerCase(), bonus: parseInt(m[2], 10) };
}

/**
 * Add active beastform `evasion_bonus` (SRD row) into `result.evasion` so sheet total matches tooltips / combat.
 * Sets `evasionIncludesActiveBeastformBonus` so {@link effectiveEvasion} does not double-count.
 */
function applyActiveBeastformEvasionBonus(result, data, srdData) {
  const isDruid = data.classId === DRUID_CLASS_ID || result.class === 'Druid';
  if (!isDruid) return;
  const merged = { ...data, ...result, featureState: data.featureState ?? result.featureState };
  const bf = getResolvedActiveBeastformBonuses(merged, srdData);
  if (!bf?.evasion_bonus) return;
  const parsed = parseBeastformStatLine(bf.evasion_bonus);
  if (parsed?.stat !== 'evasion' || !parsed.bonus) return;
  result.evasion = (result.evasion ?? 0) + parsed.bonus;
  result.evasionIncludesActiveBeastformBonus = true;
}

export function tierFromLevel(level) {
  if (level >= 8) return 4;
  if (level >= 5) return 3;
  if (level >= 2) return 2;
  return 1;
}

const TRAIT_POOL = [2, 1, 1, 0, 0, -1];
const TRAIT_KEYS = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

/** Bumped when `migrateCharacterLevelingData` applies a new normalization pass. */
export const LEVELING_SCHEMA_VERSION = 2;

/**
 * Map SRD subclass `spellcast_trait` string (e.g. "Presence") to a trait key, or null.
 */
export function spellcastTraitNameToKey(name) {
  if (name == null || String(name).trim() === '') return null;
  const k = String(name).trim().toLowerCase();
  return TRAIT_KEYS.includes(k) ? k : null;
}

/** Same contract as `parseBeastformBonus` in helpers (avoid circular import helpers → character-calc). */
function parseBeastformTraitBonusLocal(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\w+)\s*([+-]\d+)$/i);
  if (!m) return null;
  return { stat: m[1].toLowerCase(), bonus: parseInt(m[2], 10) };
}

function effectiveTraitScoreForSpellcastCompare(el, traitKey) {
  const traits = el.traits || {};
  const score = traits[traitKey] ?? 0;
  const wMod = el.weaponMods?.traits?.[traitKey] ?? 0;
  const aMod = el.armorMods?.traits?.[traitKey] ?? 0;
  const beastformTraitBonus = parseBeastformTraitBonusLocal(el.activeBeastform?.trait_bonus);
  const bfMod = beastformTraitBonus?.stat === traitKey ? beastformTraitBonus.bonus : 0;
  return score + wMod + aMod + bfMod;
}

/**
 * When both primary and multiclass subclasses define a Spellcast trait, pick the one with the higher **effective**
 * sheet score (base + advancement + weapon/armor/beastform modifiers). Tie → primary subclass.
 */
export function resolveSpellcastTraitFromTraitScores({
  primaryTraitName,
  multiclassTraitName,
  traits,
  weaponMods,
  armorMods,
  activeBeastform,
}) {
  const pk = spellcastTraitNameToKey(primaryTraitName);
  const mk = spellcastTraitNameToKey(multiclassTraitName);
  if (!pk && !mk) return null;
  if (pk && !mk) return pk;
  if (!pk && mk) return mk;
  const el = { traits, weaponMods, armorMods, activeBeastform };
  const ep = effectiveTraitScoreForSpellcastCompare(el, pk);
  const em = effectiveTraitScoreForSpellcastCompare(el, mk);
  if (ep > em) return pk;
  if (em > ep) return mk;
  return pk;
}

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
        if (!pick) continue;
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
        if (!pick) continue;
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
        if (!pick) continue;
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
        if (!pick) continue;
        if (pick.type === 'evasion') evasion += 1;
      }
    }
  }
  return evasion;
}

/**
 * Compute proficiency: base 1 + automatic +1 at each tier entry (levels 2, 5, 8) + advancement picks.
 */
export function computeProficiency(advancements, level) {
  const lv = level || 1;
  let prof = 1 + countAutomaticProficiencyBonuses(lv);
  if (advancements) {
    for (let lvl = 2; lvl <= lv; lvl++) {
      const adv = advancements[String(lvl)];
      if (!adv?.picks) continue;
      for (const pick of adv.picks) {
        if (!pick) continue;
        if (pick.type === 'proficiency') prof += 1;
      }
    }
  }
  return prof;
}

/**
 * Book weapon damage: number of dice equals Proficiency; preserves modifiers / suffix after the die chunk.
 */
export function scaleWeaponDamageByProficiency(damageStr, proficiency) {
  if (damageStr == null || damageStr === '') return damageStr;
  const p = Number(proficiency);
  if (!Number.isFinite(p) || p < 1) return damageStr;
  const m = String(damageStr).trim().match(/^(\d*)(d\d+)(.*)$/i);
  if (!m) return damageStr;
  return `${p}${m[2]}${m[3] || ''}`;
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
 * `featureState['armor:<armorId>']` so V2 Reinforced predicates (`table.source`) can see it.
 *
 * @param {object} computed — partial recompute output (traits, tier, …)
 * @param {object} raw — library / table element (runtime keys, featureState, …)
 */
export function buildV2SheetUnwrapGameState(computed = {}, raw = {}) {
  const instanceId =
    computed.instanceId || raw.instanceId || computed.id || raw.id || '__sheet__';
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
  if (raw.reinforcedActive === true && raw.armorId) {
    const armorScope = `armor:${raw.armorId}`;
    featureState[armorScope] = { ...(featureState[armorScope] || {}), reinforcedActive: true };
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
 * Resolve `passiveStatMods` from the V2 weapon/armor registry (with `unwrap` / `unwrapAll`).
 * Returns null when the feature has no static mods or `when()` predicates do not apply.
 */
function resolveGearPassiveStatMods(v2Descriptor, featureName, sheetCtx) {
  const ctx = sheetCtx || defaultGearSheetContext();
  const base = buildV2SheetUnwrapGameState(ctx.computed, ctx.raw);
  if (!v2Descriptor || v2Descriptor.passiveStatMods === undefined) {
    return null;
  }
  const table = buildTableSnapshot({ ...base, _featureKey: featureName });
  let mods = unwrap(v2Descriptor.passiveStatMods, table);
  if (mods != null && typeof mods === 'object') {
    mods = unwrapAll(mods, table);
  }
  if (mods != null && typeof mods === 'object') {
    return mods;
  }
  return null;
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
 * Compute armor stat and roll modifiers from the V2 armor_properties registry only.
 * Returns { traits, evasion, rollModifiers, feature, sources }.
 *
 * @param {object | null} armorItem
 * @param {{ computed?: object, raw?: object }} [sheetCtx] — pass `{ computed: result, raw: data }` from `recomputeCharacter` for accurate `when()` unwrap
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
  const mods = resolveGearPassiveStatMods(v2d, feat.name, sheetCtx);
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
 * True when an armor sub-feature's only resolved passive stat automation is evasion — already covered by evasion tooltips on the sheet.
 * Unknown or non-V2 feature names return false (caller should still show a card when description matters).
 *
 * @param {string} featName
 * @param {{ computed?: object, raw?: object }} [sheetCtx]
 */
export function isArmorFeatureEvasionOnlyTooltipRedundant(featName, sheetCtx) {
  const v2d = v2ArmorProperties[featName];
  if (!v2d) return false;
  const mods = resolveGearPassiveStatMods(v2d, featName, sheetCtx);
  if (!mods) return false;
  let hasNonEvasion = false;
  if (mods.traits && typeof mods.traits === 'object') {
    for (const [k, v] of Object.entries(mods.traits)) {
      if (TRAIT_KEYS.includes(k) && v) hasNonEvasion = true;
    }
  }
  for (const key of TRAIT_KEYS) {
    if (mods[key] != null && typeof mods[key] === 'number' && !(mods.traits && key in mods.traits)) {
      hasNonEvasion = true;
    }
  }
  if (Array.isArray(mods.rollModifiers) && mods.rollModifiers.length) hasNonEvasion = true;
  const ev = mods.evasion != null && typeof mods.evasion === 'number' && mods.evasion !== 0;
  return ev && !hasNonEvasion;
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
 * @param {object} f — class feature row from `classFeatures`
 * @param {object|null} srdClass
 * @param {object|null} mcClass — multiclass SRD class when `f._multiclass`
 * @param {object} result — partial recompute result
 */
function guideClassFeatureSource(f, srdClass, mcClass, result) {
  if (f?._multiclass) {
    if (mcClass && typeof mcClass === 'object') return mcClass;
    return f.source ?? result.class;
  }
  return srdClass ?? result.class;
}

/**
 * @param {object} f — subclass feature row from `subclassFeatures`
 * @param {object|null} srdSubclass
 * @param {object|null} mcSubclass — multiclass SRD subclass when `f._multiclassSubclass`
 * @param {object} result
 */
function guideSubclassFeatureSource(f, srdSubclass, mcSubclass, result) {
  if (f?._multiclassSubclass) {
    if (mcSubclass && typeof mcSubclass === 'object') return mcSubclass;
    return f.source ?? result.subclass;
  }
  return srdSubclass ?? result.subclass;
}

/**
 * Build the subset of activeFeatures used for onCharacterRender (ancestry + community + class + subclass).
 * Used during recomputeCharacter before weapons/armor are in the full activeFeatures list.
 *
 * @param {object} result - character result with ancestryFeatures, communityFeatures, classFeatures, subclassFeatures
 * @param {object|null} srdClass - resolved class SRD item
 * @param {object|null} srdSubclass - resolved subclass SRD item
 * @param {object|null} [mcClass] - multiclass SRD class when multiclassing
 * @param {object|null} [mcSubclass] - multiclass SRD subclass when multiclassing
 * @returns {object[]} activeFeatures (ancestry, community, class, subclass only)
 */
function buildActiveFeaturesForRender(result, srdClass, srdSubclass, mcClass = null, mcSubclass = null) {
  const active = [];
  for (const f of result.ancestryFeatures || []) {
    const hooks = v2OriginFeatureDescriptorsByName[f.name] || {};
    active.push({ ...f, ...hooks, type: 'ancestry', source: f.sourceItem ?? f.source });
  }
  for (const f of result.communityFeatures || []) {
    const hooks = v2OriginFeatureDescriptorsByName[f.name] || {};
    active.push({ ...f, ...hooks, type: 'community', source: f.sourceItem ?? f.source });
  }
  for (const f of result.classFeatures || []) {
    const hooks = v2ClassSubclassFeatureDescriptorsByName[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'class',
      source: guideClassFeatureSource(f, srdClass, mcClass, result),
    });
  }
  for (const f of result.subclassFeatures || []) {
    const hooks = v2ClassSubclassFeatureDescriptorsByName[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'subclass',
      source: guideSubclassFeatureSource(f, srdSubclass, mcSubclass, result),
    });
  }
  return active;
}

/**
 * When activeFeatures is not provided (e.g. CharacterDisplay fallback), build from ancestry + community only.
 */
function getRenderActiveFeaturesFromCharData(charData) {
  const active = [];
  for (const f of charData.ancestryFeatures || []) {
    const hooks = v2OriginFeatureDescriptorsByName[f.name] || {};
    active.push({ ...f, ...hooks, type: 'ancestry', source: f.sourceItem ?? f.source });
  }
  for (const f of charData.communityFeatures || []) {
    const hooks = v2OriginFeatureDescriptorsByName[f.name] || {};
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
      // V2 `virtualWeapon: when(...)` is resolved in `applyDeclarativeFeatures` and merged in
      // `mergeV2DeclarativeSheetOverlay` — do not spread the when-wrapper here (yields a broken stub).
      if (isWhen(weapon)) continue;
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
 * Build the flat activeFeatures array: merge SRD data with V2 descriptors and attach type/source.
 * Each entry: { ...srdData, ...v2Hooks, type, source }.
 * type: 'ancestry' | 'community' | 'class' | 'subclass' | 'weapon' | 'armor'
 * source: reference to the contributing item (ancestry/community/class/subclass/armor object, or weapon object with id).
 *
 * @param {object} result - fully recomputed character result (weapons have stable ids; ancestry/community may have sourceItem)
 * @param {object|null} srdClass - resolved class SRD item
 * @param {object|null} srdSubclass - resolved subclass SRD item
 * @param {object|null} srdArmor - resolved armor SRD item
 * @param {object|null} [mcClass] - multiclass SRD class when multiclassing
 * @param {object|null} [mcSubclass] - multiclass SRD subclass when multiclassing
 * @returns {object[]} activeFeatures
 */
function buildActiveFeatures(result, srdClass, srdSubclass, srdArmor, mcClass = null, mcSubclass = null) {
  const active = [];

  for (const f of result.ancestryFeatures || []) {
    const hooks = v2OriginFeatureDescriptorsByName[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'ancestry',
      source: f.sourceItem ?? f.source,
    });
  }

  for (const f of result.communityFeatures || []) {
    const hooks = v2OriginFeatureDescriptorsByName[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'community',
      source: f.sourceItem ?? f.source,
    });
  }

  for (const f of result.classFeatures || []) {
    const hooks = v2ClassSubclassFeatureDescriptorsByName[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'class',
      source: guideClassFeatureSource(f, srdClass, mcClass, result),
    });
  }

  for (const f of result.subclassFeatures || []) {
    const hooks = v2ClassSubclassFeatureDescriptorsByName[f.name] || {};
    active.push({
      ...f,
      ...hooks,
      type: 'subclass',
      source: guideSubclassFeatureSource(f, srdSubclass, mcSubclass, result),
    });
  }

  const allWeapons = [...(result.weapons || []), ...(result._virtualWeapons || [])];
  for (const weapon of allWeapons) {
    const feat = weapon.feature;
    if (!feat?.name) continue;
    const hooks = v2WeaponProperties[feat.name] || {};
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
    const hooks = v2ArmorProperties[feat.name] || {};
    active.push({
      name: feat.name,
      description: feat.description ?? feat.text ?? '',
      ...hooks,
      type: 'armor',
      source: srdArmor,
    });
  }

  const abilityIds = collectAbilityIds(result);
  for (const aid of abilityIds) {
    const hooks = v2Abilities[aid];
    if (!hooks || typeof hooks !== 'object') continue;
    const srdAbility = (result.abilities || []).find((a) => a.id === aid) || { id: aid, name: hooks.name };
    active.push({
      name: hooks.name,
      description: hooks.description ?? srdAbility.description ?? '',
      ...hooks,
      type: 'ability',
      source: srdAbility,
      id: aid,
    });
  }

  return active.map((row) => enrichHoverActionMeta(row));
}

/**
 * Applies stored per-level `advancements[L].domainTrade` (fromId → toId) in level order (2…maxLevel)
 * on a copy of the character. Raw `abilityIds` / advancement fields keep original picks;
 * this is used for display, loadout, and duplicate checks.
 *
 * @param {object} data — raw character data (may include `advancements[L].domainTrade`)
 * @param {number} maxLevel — apply trades through this character level (inclusive)
 */
export function resolveDomainTradesThroughLevel(data, maxLevel) {
  const cap = Number(maxLevel) || 0;
  if (!data || cap < 2) return { ...data };
  let acc = { ...data };
  for (let lvl = 2; lvl <= cap; lvl++) {
    const t = data.advancements?.[String(lvl)]?.domainTrade;
    if (t?.fromId && t?.toId && t.fromId !== t.toId) {
      acc = replaceDomainAbilityIdEverywhere(acc, t.fromId, t.toId);
    }
  }
  return acc;
}

/**
 * All known domain card IDs (starting picks + per-level advancement cards), stable order.
 * Resolves domain trades through current level.
 */
export function collectOwnedDomainAbilityIds(data) {
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  const maxLv = data.level ?? 1;
  const resolved = resolveDomainTradesThroughLevel(data, maxLv);
  for (const id of resolved.abilityIds || []) add(id);
  for (let lvl = 2; lvl <= maxLv; lvl++) {
    const adv = resolved.advancements?.[String(lvl)];
    if (adv?.domainCardId) add(adv.domainCardId);
    for (const pick of adv?.picks || []) {
      if (pick?.type === 'domain_card' && pick.abilityId) add(pick.abilityId);
    }
  }
  return ids;
}

/**
 * Domain card IDs the character had after completing {@link maxCharacterLevel} (inclusive):
 * creation slots whose {@link domainSlotAcquiredLevel} is ≤ that level, plus advancement rows 2…maxCharacterLevel.
 * Applies {@link resolveDomainTradesThroughLevel} through `maxCharacterLevel` first, then collects (same as raw
 * ordering, but IDs reflect trades through that level).
 *
 * Used for level-N trade UI: “From” may only list cards owned by end of level N−1.
 *
 * @param {object} data
 * @param {number} maxCharacterLevel — cap (e.g. `advancementLevel - 1` when editing that level’s row)
 */
export function collectOwnedDomainAbilityIdsThroughCharacterLevel(data, maxCharacterLevel) {
  const cap = Number(maxCharacterLevel) || 0;
  const resolved = resolveDomainTradesThroughLevel(data, cap);
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  const norm = normalizeDomainSlotAcquiredLevels(data);
  const abilityIds = resolved.abilityIds || [];
  for (let i = 0; i < abilityIds.length; i++) {
    const acquired = norm[i] ?? 1;
    if (acquired <= cap) add(abilityIds[i]);
  }
  for (let lvl = 2; lvl <= cap; lvl++) {
    const adv = resolved.advancements?.[String(lvl)];
    if (adv?.domainCardId) add(adv.domainCardId);
    for (const pick of adv?.picks || []) {
      if (pick?.type === 'domain_card' && pick.abilityId) add(pick.abilityId);
    }
  }
  return ids;
}

function hasMulticlassPickThroughLevel(advancements, maxLevel) {
  const cap = Number(maxLevel) || 1;
  if (!advancements || typeof advancements !== 'object') return false;
  for (let lvl = 2; lvl <= cap; lvl++) {
    const adv = advancements[String(lvl)];
    for (const p of adv?.picks || []) {
      if (p?.type === 'multiclass') return true;
    }
  }
  return false;
}

/**
 * Deep-clone JSON-like character data. `structuredClone` throws on functions / some merged table keys;
 * JSON round-trip drops non-serializable fields (safe for level projection).
 */
function cloneCharacterDataForProjection(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return deepClonePlainObjectsOnly(data);
  }
}

function deepClonePlainObjectsOnly(v, seen = new WeakMap()) {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return v;
  if (Array.isArray(v)) {
    const out = [];
    seen.set(v, out);
    for (let i = 0; i < v.length; i++) {
      out[i] = deepClonePlainObjectsOnly(v[i], seen);
    }
    return out;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) {
    return v;
  }
  const o = {};
  seen.set(v, o);
  for (const k of Object.keys(v)) {
    const x = v[k];
    if (typeof x === 'function' || typeof x === 'symbol') continue;
    o[k] = deepClonePlainObjectsOnly(x, seen);
  }
  return o;
}

/**
 * Read-only snapshot of a character at {@link targetLevel} (1…current level) for editor / sheet preview.
 * Strips per-level {@link advancements} rows above the target, trims experiences, filters domain slots by
 * {@link domainSlotAcquiredLevel}, reapplies domain trades through the target level, and clears multiclass
 * when no multiclass pick remains in-range.
 *
 * @param {object} data — full library character shape (same as {@link recomputeCharacter} input)
 * @param {number} targetLevel
 * @returns {object} cloned + projected character data
 */
export function projectCharacterFormToLevel(data, targetLevel) {
  if (!data || typeof data !== 'object') return data;
  const maxLv = Number(data.level) || 1;
  const t = Math.max(1, Math.min(Number(targetLevel) || 1, maxLv));
  const clone = cloneCharacterDataForProjection(data);
  if (t >= maxLv) return clone;

  const out = clone;
  out.level = t;
  out.tier = tierFromLevel(t);

  if (out.advancements && typeof out.advancements === 'object') {
    const next = {};
    for (const k of Object.keys(out.advancements)) {
      const n = Number(k);
      if (!Number.isFinite(n) || n < 2) continue;
      if (n <= t) next[k] = out.advancements[k];
    }
    out.advancements = next;
  }

  const expNeed = expectedExperienceRowCount(t);
  if (Array.isArray(out.experiences)) {
    out.experiences = out.experiences.slice(0, expNeed);
  }

  const norm = normalizeDomainSlotAcquiredLevels(data);
  const partialForTrades = { ...out, level: t };
  const traded = resolveDomainTradesThroughLevel(partialForTrades, t);
  const newIds = [];
  const newAcq = [];
  for (let i = 0; i < (traded.abilityIds || []).length; i++) {
    const acq = norm[i] ?? 1;
    if (acq <= t) {
      newIds.push(traded.abilityIds[i]);
      newAcq.push(acq);
    }
  }
  out.abilityIds = newIds;
  out.domainSlotAcquiredLevel = newAcq;

  const owned = collectOwnedDomainAbilityIds({ ...out, level: t });
  out.domainLoadoutIds = normalizeDomainLoadoutIds(owned, out.domainLoadoutIds);

  if (!hasMulticlassPickThroughLevel(out.advancements, t)) {
    out.multiclassClassId = null;
    out.multiclassSubclassId = null;
    out.multiclassDomain = null;
  }

  const acl = Number(out.advancementChoicesLockedThroughLevel);
  if (Number.isFinite(acl) && acl > t) {
    out.advancementChoicesLockedThroughLevel = t;
  }

  return migrateCharacterLevelingData(out);
}

/**
 * One-time normalization for leveling data (idempotent). Strips Tier-2-invalid advancement picks,
 * dedupes domain loadout, and stamps {@link LEVELING_SCHEMA_VERSION} when changed.
 */
export function migrateCharacterLevelingData(data) {
  if (!data || typeof data !== 'object') return data;
  let changed = false;
  const next = { ...data };
  const lv = Number(data.level) || 1;

  if (next.advancements && typeof next.advancements === 'object') {
    const advIn = { ...next.advancements };
    for (let lvl = 2; lvl <= lv; lvl++) {
      if (advancementLevelToBand(lvl) !== 'A') continue;
      const key = String(lvl);
      const row = advIn[key];
      if (!row?.picks?.length) continue;
      let rowChanged = false;
      const picks = row.picks.map((p) => {
        if (!p) return p;
        if (p.type === 'subclass_upgrade' || p.type === 'proficiency') {
          rowChanged = true;
          return null;
        }
        return p;
      });
      if (rowChanged) {
        advIn[key] = { ...row, picks };
        changed = true;
      }
    }
    for (let lvl = 2; lvl <= lv; lvl++) {
      const key = String(lvl);
      const row = advIn[key];
      if (!row?.picks?.length) continue;
      const deduped = dedupeTraitPicksAcrossLevelRow(row.picks);
      const same =
        deduped.length === row.picks.length &&
        deduped.every((p, i) => JSON.stringify(p) === JSON.stringify(row.picks[i]));
      if (!same) {
        advIn[key] = { ...row, picks: deduped };
        changed = true;
      }
    }
    next.advancements = advIn;
  }

  const owned = collectOwnedDomainAbilityIds(next);
  const normLoad = normalizeDomainLoadoutIds(owned, next.domainLoadoutIds);
  const prevStr = JSON.stringify(next.domainLoadoutIds || []);
  const nextStr = JSON.stringify(normLoad);
  if (prevStr !== nextStr) {
    next.domainLoadoutIds = normLoad;
    changed = true;
  }

  if (changed && (next.levelingSchemaVersion ?? 0) < LEVELING_SCHEMA_VERSION) {
    next.levelingSchemaVersion = LEVELING_SCHEMA_VERSION;
  }

  return next;
}

function newExperienceRowId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Parallel to `abilityIds`: level at which each starting-domain slot was added (1 = creation).
 */
export function normalizeDomainSlotAcquiredLevels(data) {
  const ids = data.abilityIds || [];
  const raw = data.domainSlotAcquiredLevel;
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const n = raw?.[i];
    out.push(Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
  }
  return out;
}

/**
 * When `abilityIds` length changes, extend or trim `domainSlotAcquiredLevel` (new slots = current level).
 */
export function syncDomainSlotAcquiredLevelForAbilityIds(prevData, newAbilityIds) {
  const old = prevData.abilityIds || [];
  const raw = prevData.domainSlotAcquiredLevel || [];
  const lv = prevData.level ?? 1;
  return newAbilityIds.map((_, i) => {
    if (i < raw.length && Number(raw[i]) >= 1) return Math.floor(Number(raw[i]));
    if (i < old.length) return 1;
    return lv;
  });
}

/**
 * Replace one domain ability id everywhere (creation slots, advancement rows, loadout). Immutable.
 */
export function replaceDomainAbilityIdEverywhere(data, oldId, newId) {
  if (!data || !oldId || !newId || oldId === newId) return { ...data };
  const next = { ...data };

  if (Array.isArray(next.abilityIds)) {
    next.abilityIds = next.abilityIds.map((id) => (id === oldId ? newId : id));
  }

  if (Array.isArray(next.domainLoadoutIds)) {
    next.domainLoadoutIds = next.domainLoadoutIds.map((id) => (id === oldId ? newId : id));
  }

  const advIn = next.advancements && typeof next.advancements === 'object' ? next.advancements : {};
  const adv = { ...advIn };
  for (const k of Object.keys(adv)) {
    const row = adv[k] && typeof adv[k] === 'object' ? { ...adv[k] } : {};
    if (row.domainCardId === oldId) row.domainCardId = newId;
    if (Array.isArray(row.picks)) {
      row.picks = row.picks.map((p) => {
        if (!p || p.type !== 'domain_card' || p.abilityId !== oldId) return p;
        return { ...p, abilityId: newId };
      });
    }
    adv[k] = row;
  }
  next.advancements = adv;
  return next;
}

/**
 * Active domain cards for casting / V2 (max five — {@link normalizeDomainLoadoutIds}).
 */
export function collectAbilityIds(data) {
  const owned = collectOwnedDomainAbilityIds(data);
  return normalizeDomainLoadoutIds(owned, data.domainLoadoutIds);
}

/**
 * Domain card IDs the character knows but does not have in the active loadout (only when they know more than five cards).
 */
export function collectVaultAbilityIds(data) {
  const owned = collectOwnedDomainAbilityIds(data);
  if (owned.length <= 5) return [];
  const loadout = new Set(collectAbilityIds(data));
  return owned.filter((id) => !loadout.has(id));
}

/**
 * Main recompute function: given raw character data + srdData, returns
 * the character with all derived fields recomputed.
 */
export function recomputeCharacter(data, srdData) {
  if (!data) return data;
  if (!srdData) return data;

  const charData = migrateCharacterLevelingData(data);
  const result = { ...charData };
  const level = charData.level ?? 1;
  result.tier = tierFromLevel(level);

  // Resolve class
  const srdClass = srdData.classesById?.[charData.classId] || null;
  const mcClassSrd = charData.multiclassClassId ? srdData.classesById?.[charData.multiclassClassId] ?? null : null;
  if (srdClass) {
    result.class = srdClass.name;
    result.domains = srdClass.domains || [];
    result.hopeFeature = srdClass.hope_feature || null;
    result.classFeatures = resolveFeatures(srdClass.class_features, 'class', srdClass.name);
    if (mcClassSrd) {
      const extra = resolveFeatures(mcClassSrd.class_features, 'class', mcClassSrd.name).map((f) => ({
        ...f,
        _multiclass: true,
      }));
      result.classFeatures = [...(result.classFeatures || []), ...extra];
    }
  } else {
    result.class = charData.class || null;
    result.domains = charData.domains || [];
  }

  const srdSubclass = srdData.subclassesById?.[charData.subclassId] || null;
  const mcSubclass = charData.multiclassSubclassId ? srdData.subclassesById?.[charData.multiclassSubclassId] : null;
  if (srdSubclass) {
    result.subclass = srdSubclass.name;
    const unlockSteps = deriveSubclassUnlockSteps({
      advancements: charData.advancements,
      level,
      tier: result.tier,
      multiclassClassId: charData.multiclassClassId,
    });
    const subFeatures = [];
    if (srdSubclass.foundation_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.foundation_features, 'subclass', srdSubclass.name));
    }
    if (unlockSteps >= 1 && srdSubclass.specialization_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.specialization_features, 'subclass', srdSubclass.name));
    }
    if (unlockSteps >= 2 && srdSubclass.mastery_features) {
      subFeatures.push(...resolveFeatures(srdSubclass.mastery_features, 'subclass', srdSubclass.name));
    }
    if (mcSubclass?.foundation_features) {
      subFeatures.push(
        ...resolveFeatures(mcSubclass.foundation_features, 'subclass', mcSubclass.name).map((f) => ({
          ...f,
          _multiclassSubclass: true,
        })),
      );
    }
    result.subclassFeatures = subFeatures;
  } else {
    result.subclass = charData.subclass || null;
  }

  // Resolve ancestries — always from SRD; V2 descriptors merge at render / activeFeatures
  const ancestryIds = charData.ancestryIds || [];
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
  const srdCommunity = srdData.communitiesById?.[charData.communityId] || null;
  if (srdCommunity) {
    result.community = srdCommunity.name;
    const resolved = resolveFeatures(srdCommunity.features, 'community', srdCommunity.name);
    result.communityFeatures = resolved.map(f => ({
      ...f,
      id: `${charData.communityId}-feat-${(f.name || '').toLowerCase().replace(/\s+/g, '-')}`,
      type: 'community',
      sourceItem: srdCommunity,
    }));
  } else {
    result.community = charData.community || null;
  }

  // Derived stats
  result.traits = computeTraits(charData.baseTraits, charData.advancements, level);
  result.maxHp = computeMaxHp(srdClass, charData.advancements, level);
  result.maxStress = computeMaxStress(charData.advancements, level);
  result.evasion = computeEvasion(srdClass, charData.advancements, level);
  result.proficiency = computeProficiency(charData.advancements, level);
  result.maxHope = 6;

  const ownedDomainAbilityIds = collectOwnedDomainAbilityIds(charData);
  result._ownedDomainAbilityIds = ownedDomainAbilityIds;
  result.domainLoadoutIds = normalizeDomainLoadoutIds(ownedDomainAbilityIds, charData.domainLoadoutIds);
  result.domainSlotAcquiredLevel = normalizeDomainSlotAcquiredLevels(charData);

  // Resolve armor — always recompute from armorId so clearing to null removes stale stats
  result.armorScore = 0;
  result.armorName = null;
  result.armorThresholds = null;
  result.maxArmor = 0;
  const srdArmor = srdData.armorById?.[charData.armorId] || null;
  if (srdArmor) {
    const armorStats = resolveArmor(srdArmor);
    Object.assign(result, armorStats);
  }

  // Apply armor feature modifiers BEFORE weapon modifiers
  const gearSheetCtx = { computed: result, raw: charData };
  const armorMods = computeArmorModifiers(srdArmor, gearSheetCtx);
  result.armorMods = armorMods;
  for (const [k, v] of Object.entries(armorMods.traits)) {
    if (result.traits && k in result.traits) result.traits[k] += v;
  }
  if (armorMods.evasion !== 0) result.evasion = (result.evasion ?? 0) + armorMods.evasion;

  // Resolve weapons — always reassign so clearing a weapon ID removes it from the display; assign stable IDs (wep_0, wep_1)
  const weapons = [];
  const primaryWeapon = srdData.weaponsById?.[charData.primaryWeaponId];
  const secondaryWeapon = srdData.weaponsById?.[charData.secondaryWeaponId];
  if (primaryWeapon) weapons.push({ ...resolveWeapon(primaryWeapon), id: 'wep_0' });
  if (secondaryWeapon) weapons.push({ ...resolveWeapon(secondaryWeapon), id: 'wep_1' });
  // Set effectiveRange fallback before ancestry render
  for (const w of weapons) {
    w.effectiveRange = w.effectiveRange || w.range || '';
  }
  result.weapons = weapons;

  // Run onCharacterRender and passiveStatMods over ancestry + community + class + subclass (unified loop)
  const renderFeatures = buildActiveFeaturesForRender(result, srdClass, srdSubclass, mcClassSrd, mcSubclass);
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
  // Refresh effectiveRange for weapons mutated by ancestry features; scale damage dice to Proficiency
  for (const w of result.weapons) {
    w.effectiveRange = w.effectiveRange || w.range || '';
    if (w.damage) w.damage = scaleWeaponDamageByProficiency(w.damage, result.proficiency);
  }
  for (const w of result._virtualWeapons || []) {
    if (w.damage) w.damage = scaleWeaponDamageByProficiency(w.damage, result.proficiency);
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

  // Spellcast trait: if both primary and multiclass subclasses define one, use the higher effective score (tie → primary).
  if (srdSubclass || mcSubclass) {
    result.spellcastTrait = resolveSpellcastTraitFromTraitScores({
      primaryTraitName: srdSubclass?.spellcast_trait,
      multiclassTraitName: mcSubclass?.spellcast_trait,
      traits: result.traits,
      weaponMods: result.weaponMods,
      armorMods: result.armorMods,
      activeBeastform: charData.activeBeastform,
    });
  }

  // Resolve abilities (domain cards) — active loadout (≤5) for play
  const allAbilityIds = collectAbilityIds(charData);
  if (srdData.abilitiesById && allAbilityIds.length) {
    result.abilities = allAbilityIds.map(id => srdData.abilitiesById[id]).filter(Boolean);
  }

  const vaultAbilityIds = collectVaultAbilityIds(charData);
  if (srdData.abilitiesById && vaultAbilityIds.length) {
    result.domainVaultAbilities = vaultAbilityIds.map((id) => srdData.abilitiesById[id]).filter(Boolean);
  } else {
    result.domainVaultAbilities = [];
  }

  const expBonusFeat = result.ancestryFeatures?.find(
    (f) => typeof EXPERIENCE_BONUS_BY_FEATURE_NAME[f.name] === 'number',
  );
  const expBonus = expBonusFeat
    ? { amount: EXPERIENCE_BONUS_BY_FEATURE_NAME[expBonusFeat.name], featureName: expBonusFeat.name }
    : null;

  const advancementExpBonusById = {};
  for (let al = 2; al <= level; al++) {
    const adv = charData.advancements?.[String(al)];
    for (const pick of adv?.picks || []) {
      if (pick?.type !== 'experience' || !Array.isArray(pick.experienceIds)) continue;
      for (const eid of pick.experienceIds) {
        if (!eid) continue;
        advancementExpBonusById[eid] = (advancementExpBonusById[eid] || 0) + 1;
      }
    }
  }

  // Experience modifier from level-up picks is applied in the final map below. `CharacterForm` persists
  // `recomputeCharacter` output, so `exp.score` already includes those bonuses — never seed from it when
  // this id has advancement picks or we add the same +1 every recompute (any unrelated edit).
  let experiences = (charData.experiences || []).map((exp) => {
    const advDelta = advancementExpBonusById[exp.id] || 0;
    const stored = exp.score ?? 2;
    const scoreBase = advDelta > 0 ? 2 : stored;
    return { ...exp, score: scoreBase };
  });
  const expNeeded = expectedExperienceRowCount(level);
  while (experiences.length < expNeeded) {
    experiences.push({
      name: '',
      score: 2,
      id: newExperienceRowId(),
      tierEntryAuto: true,
    });
  }
  if (expBonus) {
    const choice = charData.experienceBonusChoices?.[expBonus.featureName];
    const baseScore = 2;
    experiences = experiences.map((exp) => ({
      ...exp,
      score: exp.id === choice ? baseScore + expBonus.amount : (exp.score ?? baseScore),
    }));
  }
  experiences = experiences.map((exp) => ({
    ...exp,
    score: (exp.score ?? 2) + (advancementExpBonusById[exp.id] || 0),
  }));
  result.experiences = experiences;

  applyActiveBeastformEvasionBonus(result, charData, srdData);
  assignBeastformDisplayFeatures(result, charData, srdData);

  result.activeFeatures = buildActiveFeatures(result, srdClass, srdSubclass, srdArmor, mcClassSrd, mcSubclass);

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
 * Compute weapon stat modifiers from the V2 weapon_properties registry only.
 * Returns { traits, evasion, armorScore, severeThreshold, sources }.
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
    const mods = resolveGearPassiveStatMods(v2d, featureName, sheetCtx);
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
  const lv = data.level ?? 1;
  const expNeeded = expectedExperienceRowCount(lv);
  const experienceCount = (data.experiences || []).filter(e => e.name?.trim()).length;
  if (experienceCount < expNeeded) {
    missing.push(`Experiences (${experienceCount}/${expNeeded} named for level ${lv})`);
  }
  if (lv >= 2) {
    for (const line of missingLevelAdvancementChoices(data, opts?.srdData)) {
      missing.push(line);
    }
    if (hasAdvancementChoicesLockField(data) && !isAdvancementLockedThroughCurrentLevel(data)) {
      missing.push('Lock level choices (Advancements section)');
    }
  }
  const ownedIds = collectOwnedDomainAbilityIds(data);
  // data.abilities may list full rows (e.g. Daggerstack); count owned domain IDs for completion.
  const abilityCount = Math.max(ownedIds.length, (data.abilities || []).length);

  if (abilityCount < 2) missing.push('Domain Cards (need 2)');
  if (ownedIds.length > 5) {
    const raw = (data.domainLoadoutIds || []).filter(Boolean);
    if (raw.length !== 5 || new Set(raw).size !== 5) {
      missing.push('Domain loadout (exactly five distinct active cards when you know more than five)');
    }
  }
  // Ancestry experience bonus (e.g. Clank Purposeful Design): require chosen experience
  const ancestryId = data.ancestryIds?.[0];
  const srdAnc = opts?.srdData?.ancestriesById?.[ancestryId];
  const ancestryFeatureNames = srdAnc?.features?.map(f => f.name) ?? [];
  const expBonusFeatName = ancestryFeatureNames.find((n) => typeof EXPERIENCE_BONUS_BY_FEATURE_NAME[n] === 'number');
  const expBonus = expBonusFeatName
    ? { amount: EXPERIENCE_BONUS_BY_FEATURE_NAME[expBonusFeatName], featureName: expBonusFeatName }
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

/** Character editor: show Level Up only when the sheet is complete and not at max level. */
export function shouldShowCharacterEditorLevelUp(data, srdData) {
  const lv = Number(data?.level) || 1;
  if (lv >= 10) return false;
  return isCharacterComplete(data, srdData ? { srdData } : undefined).complete;
}

export { TRAIT_KEYS, TRAIT_POOL, TIER_LEVELS, WEAPON_STAT_MAP };
export {
  deriveSubclassUnlockSteps,
  normalizeDomainLoadoutIds,
  missingLevelAdvancementChoices,
  getAdvancementIncompleteLevelKeys,
  isAdvancementPickFullyResolved,
  hasAdvancementChoicesLockField,
  isAdvancementLockedThroughCurrentLevel,
  isCurrentCharacterLevelAdvancementRowEditable,
} from './advancement-rules.js';
