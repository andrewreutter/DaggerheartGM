/**
 * V2 Game Table — action loop bridge (Phases 2–3)
 *
 * Builds `gameState` for the V2 engine, hydrates `rolls` + pending `action.effects` from banner
 * payloads (damage type, armor commitment, HP-loss-shaped effects), and collects **intent**,
 * **reviewAction**, and **reviewOutcome** chips for weapon/armor tags without running phase hooks.
 */

import { loadCharacterFeatures } from '../../features-v2/engine/feature-loader.js';
import { collectPhaseChipsOnly } from '../../features-v2/engine/action-loop.js';
import { buildTableSnapshot } from '../../features-v2/engine/table.js';
import {
  activateChip,
  collectChipsForOtherCharacterSheets,
  deductChipCosts,
  makeChipState,
} from '../../features-v2/engine/chip-system.js';
import { tokenDistanceFt } from './map-range.js';
import { buildV2RegistryWithSrdItems, isV2DeclarativeSheetEnabled } from './v2-declarative-sheet.js';
import { computeHpLoss, effectiveThresholds } from './helpers.js';

/**
 * Match GMTableView `enrichRollWithIsSuccess` so `reviewAction` predicates see `roll.isSuccess`
 * after the player picks a target (before GM acknowledges).
 *
 * @param {object} roll — mutated in place
 * @param {object[]} activeElements
 */
export function enrichV2RollIsSuccessFromTarget(roll, activeElements) {
  if (!roll?._selectedTargetInstanceId) return;
  const target = activeElements?.find((e) => e.instanceId === roll._selectedTargetInstanceId);
  if (!target) return;
  const isAdversary = target.elementType === 'adversary' || target.type === 'adversary';
  const defense = isAdversary ? target.difficulty : target.evasion;
  if (defense == null) return;
  let effectiveTotal = roll.total ?? 0;
  if (roll.dominant != null) {
    effectiveTotal += (roll._prayerAddRollDie?.value ?? 0) + (roll._heartOfAPoetD4Result ?? 0);
  }
  roll.isSuccess = effectiveTotal >= defense;
}

/**
 * Legacy hook for tests / opt-in filtering. Empty after Phase E: Phase 1 Ranger banner controls
 * (`DiceRoller` Hold Them Off / Ranger's Focus reroll) are gated off when the V2 sheet flag is on,
 * so `collectV2ReviewActionChips` no longer needs to hide those features by name.
 */
export const V2_REVIEW_ACTION_PHASE1_DEDUPE = new Set();

/**
 * @param {number} distFt
 * @returns {'melee'|'veryClose'|'close'|'far'|'veryFar'}
 */
export function engineRangeBandFromDistanceFt(distFt) {
  if (distFt == null || typeof distFt !== 'number' || distFt < 0) return 'melee';
  if (distFt <= 5) return 'melee';
  if (distFt <= 10) return 'veryClose';
  if (distFt <= 30) return 'close';
  if (distFt <= 100) return 'far';
  return 'veryFar';
}

/**
 * Map weapon max range (feet) to engine range band (same thresholds as {@link engineRangeBandFromDistanceFt}).
 * @param {number|string|null|undefined} maxFt
 */
export function engineRangeBandFromWeaponMaxFt(maxFt) {
  const n = maxFt != null ? Number(maxFt) : NaN;
  if (Number.isNaN(n)) return 'melee';
  return engineRangeBandFromDistanceFt(n);
}

/**
 * Map damage sub-item post tag (e.g. `phy`, `mag`) to engine `damageType` (`physical` / `magic`).
 * @param {string} raw first token from `sub.post`
 * @returns {'physical'|'magic'|null}
 */
export function postTagToEngineDamageType(raw) {
  const t = String(raw || '').toLowerCase();
  if (t === 'phy') return 'physical';
  if (t === 'mag') return 'magic';
  return null;
}

function thresholdsForDamageTarget(el) {
  if (!el) return null;
  if (el.elementType === 'character') return effectiveThresholds(el);
  return el.hp_thresholds ?? null;
}

/**
 * Pending effects for `table.action.effects` so `hasPhysicalDamage`, `hasDamage`, Dwarf, armor, etc.
 * match engine tests. Mirrors GMTableView `getDamageFromRoll` + `computeHpLoss` for the selected target.
 *
 * @param {object} roll
 * @param {object[]} activeElements
 * @returns {object[]}
 */
export function buildV2SyntheticActionEffects(roll, activeElements) {
  const targetId = roll?._selectedTargetInstanceId;
  if (!targetId || !Array.isArray(activeElements)) return [];

  const damageSubs = (roll.subItems || []).filter((s) => /damage/i.test(s.pre || '') && s.input);
  if (!damageSubs.length) return [];

  let total = 0;
  for (const sub of damageSubs) {
    const v = parseInt(sub.result, 10);
    if (!Number.isNaN(v)) total += v;
  }

  const first = damageSubs[0];
  const post = (first.post || '').trim().split(/\s+/);
  const rawTag = (post[0] && /^[a-z]+$/.test(post[0])) ? post[0] : '';
  const damageType = postTagToEngineDamageType(rawTag) ?? 'physical';

  const targetEl = activeElements.find((e) => e.instanceId === targetId);
  const thresholds = thresholdsForDamageTarget(targetEl);
  const hpLoss = computeHpLoss(total, thresholds);

  const targetStub = { instanceId: targetId };
  const useArmor = roll._useArmorByTargetId?.[targetId] === true;

  const effects = [
    {
      type: 'damage',
      target: targetStub,
      amount: total,
      damageType,
      ...(useArmor ? { useArmor: true } : {}),
    },
    { stat: 'currentHP', target: targetStub, amount: hpLoss },
  ];

  return effects;
}

/**
 * Merge table + per-character `featureState` bags for V2 action-loop snapshots.
 * (Same limitation as tests: feature keys are global by name; multiple PCs with the same
 * feature name share one bucket — engine design.)
 *
 * @param {object} [tableFeatureState]
 * @param {object[]} activeElements
 * @returns {object}
 */
export function mergeV2TableFeatureState(tableFeatureState, activeElements) {
  const merged = { ...(tableFeatureState || {}) };
  for (const el of activeElements || []) {
    if (el.elementType !== 'character' || !el.featureState || typeof el.featureState !== 'object') continue;
    for (const [k, bag] of Object.entries(el.featureState)) {
      if (!bag || typeof bag !== 'object') continue;
      merged[k] = { ...(merged[k] || {}), ...bag };
    }
  }
  return merged;
}

/**
 * Parse Hope/Fear/d20/damage from `roll.subItems` into `gameState.rolls` (engine shape).
 *
 * @param {object} roll — client/server roll payload; may be mutated with `isSuccess` by GMTableView
 * @returns {{ action: object, damage: object, other: object }}
 */
export function hydrateV2RollsFromClientRoll(roll) {
  const subItems = Array.isArray(roll?.subItems) ? roll.subItems : [];
  let hopeDie = null;
  let fearDie = null;
  let gmDie = null;
  const actionDice = [];
  const actionStatics = [];

  for (const sub of subItems) {
    if (/damage/i.test(sub.pre || '')) continue;
    const pre = (sub.pre || '').toLowerCase();
    const v = parseInt(sub.result, 10);
    if (Number.isNaN(v)) continue;
    if (/hope/i.test(pre)) hopeDie = { value: v };
    else if (/fear/i.test(pre)) fearDie = { value: v };
    else if (/\bd20\b/i.test(sub.input || '') || /attack/i.test(pre) || /\[\s*d20/i.test(sub.input || '')) {
      gmDie = { value: v };
    }
  }

  const hasDuality = hopeDie != null && fearDie != null;

  const damageDice = [];
  const damageStatics = [];
  for (const sub of subItems) {
    if (!/damage/i.test(sub.pre || '') || !sub.input) continue;
    const v = parseInt(sub.result, 10);
    const m = /^(d\d+)/i.exec(String(sub.input).trim());
    const die = m ? m[1].toLowerCase() : 'd6';
    const postRaw = String(sub.post || '')
      .trim()
      .split(/\s+/)[0];
    const damageType = postTagToEngineDamageType(postRaw);
    damageDice.push({
      name: 'damage',
      die,
      value: Number.isNaN(v) ? 0 : v,
      ...(damageType ? { damageType } : {}),
    });
  }

  let isSuccess = roll.isSuccess;
  if (typeof isSuccess !== 'boolean' && hasDuality && roll.dominant === 'critical') {
    isSuccess = true;
  }
  const isCritical = roll.dominant === 'critical';

  return {
    action: {
      hopeDie: hasDuality ? hopeDie : null,
      fearDie: hasDuality ? fearDie : null,
      gmDie: !hasDuality && gmDie ? gmDie : null,
      dice: actionDice,
      statics: actionStatics,
      isSuccess: typeof isSuccess === 'boolean' ? isSuccess : null,
      isCritical: isCritical || null,
    },
    damage: {
      dice: damageDice,
      statics: damageStatics,
      /** First damage line’s type (`physical` / `magic`) when the roll sub-item post tag is `phy` / `mag`. */
      damageType: damageDice[0]?.damageType ?? null,
    },
    other: {},
  };
}

/**
 * @param {object} roll
 * @param {object[]} activeElements
 * @returns {object|null} actionConfig for createActionLoop
 */
export function buildActionConfigFromRoll(roll, activeElements) {
  const actorInstanceId = roll._attackerInstanceId;
  if (!actorInstanceId) return null;
  const targetId = roll._selectedTargetInstanceId;
  const targetInstanceIds = targetId ? [targetId] : [];
  const attacker = activeElements.find((e) => e.instanceId === actorInstanceId);
  const target = targetId ? activeElements.find((e) => e.instanceId === targetId) : null;

  let range = engineRangeBandFromWeaponMaxFt(roll._weaponRangeFt);
  if (attacker && target && attacker.tokenX != null && target.tokenY != null && target.tokenX != null && target.tokenY != null) {
    const d = tokenDistanceFt(attacker.tokenX, attacker.tokenY, target.tokenX, target.tokenY);
    range = engineRangeBandFromDistanceFt(d);
  }

  let traitKey = roll._traitKey || 'agility';
  if (typeof traitKey === 'string') {
    const t = traitKey.trim();
    traitKey = t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Agility';
  }

  return {
    type: 'attack',
    actorInstanceId,
    targetInstanceIds,
    traitKey,
    range,
    weaponId: roll._weaponId ?? null,
    rollText: roll.rollText || '',
  };
}

/**
 * @param {object} el — character element
 * @param {object} srdData
 * @param {object} registry — {@link buildV2RegistryWithSrdItems}
 */
export function loadV2FeaturesForCharacterElement(el, registry) {
  if (!el || el.elementType !== 'character' || !registry) return [];
  return loadCharacterFeatures(el, registry);
}

/**
 * @param {object[]} activeElements
 * @param {object} registry
 * @returns {object[]}
 */
export function loadAllV2FeaturesForTable(activeElements, registry) {
  const out = [];
  for (const el of activeElements || []) {
    if (el.elementType !== 'character') continue;
    out.push(...loadV2FeaturesForCharacterElement(el, registry));
  }
  return out;
}

/**
 * Builds the engine `gameState` used for V2 banner chip collection / activation (weapon + armor phases).
 *
 * @param {{
 *   roll: object,
 *   activeElements: object[],
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 * }} opts
 */
export function buildV2BannerGameState(opts) {
  const { roll, activeElements, fearCount = 0, mapConfig = null, tableFeatureState } = opts || {};
  const rolls = hydrateV2RollsFromClientRoll(roll);
  const featureState = mergeV2TableFeatureState(tableFeatureState, activeElements);
  const actionConfig = buildActionConfigFromRoll(roll, activeElements);
  const effects = buildV2SyntheticActionEffects(roll, activeElements);

  return {
    fear: fearCount,
    mapConfig,
    activeElements,
    featureState,
    rolls,
    action: {
      type: 'attack',
      actorInstanceId: actionConfig?.actorInstanceId,
      targetInstanceIds: actionConfig?.targetInstanceIds ?? [],
      trait: actionConfig?.traitKey,
      range: actionConfig?.range,
      effects,
      appliedEffects: [],
      useArmorByTargetId: roll._useArmorByTargetId,
    },
  };
}

/**
 * @param {{
 *   roll: object,
 *   activeElements: object[],
 *   srdData: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 *   dedupeFeatureNames?: Set<string>,
 * }} opts
 * @returns {object[]} chips from **intent**, **reviewAction**, and **reviewOutcome** (tagged with `_v2Phase`)
 */
export function collectV2ReviewActionChips(opts) {
  const {
    roll,
    activeElements,
    srdData,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
    dedupeFeatureNames = V2_REVIEW_ACTION_PHASE1_DEDUPE,
    force = false,
  } = opts || {};
  if (!force && !isV2DeclarativeSheetEnabled()) return [];

  if (!roll || !Array.isArray(activeElements) || !srdData) return [];

  const actor = roll._attackerInstanceId;
  if (!actor) return [];
  const hasDamage = (roll.subItems || []).some((s) => /damage/i.test(s.pre || '') && s.input);
  if (!hasDamage) return [];

  enrichV2RollIsSuccessFromTarget(roll, activeElements);

  const actionConfig = buildActionConfigFromRoll(roll, activeElements);
  if (!actionConfig) return [];

  const registry = buildV2RegistryWithSrdItems(srdData);
  const features = loadAllV2FeaturesForTable(activeElements, registry);
  if (!features.length) return [];

  const gameState = buildV2BannerGameState({
    roll,
    activeElements,
    fearCount,
    mapConfig,
    tableFeatureState,
  });

  const phases = ['intent', 'reviewAction', 'reviewOutcome'];
  const list = [];
  for (const phase of phases) {
    list.push(...collectPhaseChipsOnly(gameState, actionConfig, features, phase, {}));
  }

  const party = (activeElements || []).filter((e) => e.elementType === 'character');
  const targetIds = new Set();
  const sel = roll._selectedTargetInstanceId;
  if (sel && party.some((p) => p.instanceId === sel)) targetIds.add(sel);
  for (const tid of actionConfig.targetInstanceIds || []) {
    if (party.some((p) => p.instanceId === tid)) targetIds.add(tid);
  }
  const usageStore = {};
  for (const tid of targetIds) {
    const cross = collectChipsForOtherCharacterSheets(tid, party, registry, 'reviewAction', gameState, usageStore);
    for (const c of cross) {
      list.push({ ...c, _v2Phase: 'reviewAction' });
    }
  }

  if (!dedupeFeatureNames || dedupeFeatureNames.size === 0) return list;
  return list.filter((c) => !dedupeFeatureNames.has(c._featureName));
}

/**
 * Run `deductChipCosts` + `activateChip` for a `reviewAction` chip using the same game-state
 * shape as {@link collectV2ReviewActionChips}.
 *
 * @param {object} chip — descriptor from `collectChips` / action loop
 * @param {object} roll
 * @param {object[]} activeElements
 * @param {object} srdData
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object, selectOpts?: object }} [opts]
 * @returns {{ mutations: object[], chipState: object, feature: object|null, error?: string }}
 */
export function activateV2ReviewChip(chip, roll, activeElements, srdData, opts = {}) {
  if (!chip || !roll || !Array.isArray(activeElements) || !srdData) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'bad-args' };
  }

  const registry = buildV2RegistryWithSrdItems(srdData);
  const features = loadAllV2FeaturesForTable(activeElements, registry);
  const feature = features.find(
    (f) => f.name === chip._featureName && f._ownerInstanceId === chip._ownerInstanceId
  );
  if (!feature) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'feature-not-found' };
  }

  enrichV2RollIsSuccessFromTarget(roll, activeElements);
  const actionConfig = buildActionConfigFromRoll(roll, activeElements);
  if (!actionConfig) {
    return { mutations: [], chipState: makeChipState(), feature, error: 'no-action-config' };
  }

  const snapshotOwnerId = chip._crossSheetViewerInstanceId ?? chip._ownerInstanceId;
  const gameState = {
    ...buildV2BannerGameState({
      roll,
      activeElements,
      fearCount: opts.fearCount,
      mapConfig: opts.mapConfig,
      tableFeatureState: opts.tableFeatureState,
    }),
    _ownerInstanceId: snapshotOwnerId,
    _featureKey: feature.name,
    _activeFeature: feature,
  };

  const table = buildTableSnapshot(gameState);
  deductChipCosts(chip, table);
  const chipState = makeChipState();
  const selectOpts = opts.selectOpts || {};
  const mutations = activateChip(chip, table, chipState, selectOpts);
  return { mutations, chipState, feature };
}

/**
 * Build the same `table` snapshot used by {@link activateV2ReviewChip} so UI can evaluate
 * `chip.isSelect(table)` / `chip.selectTargets(table)` before activation.
 *
 * @returns {object|null} `buildTableSnapshot(gameState)` or null when the chip cannot be resolved
 */
export function buildV2ReviewChipTableSnapshot(chip, roll, activeElements, srdData, opts = {}) {
  if (!chip || !roll || !Array.isArray(activeElements) || !srdData) return null;

  const registry = buildV2RegistryWithSrdItems(srdData);
  const features = loadAllV2FeaturesForTable(activeElements, registry);
  const feature = features.find(
    (f) => f.name === chip._featureName && f._ownerInstanceId === chip._ownerInstanceId
  );
  if (!feature) return null;

  enrichV2RollIsSuccessFromTarget(roll, activeElements);
  const actionConfig = buildActionConfigFromRoll(roll, activeElements);
  if (!actionConfig) return null;

  const snapshotOwnerId = chip._crossSheetViewerInstanceId ?? chip._ownerInstanceId;
  const gameState = {
    ...buildV2BannerGameState({
      roll,
      activeElements,
      fearCount: opts.fearCount,
      mapConfig: opts.mapConfig,
      tableFeatureState: opts.tableFeatureState,
    }),
    _ownerInstanceId: snapshotOwnerId,
    _featureKey: feature.name,
    _activeFeature: feature,
  };

  return buildTableSnapshot(gameState);
}

/**
 * Resolve picker data for V2 review chips (`isSelect`, `selectTargets`, `maxSelections`).
 *
 * @returns {{ isSelectOptions: object[]|null, selectTargets: object[]|null, maxSelections: number }|null}
 */
export function resolveV2ReviewChipPicker(chip, roll, activeElements, srdData, opts = {}) {
  const table = buildV2ReviewChipTableSnapshot(chip, roll, activeElements, srdData, opts);
  if (!table) return null;

  let isSelectOptions = null;
  if (typeof chip.isSelect === 'function') {
    try {
      isSelectOptions = chip.isSelect(table) || [];
    } catch {
      isSelectOptions = [];
    }
  }

  let selectTargets = null;
  if (typeof chip.selectTargets === 'function') {
    try {
      selectTargets = chip.selectTargets(table) || [];
    } catch {
      selectTargets = [];
    }
  }

  let maxSelections = chip.maxSelections;
  if (typeof maxSelections === 'function') {
    try {
      maxSelections = maxSelections(table);
    } catch {
      maxSelections = 1;
    }
  }
  if (maxSelections == null) {
    maxSelections = chip.multiSelect ? 99 : 1;
  }

  return { isSelectOptions, selectTargets, maxSelections };
}
