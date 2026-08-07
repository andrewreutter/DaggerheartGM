/**
 * V2 Game Table — action loop bridge (Phases 2–3)
 *
 * Builds `gameState` for the V2 engine, hydrates `rolls` + pending `action.effects` from banner
 * payloads (damage type, armor commitment, HP-loss-shaped effects), and collects **intent**,
 * **reviewAction**, and **reviewOutcome** chips for weapon/armor tags without running phase hooks.
 *
 * **Damage commit (Phase C):** {@link runV2DamageApplyReviewOutcomePhase} runs a single hydrated
 * `reviewOutcome` pass for features with `runOnVttDamageApplyReviewOutcome: true` when the GM
 * applies attack damage to a character (before HP is written).
 */

import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../features-v2/engine/feature-loader.js';
import { collectPhaseChipsOnly, createActionLoop } from '../../features-v2/engine/action-loop.js';
import { buildTableSnapshot } from '../../features-v2/engine/table.js';
import {
  activateChip,
  collectChips,
  collectChipsForOtherCharacterSheets,
  deductChipCosts,
  makeChipState,
  canPayChipCosts,
  getChipDisableHint,
} from '../../features-v2/engine/chip-system.js';
import {
  RANGE_BANDS_FT,
  distanceFtToRangeBandName,
  tokenDistanceFtForElements,
} from './map-range.js';
import { buildV2RegistryWithSrdItems, expandSrdAncestryIdsToV2Keys } from './v2-declarative-sheet.js';
import { computeHpLoss, effectiveEvasion, effectiveThresholds } from './helpers.js';
import { applyV2LifecycleMutations } from './table-ops.js';
import { PENDING_EVASION_BONUS_STATE_KEY } from '../../game-constants.js';
import { WARDEN_OF_THE_ELEMENTS_SCOPE_KEY } from '../../features-v2/engine/feature-scope-keys.js';

/** Display names for synthetic trait sub-items (matches CharacterDisplay TRAIT_FULL). */
const TRAIT_FULL_PRETTY = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

/**
 * Map SRD `ancestryIds` on table character elements to V2 registry keys (`Infernis.Fearless`, …)
 * so {@link loadAllV2FeaturesForTable} matches {@link mergeV2DeclarativeSheetOverlay}.
 *
 * @param {object[]|null|undefined} activeElements
 * @param {object} srdData
 * @returns {object[]}
 */
export function expandTableCharactersAncestryForV2Loader(activeElements, srdData) {
  if (!Array.isArray(activeElements) || !srdData?.ancestriesById) return activeElements || [];
  return activeElements.map((el) => {
    if (el.elementType !== 'character') return el;
    const raw = Array.isArray(el.ancestryIds)
      ? el.ancestryIds
      : el.ancestryId
        ? [el.ancestryId]
        : [];
    if (!raw.length) return el;
    const v2Keys = expandSrdAncestryIdsToV2Keys(raw, srdData);
    if (!v2Keys.length) return el;
    return { ...el, ancestryIds: v2Keys };
  });
}

/**
 * Match GMTableView `enrichRollWithIsSuccess` so `reviewAction` predicates see `roll.isSuccess`
 * after the player picks a target (before GM acknowledges).
 *
 * @param {object} roll — mutated in place
 * @param {object[]} activeElements
 * @param {object} [srdData] — pass so PC defense uses resolved beastform evasion (same as banners).
 */
export { PENDING_EVASION_BONUS_STATE_KEY };

/**
 * Sum {@link PENDING_EVASION_BONUS_STATE_KEY} across all `featureState` scope bags (declarative one-shot evasion vs pending attack).
 * @param {object|null|undefined} el
 * @returns {number}
 */
export function sumPendingEvasionBonusFromFeatureState(el) {
  if (!el?.featureState) return 0;
  let sum = 0;
  for (const bag of Object.values(el.featureState)) {
    if (bag && typeof bag[PENDING_EVASION_BONUS_STATE_KEY] === 'number' && bag[PENDING_EVASION_BONUS_STATE_KEY] > 0) {
      sum += bag[PENDING_EVASION_BONUS_STATE_KEY];
    }
  }
  return sum;
}

/**
 * When the GM acknowledges an attack banner, clear pending evasion bonuses on the selected target (engine may also clear on outcome).
 * @param {object} el — character element
 * @param {string|null|undefined} selectedTargetInstanceId
 * @returns {object|null} partial updates for `updateActiveElement` / `update-elements`
 */
export function buildPendingEvasionBonusAckCleanupUpdates(el, selectedTargetInstanceId) {
  if (!el || el.elementType !== 'character') return null;
  if (el.instanceId !== selectedTargetInstanceId) return null;
  const fs = el.featureState || {};
  let changed = false;
  const next = { ...fs };
  for (const [scopeKey, bag] of Object.entries(fs)) {
    if (bag && typeof bag[PENDING_EVASION_BONUS_STATE_KEY] === 'number' && bag[PENDING_EVASION_BONUS_STATE_KEY] > 0) {
      next[scopeKey] = { ...bag, [PENDING_EVASION_BONUS_STATE_KEY]: 0 };
      changed = true;
    }
  }
  return changed ? { featureState: next } : null;
}

export function enrichV2RollIsSuccessFromTarget(roll, activeElements, srdData) {
  if (!roll?._selectedTargetInstanceId) return;
  const target = activeElements?.find((e) => e.instanceId === roll._selectedTargetInstanceId);
  if (!target) return;
  const isAdversary = target.elementType === 'adversary' || target.type === 'adversary';
  let defense = isAdversary
    ? target.difficulty
    : (effectiveEvasion(target, srdData) ?? target.evasion ?? null);
  if (!isAdversary) {
    const pending = sumPendingEvasionBonusFromFeatureState(target);
    if (pending > 0) defense = (defense ?? 0) + pending;
  }
  if (defense == null) return;
  let effectiveTotal = roll.total ?? 0;
  if (roll.dominant != null) {
    effectiveTotal += (roll._prayerAddRollDie?.value ?? 0);
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
 * Collapse duplicate chips from pass-1 + cross-sheet merge (same feature chip key).
 * @param {object[]} chips
 * @returns {object[]}
 */
function dedupeV2ChipsByChipKey(chips) {
  const seen = new Set();
  const out = [];
  for (const c of chips) {
    const k =
      c._chipKey != null && c._chipKey !== ''
        ? c._chipKey
        : `${c._featureName ?? ''}::${typeof c.name === 'string' ? c.name : ''}::${c._v2Phase ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

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
  // Actor source so review predicates like “magic damage you deal” (`e.source?.instanceId`)
  // match Volatile Magic–style chips that only check the target (isActing already gates actor).
  const attackerId = roll._attackerInstanceId;
  const sourceStub = attackerId ? { instanceId: attackerId } : undefined;

  const effects = [
    {
      type: 'damage',
      target: targetStub,
      amount: total,
      damageType,
      ...(sourceStub ? { source: sourceStub } : {}),
      ...(useArmor ? { useArmor: true } : {}),
    },
    { stat: 'currentHP', target: targetStub, amount: hpLoss },
  ];

  return effects;
}

/**
 * Pending `table.action.effects` at damage commit: final post-pipeline damage total and HP loss
 * for the struck character (engine shape). Used by {@link runV2DamageApplyReviewOutcomePhase}.
 *
 * @param {{
 *   roll: object,
 *   targetInstanceId: string,
 *   damageAmount: number,
 *   hpLossAmount: number,
 * }} opts
 * @returns {object[]}
 */
export function buildV2DamageCommitEffects(opts) {
  const { roll, targetInstanceId, damageAmount, hpLossAmount } = opts || {};
  if (!targetInstanceId) return [];
  const targetStub = { instanceId: targetInstanceId };
  const damageSubs = Array.isArray(roll?.subItems)
    ? roll.subItems.filter((s) => /damage/i.test(s.pre || '') && s.input)
    : [];
  const firstSub = damageSubs[0];
  const postRaw = String(firstSub?.post || '').trim().split(/\s+/)[0];
  const damageType = postTagToEngineDamageType(postRaw) ?? 'physical';
  const useArmor = roll?._useArmorByTargetId?.[targetInstanceId] === true;
  return [
    {
      type: 'damage',
      target: targetStub,
      amount: Math.max(0, Number(damageAmount) || 0),
      damageType,
      ...(useArmor ? { useArmor: true } : {}),
    },
    {
      stat: 'currentHP',
      target: targetStub,
      amount: Math.max(0, Number(hpLossAmount) || 0),
    },
  ];
}

/**
 * Read pending `{ stat: 'currentHP' }` amount for a target after `onReviewOutcome` hooks mutate
 * `action.effects` in place (e.g. Elemental Dominion Earth).
 *
 * @param {object[]|undefined} effects
 * @param {string} targetInstanceId
 * @returns {number|undefined}
 */
export function readV2DamageCommitHpLossFromEffects(effects, targetInstanceId) {
  if (!targetInstanceId || !Array.isArray(effects)) return undefined;
  const line = effects.find(
    (e) =>
      e &&
      e.stat === 'currentHP' &&
      e.target?.instanceId === targetInstanceId &&
      typeof e.amount === 'number'
  );
  if (!line) return undefined;
  return Math.max(0, Math.floor(line.amount));
}

/**
 * At GM damage application, run `reviewOutcome` for opt-in features against one hydrated
 * `gameState` (see `buildV2BannerGameState` + {@link buildV2DamageCommitEffects}).
 *
 * Features must set **`runOnVttDamageApplyReviewOutcome: true`** on the registry row so unrelated
 * `onReviewOutcome` hooks (e.g. armor flows already handled elsewhere) do not run twice.
 *
 * **`setFeatureState` owner:** for a struck **character**, `setFeatureStateOwnerId` =
 * **`targetElement.instanceId`**; for a struck **adversary**, **`undefined`** (victim has no
 * character `featureState` — hooks rely on mutations with explicit `instanceId`s).
 *
 * @param {{
 *   roll: object,
 *   targetElement: object,
 *   activeElements: object[],
 *   srdData: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 *   damageAmount: number,
 *   hpLossAmount: number,
 *   rng?: () => number,
 * }} ctx — `targetElement` may be the struck **character** or **adversary** (e.g. Warden fire aura runs when the victim is an adversary). **`rng`:** optional `gameState._rng` override (tests).
 * @returns {{
 *   elementUpdates: { instanceId: string, updates: object }[],
 *   actionLoopNotifications: object[],
 *   skipped: object[],
 *   adjustedHpLoss?: number,
 * }}
 */
export function runV2DamageApplyReviewOutcomePhase(ctx) {
  const empty = { elementUpdates: [], actionLoopNotifications: [], skipped: [] };
  const {
    roll,
    targetElement,
    activeElements,
    srdData,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
    damageAmount,
    hpLossAmount,
    rng,
  } = ctx || {};
  const elType =
    targetElement?.elementType ??
    (targetElement?.type === 'character'
      ? 'character'
      : targetElement?.type === 'adversary'
        ? 'adversary'
        : null);
  const isChar = elType === 'character';
  const isAdv = elType === 'adversary';
  if (!roll || !targetElement || (!isChar && !isAdv) || !Array.isArray(activeElements) || !srdData) {
    return empty;
  }
  if (!roll._attackerInstanceId) return empty;
  const hasDamageRoll = (roll.subItems || []).some((s) => /damage/i.test(s.pre || '') && s.input);
  if (!hasDamageRoll) return empty;
  if (!(Number(hpLossAmount) > 0)) return empty;

  enrichV2RollIsSuccessFromTarget(roll, activeElements, srdData);
  const registry = buildV2RegistryWithSrdItems(srdData);
  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
  const features = loadAllV2FeaturesForTable(activeForLoader, registry, {
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  const outcomeFeatures = features.filter((f) => f.runOnVttDamageApplyReviewOutcome === true);
  if (!outcomeFeatures.length) return empty;

  const actionConfig = buildActionConfigFromRoll(roll, activeForLoader);
  if (!actionConfig) return empty;

  const gameState = buildV2BannerGameState({
    roll,
    activeElements: activeForLoader,
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  if (typeof rng === 'function') {
    gameState._rng = rng;
  }
  const targetId = targetElement.instanceId;
  gameState.action.effects = buildV2DamageCommitEffects({
    roll,
    targetInstanceId: targetId,
    damageAmount,
    hpLossAmount,
  });

  const loop = createActionLoop(gameState, actionConfig, outcomeFeatures, {});
  const { mutations } = loop.runPhase('reviewOutcome');
  const adjustedHpLoss = readV2DamageCommitHpLossFromEffects(loop.gameState?.action?.effects, targetId);
  // `setFeatureState` rows need an owner id in `applyV2BannerMutations` (same as V2 chip apply).
  // Struck **character**: victim id. Struck **adversary** (e.g. PC dealt damage): omit owner so
  // `setFeatureState` is skipped — attacker-side hooks use `markStress` payloads with explicit ids.
  const { updates, actionLoopNotifications, skipped } = applyV2LifecycleMutations(
    activeForLoader,
    mutations || [],
    isChar ? targetId : undefined
  );
  return {
    elementUpdates: updates || [],
    actionLoopNotifications: actionLoopNotifications || [],
    skipped: skipped || [],
    adjustedHpLoss,
  };
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
    const d = tokenDistanceFtForElements(attacker, target);
    range = engineRangeBandFromDistanceFt(d);
  }

  let traitKey = roll._traitKey || 'agility';
  if (typeof traitKey === 'string') {
    const t = traitKey.trim();
    traitKey = t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Agility';
  }

  const hasWeaponMeta = roll._weaponRangeFt != null || roll._weaponId != null;
  const hasDamageSubItem =
    Array.isArray(roll.subItems) && roll.subItems.some((s) => /damage/i.test(s.pre || ''));
  /** Weapon meta from VTT, or hydrated banner roll that already includes a damage line. */
  const isAttackRoll = hasWeaponMeta || hasDamageSubItem;
  /** Set on VTT spellcast rolls only — avoids misclassifying a normal trait roll on the spellcast trait. */
  const isSpellcastRoll = !isAttackRoll && roll._isSpellcastRoll === true;

  return {
    type: isAttackRoll ? 'attack' : isSpellcastRoll ? 'spellcast' : 'trait',
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
/**
 * @param {object} el — character element
 * @param {object} registry
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object }} [opts] — passed to `applyDeclarativeFeatures` for `virtualSources` / legacy virtual / `virtualWeapon` expansion
 */
export function loadV2FeaturesForCharacterElement(el, registry, opts = {}) {
  if (!el || el.elementType !== 'character' || !registry) return [];
  const base = loadCharacterFeatures(el, registry);
  const tableBase = {
    top: { fear: opts.fearCount ?? 0, map: opts.mapConfig ?? null },
    featureState: opts.tableFeatureState,
  };
  const decl = applyDeclarativeFeatures(base, el, tableBase, registry);
  return decl.mergedFeatures;
}

/**
 * `table` snapshot for **`placement: 'rest'`** chips (short vs long rest action).
 *
 * @param {{
 *   characterInstanceId: string,
 *   activeElements: object[],
 *   restDuration: 'short' | 'long',
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 * }} opts
 */
export function buildRestBannerTableForCharacter(opts) {
  const {
    characterInstanceId,
    activeElements,
    restDuration,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
  } = opts || {};
  if (!characterInstanceId || !Array.isArray(activeElements)) return null;
  const merged = mergeV2TableFeatureState(tableFeatureState, activeElements);
  const actionType = restDuration === 'long' ? 'longRest' : 'shortRest';
  const gameState = {
    fear: fearCount ?? 0,
    mapConfig: mapConfig ?? null,
    activeElements,
    featureState: merged,
    rolls: {
      action: {
        dice: [],
        statics: [],
        hopeDie: null,
        fearDie: null,
        gmDie: null,
        isSuccess: null,
        isCritical: null,
      },
      damage: { dice: [], statics: [] },
      other: {},
    },
    action: {
      type: actionType,
      actorInstanceId: characterInstanceId,
      targetInstanceIds: [],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    },
  };
  return buildTableSnapshot(gameState);
}

/**
 * Collect declarative chips with **`placements: ['rest']`** for one merged character row.
 *
 * @param {{
 *   mergedCharacterEl: object,
 *   activeElements: object[],
 *   registry: object,
 *   restDuration: 'short' | 'long',
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 * }} opts
 * @returns {object[]}
 */
export function collectV2RestPlacementChipsForCharacter(opts) {
  const {
    mergedCharacterEl,
    activeElements,
    registry,
    restDuration,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
  } = opts || {};
  if (!mergedCharacterEl?.instanceId || !registry || !Array.isArray(activeElements)) return [];
  const features = loadV2FeaturesForCharacterElement(mergedCharacterEl, registry, {
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  if (!features.length) return [];
  const table = buildRestBannerTableForCharacter({
    characterInstanceId: mergedCharacterEl.instanceId,
    activeElements,
    restDuration,
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  if (!table) return [];
  return collectChips(features, 'rest', table, {});
}

/**
 * Activate one rest-banner chip (same chip object reference as returned from {@link collectV2RestPlacementChipsForCharacter}).
 *
 * @returns {{ mutations: object[], engineChip?: object|null, error?: string }}
 */
export function activateV2RestPlacementChip(opts) {
  const {
    mergedCharacterEl,
    rawChip,
    activeElements,
    registry,
    restDuration,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
  } = opts || {};
  if (!mergedCharacterEl?.instanceId || !rawChip || !registry || !Array.isArray(activeElements)) {
    return { mutations: [], error: 'no-matching-chip' };
  }
  const features = loadV2FeaturesForCharacterElement(mergedCharacterEl, registry, {
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  const table = buildRestBannerTableForCharacter({
    characterInstanceId: mergedCharacterEl.instanceId,
    activeElements,
    restDuration,
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  if (!table) return { mutations: [], error: 'no-matching-chip' };
  const collected = collectChips(features, 'rest', table, {});
  const engineChip =
    (rawChip._chipKey != null && collected.find((c) => c._chipKey === rawChip._chipKey)) ||
    collected.find((c) => c.name === rawChip.name);
  if (!engineChip) {
    return { mutations: [], error: 'no-matching-chip' };
  }
  if (engineChip.disabled) {
    return { mutations: [], engineChip, error: 'disabled' };
  }
  if (!canPayChipCosts(engineChip, table)) {
    return { mutations: [], engineChip, error: 'unaffordable' };
  }
  deductChipCosts(engineChip, table);
  const chipState = makeChipState();
  const mutations = activateChip(engineChip, table, chipState, {});
  return { mutations, engineChip };
}

/**
 * @param {object[]} activeElements
 * @param {object} registry
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object }} [opts]
 * @returns {object[]}
 */
export function loadAllV2FeaturesForTable(activeElements, registry, opts = {}) {
  const out = [];
  for (const el of activeElements || []) {
    if (el.elementType !== 'character') continue;
    out.push(...loadV2FeaturesForCharacterElement(el, registry, opts));
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
    /** Binds `actor.move()` mutations to the pending banner (client + table). */
    _rollDbId: roll?._rollDbId ?? null,
    action: {
      type: actionConfig?.type ?? 'attack',
      actorInstanceId: actionConfig?.actorInstanceId,
      targetInstanceIds: actionConfig?.targetInstanceIds ?? [],
      trait: actionConfig?.traitKey,
      range: actionConfig?.range,
      weaponId: actionConfig?.weaponId ?? null,
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
 *   viewer?: { role: 'gm' | 'player', viewerCharacterInstanceId?: string | null },
 *   preloaded?: { activeForLoader: object[], registry: object, features: object[] },
 * }} opts
 * When `viewer` is omitted, pass-1 chips are unfiltered (legacy tests) and cross-sheet runs for PC targets plus PC actor.
 * When `viewer.role === 'gm'`, cross-sheet is skipped (pass-1 lists all unwrapped chips for the GM).
 * When `viewer.role === 'player'`, pass-1 is owner-scoped; cross-sheet runs for `viewerCharacterInstanceId`
 * **and** for the pending roll’s PC `actorInstanceId` when that differs (e.g. preview-as-player vs ally actor)
 * so `showOnOtherSheets` **`reviewAction`** chips (Rally, Rune Ward, …) see the correct `table.me` context.
 * `preloaded` lets a caller looping over many pending banners for the same
 * `(activeElements, srdData, fearCount, mapConfig, tableFeatureState)` build `activeForLoader` /
 * `registry` / `features` once instead of once per banner (they don't depend on `roll`).
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
    viewer,
    preloaded,
  } = opts || {};

  if (!roll || !Array.isArray(activeElements) || !srdData) {
    return [];
  }

  const actor = roll._attackerInstanceId;
  if (!actor) {
    return [];
  }
  const hasDamage = (roll.subItems || []).some((s) => /damage/i.test(s.pre || '') && s.input);
  const hydratedForGate = hydrateV2RollsFromClientRoll(roll);
  const hasHopeFearPool =
    hydratedForGate.action?.hopeDie != null || hydratedForGate.action?.fearDie != null;
  if (!hasDamage && !hasHopeFearPool) {
    return [];
  }

  enrichV2RollIsSuccessFromTarget(roll, activeElements, srdData);

  const actionConfig = buildActionConfigFromRoll(roll, activeElements);
  if (!actionConfig) {
    return [];
  }

  const activeForLoader = preloaded?.activeForLoader ?? expandTableCharactersAncestryForV2Loader(activeElements, srdData);

  const registry = preloaded?.registry ?? buildV2RegistryWithSrdItems(srdData);
  const featureOpts = { fearCount, mapConfig, tableFeatureState };
  const features = preloaded?.features ?? loadAllV2FeaturesForTable(activeForLoader, registry, featureOpts);
  if (!features.length) {
    return [];
  }

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
    list.push(...collectPhaseChipsOnly(gameState, actionConfig, features, phase, {}, viewer));
  }

  const party = (activeForLoader || []).filter((e) => e.elementType === 'character');
  const targetIds = new Set();
  const sel = roll._selectedTargetInstanceId;
  if (sel && party.some((p) => p.instanceId === sel)) targetIds.add(sel);
  for (const tid of actionConfig.targetInstanceIds || []) {
    if (party.some((p) => p.instanceId === tid)) targetIds.add(tid);
  }

  /** @type {string[]} */
  let crossSheetViewerIds = [];
  if (viewer?.role === 'gm') {
    crossSheetViewerIds = [];
  } else if (viewer?.role === 'player' && viewer.viewerCharacterInstanceId) {
    const idSet = new Set([viewer.viewerCharacterInstanceId]);
    const aid = actionConfig.actorInstanceId;
    if (aid && party.some((p) => p.instanceId === aid)) idSet.add(aid);
    crossSheetViewerIds = [...idSet];
  } else {
    const legacy = new Set(targetIds);
    const aid = actionConfig.actorInstanceId;
    if (aid && party.some((p) => p.instanceId === aid)) legacy.add(aid);
    crossSheetViewerIds = [...legacy];
  }

  const usageStore = {};
  const crossChips = [];
  for (const vid of crossSheetViewerIds) {
    const cross = collectChipsForOtherCharacterSheets(vid, party, registry, 'reviewAction', gameState, usageStore);
    for (const c of cross) {
      crossChips.push({ ...c, _v2Phase: 'reviewAction' });
    }
  }

  const merged = dedupeV2ChipsByChipKey([...list, ...crossChips]);

  if (!dedupeFeatureNames || dedupeFeatureNames.size === 0) return merged;
  return merged.filter((c) => !dedupeFeatureNames.has(c._featureName));
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

  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);

  const registry = buildV2RegistryWithSrdItems(srdData);
  const featureOpts = {
    fearCount: opts.fearCount,
    mapConfig: opts.mapConfig,
    tableFeatureState: opts.tableFeatureState,
  };
  const features = loadAllV2FeaturesForTable(activeForLoader, registry, featureOpts);
  const feature = features.find(
    (f) => f.name === chip._featureName && f._ownerInstanceId === chip._ownerInstanceId
  );
  if (!feature) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'feature-not-found' };
  }

  enrichV2RollIsSuccessFromTarget(roll, activeElements, srdData);
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
    registry,
  };

  const table = buildTableSnapshot(gameState);
  if (!canPayChipCosts(chip, table)) {
    return { mutations: [], chipState: makeChipState(), feature, error: 'unaffordable' };
  }
  deductChipCosts(chip, table);
  const chipState = makeChipState();
  const selectOpts = opts.selectOpts || {};
  const mutations = activateChip(chip, table, chipState, selectOpts);
  return { mutations, chipState, feature };
}

/**
 * Run a selected pre-roll **intent** chip's `onUse` (e.g. Apex Predator arms `apexPredatorArmed`)
 * without re-deducting Hope/Stress — the Before-you-roll Proceed path already applied costs.
 *
 * Toggle chips are activated as **on** (selected in the pre-roll panel).
 *
 * @param {object} chip
 * @param {object} roll — synthetic pre-roll skeleton ({@link buildV2PreRollWeaponAttackRollSkeleton})
 * @param {object[]} activeElements
 * @param {object} srdData
 * @param {{ fearCount?: number, mapConfig?: object|null, tableFeatureState?: object }} [opts]
 * @returns {{ mutations: object[], chipState: object, feature: object|null, error?: string }}
 */
export function activateV2IntentChipOnUse(chip, roll, activeElements, srdData, opts = {}) {
  if (!chip || !roll || !Array.isArray(activeElements) || !srdData) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'bad-args' };
  }

  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
  const registry = buildV2RegistryWithSrdItems(srdData);
  const featureOpts = {
    fearCount: opts.fearCount,
    mapConfig: opts.mapConfig,
    tableFeatureState: opts.tableFeatureState,
  };
  const features = loadAllV2FeaturesForTable(activeForLoader, registry, featureOpts);
  const feature = features.find(
    (f) => f.name === chip._featureName && f._ownerInstanceId === chip._ownerInstanceId
  );
  if (!feature) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'feature-not-found' };
  }

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
    registry,
  };

  const table = buildTableSnapshot(gameState);
  const chipState = makeChipState();
  if (chip.isToggle) chipState._isOn = true;
  const mutations = activateChip(chip, table, chipState, {});
  return { mutations, chipState, feature };
}

/**
 * Build the same `table` snapshot used by {@link activateV2ReviewChip} so UI can evaluate
 * `chip.isSelect(table)` / `chip.selectTargets(table)` before activation.
 *
 * @returns {object|null} `buildTableSnapshot(gameState)` or null when the chip cannot be resolved
 */
/**
 * Tooltip text when a V2 review chip cannot be used (resources or feature `isDisabled`).
 */
export function getV2ReviewChipDisableHint(chip, roll, activeElements, srdData, opts = {}) {
  const table = buildV2ReviewChipTableSnapshot(chip, roll, activeElements, srdData, opts);
  if (!table) return null;
  return getChipDisableHint(chip, table);
}

export function buildV2ReviewChipTableSnapshot(chip, roll, activeElements, srdData, opts = {}) {
  if (!chip || !roll || !Array.isArray(activeElements) || !srdData) return null;

  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);

  const registry = buildV2RegistryWithSrdItems(srdData);
  const featureOpts = {
    fearCount: opts.fearCount,
    mapConfig: opts.mapConfig,
    tableFeatureState: opts.tableFeatureState,
  };
  const features = loadAllV2FeaturesForTable(activeForLoader, registry, featureOpts);
  const feature = features.find(
    (f) => f.name === chip._featureName && f._ownerInstanceId === chip._ownerInstanceId
  );
  if (!feature) return null;

  enrichV2RollIsSuccessFromTarget(roll, activeElements, srdData);
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
    registry,
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

// ---------------------------------------------------------------------------
// One-shot `onUse` review chips (same pending banner / replacement roll id chain)
// ---------------------------------------------------------------------------

/**
 * Stable id for tracking whether a V2 review chip was already activated on this banner.
 * Scoped by feature owner (and cross-sheet viewer when present); `_chipKey` is per-feature
 * chip name + placement (see {@link collectChips} in chip-system).
 *
 * @param {object} chip
 * @returns {string}
 */
export function v2BannerChipActivationKey(chip) {
  if (!chip || typeof chip !== 'object') return '';
  const base =
    chip._chipKey ||
    `${chip._featureName ?? ''}::${chip.name ?? ''}::reviewAction`;
  return [chip._ownerInstanceId, chip._crossSheetViewerInstanceId, base]
    .filter((x) => x != null && x !== '')
    .join('::');
}

/** True when activating the chip should consume it for the lifetime of this banner chain. */
export function shouldV2ReviewChipConsumeOneShot(chip) {
  return typeof chip?.onUse === 'function' && chip?.isToggle !== true;
}

/**
 * Mark one-shot `onUse` chips that were already applied for this roll id (or migrated id) with
 * `_v2BannerOnUseConsumed: true` so the UI can show them disabled with a checkmark.
 *
 * @param {object[]} chips
 * @param {Set<string>|undefined} consumedKeys — from {@link v2BannerChipActivationKey}
 * @returns {object[]}
 */
export function annotateV2ReviewChipsBannerConsumed(chips, consumedKeys) {
  if (!Array.isArray(chips) || !chips.length) return chips || [];
  if (!consumedKeys?.size) return chips;
  return chips.map((c) => {
    if (!shouldV2ReviewChipConsumeOneShot(c)) return c;
    if (!consumedKeys.has(v2BannerChipActivationKey(c))) return c;
    return { ...c, _v2BannerOnUseConsumed: true };
  });
}

/**
 * When a pending banner is replaced (e.g. `postBannerAddDamage`), merge one-shot consumption
 * keys so the new `_rollDbId` still marks already-used chips as consumed.
 *
 * @param {number|string} prevRollDbId
 * @param {number|string} newRollDbId
 * @param {Map<number|string, Set<string>>} map
 * @returns {Map<number|string, Set<string>>}
 */
export function migrateV2BannerConsumedOnUseKeys(prevRollDbId, newRollDbId, map) {
  if (prevRollDbId == null || newRollDbId == null || prevRollDbId === newRollDbId) return map;
  const next = new Map(map);
  const from = next.get(prevRollDbId);
  if (!from?.size) {
    next.delete(prevRollDbId);
    return next;
  }
  const to = new Set(next.get(newRollDbId) || []);
  for (const k of from) to.add(k);
  next.set(newRollDbId, to);
  next.delete(prevRollDbId);
  return next;
}

/**
 * @param {number|string} rollDbId
 * @param {object} chip
 * @param {Map<number|string, Set<string>>} map
 * @returns {Map<number|string, Set<string>>}
 */
export function recordV2BannerConsumedOnUse(rollDbId, chip, map) {
  if (rollDbId == null || !shouldV2ReviewChipConsumeOneShot(chip)) return map;
  const key = v2BannerChipActivationKey(chip);
  if (!key) return map;
  const next = new Map(map);
  const set = new Set(next.get(rollDbId) || []);
  set.add(key);
  next.set(rollDbId, set);
  return next;
}

/**
 * Drop map entries for roll ids that are no longer pending (avoid unbounded growth).
 *
 * @param {Map<number|string, Set<string>>} map
 * @param {Iterable<number|string>} activeRollDbIds
 * @returns {Map<number|string, Set<string>>}
 */
export function pruneV2BannerConsumedOnUseKeys(map, activeRollDbIds) {
  const keep = new Set(activeRollDbIds);
  let changed = false;
  const next = new Map();
  for (const [id, set] of map) {
    if (keep.has(id)) next.set(id, set);
    else changed = true;
  }
  return changed ? next : map;
}

// ---------------------------------------------------------------------------
// Damage acknowledge — opt-in `onReviewAction` (post-HP side effects only)
// ---------------------------------------------------------------------------

function capitalizeTraitKey(traitKey) {
  const t = String(traitKey || 'agility').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : 'Agility';
}

/**
 * Run V2 `onIntent` for a pending trait roll (e.g. Air advantage die) — returns engine mutations
 * (`addAdvantageDie`, …) for the client roll wrapper.
 *
 * @param {{
 *   traitKey: string,
 *   actorInstanceId: string,
 *   activeElements: object[],
 *   srdData: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 * }} opts
 * @returns {object[]}
 */
/**
 * Synthetic client roll used only for V2 **intent** chip collection before the server roll exists.
 * Includes placeholder Hope/Fear/damage sub-items so {@link hydrateV2RollsFromClientRoll} + damage dice exist.
 *
 * @param {{
 *   pendingMeta: object,
 *   pendingRollText: string,
 *   characterEl: object,
 * }} opts
 * @returns {object|null}
 */
export function buildV2PreRollWeaponAttackRollSkeleton(opts) {
  const { pendingMeta, pendingRollText, characterEl } = opts || {};
  if (!pendingMeta?._attackerInstanceId || !characterEl) return null;
  const weaponId = pendingMeta._weaponId;
  const weapons = characterEl.weapons || [];
  const weapon =
    (weaponId != null ? weapons.find((w) => w.id === weaponId) : null) || weapons[0] || null;
  const damageSource = weapon?.damage || 'd8';
  const dm = String(damageSource).trim().match(/^(\d*d\d+)/i);
  const damageInput = dm ? dm[1] : 'd8';

  return {
    rollText: pendingRollText,
    _attackerInstanceId: pendingMeta._attackerInstanceId,
    _weaponId: weaponId ?? weapon?.id ?? null,
    _traitKey: pendingMeta._traitKey,
    _weaponRangeFt: pendingMeta._weaponRangeFt,
    _selectedTargetInstanceId: pendingMeta._selectedTargetInstanceId,
    subItems: [
      { pre: 'Hope ', input: 'd12', result: '1', post: '' },
      { pre: 'Fear ', input: 'd12', result: '1', post: '' },
      { pre: 'damage ', input: damageInput, result: '1', post: ' phy' },
    ],
  };
}

/**
 * Synthetic roll for V2 **trait** / spellcast intent chips (no weapon sub-items).
 *
 * @param {{
 *   pendingMeta: object,
 *   pendingRollText: string,
 *   characterEl: object,
 * }} opts
 * @returns {object|null}
 */
export function buildV2PreRollTraitRollSkeleton(opts) {
  const { pendingMeta, pendingRollText, characterEl } = opts || {};
  if (!pendingMeta?._attackerInstanceId || !characterEl) return null;
  if (pendingMeta._weaponRangeFt != null || pendingMeta._weaponId != null) return null;

  const rawTk = (pendingMeta._traitKey || 'agility').toLowerCase();
  const traits = characterEl.traits || {};
  const traitScore = Number(traits[rawTk] ?? 0);
  const traitLabel = TRAIT_FULL_PRETTY[rawTk] || rawTk.charAt(0).toUpperCase() + rawTk.slice(1);

  return {
    rollText: pendingRollText,
    _attackerInstanceId: pendingMeta._attackerInstanceId,
    _traitKey: rawTk,
    _selectedTargetInstanceId: pendingMeta._selectedTargetInstanceId,
    subItems: [
      { pre: 'Hope ', input: 'd12', result: '1', post: '' },
      { pre: 'Fear ', input: 'd12', result: '1', post: '' },
      { pre: `${traitLabel} `, input: String(traitScore), result: String(traitScore), post: '' },
    ],
  };
}

/**
 * Intent-phase chips for a pending weapon attack (e.g. Devastating), using the same hydrated snapshot shape as post-roll review.
 *
 * @param {{
 *   pendingMeta: object,
 *   pendingRollText: string,
 *   characterEl: object,
 *   activeElements: object[],
 *   srdData: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 *   viewer?: { role: 'gm'|'player', viewerCharacterInstanceId?: string|null },
 * }} opts
 * @returns {object[]}
 */
export function collectV2WeaponIntentChips(opts) {
  const {
    pendingMeta,
    pendingRollText,
    characterEl,
    activeElements,
    srdData,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
    viewer,
  } = opts || {};
  if (!pendingMeta || !characterEl || !Array.isArray(activeElements) || !srdData) return [];
  if (pendingMeta._intentPanelForActionRoll !== true) return [];

  const isWeaponIntent =
    pendingMeta._weaponRangeFt != null || pendingMeta._weaponId != null;
  const isTraitIntent =
    !isWeaponIntent &&
    pendingMeta._traitKey != null &&
    pendingMeta._weaponRangeFt == null &&
    pendingMeta._weaponId == null;
  if (!isWeaponIntent && !isTraitIntent) return [];

  const roll = isWeaponIntent
    ? buildV2PreRollWeaponAttackRollSkeleton({
        pendingMeta,
        pendingRollText,
        characterEl,
      })
    : buildV2PreRollTraitRollSkeleton({
        pendingMeta,
        pendingRollText,
        characterEl,
      });
  if (!roll) return [];
  if (pendingMeta._isSpellcastRoll === true) {
    roll._isSpellcastRoll = true;
  }

  const registry = buildV2RegistryWithSrdItems(srdData);
  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
  const features = loadAllV2FeaturesForTable(activeForLoader, registry, {
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  const actionConfig = buildActionConfigFromRoll(roll, activeForLoader);
  if (!actionConfig) return [];

  const gameState = buildV2BannerGameState({
    roll,
    activeElements: activeForLoader,
    fearCount,
    mapConfig,
    tableFeatureState,
  });

  const raw = collectPhaseChipsOnly(gameState, actionConfig, features, 'intent', {}, viewer);
  return raw.map((c) => ({ ...c, _v2IntentChip: true }));
}

export function runV2IntentPhaseForTraitRoll(opts) {
  const {
    traitKey,
    actorInstanceId,
    activeElements,
    srdData,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
  } = opts || {};
  if (!traitKey || !actorInstanceId || !Array.isArray(activeElements) || !srdData) return [];
  const registry = buildV2RegistryWithSrdItems(srdData);
  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
  const features = loadAllV2FeaturesForTable(activeForLoader, registry, {
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  const tk = capitalizeTraitKey(traitKey);
  const gameState = {
    fear: fearCount,
    mapConfig,
    activeElements: activeForLoader,
    featureState: mergeV2TableFeatureState(tableFeatureState, activeForLoader),
    rolls: {
      action: { dice: [], statics: [], hopeDie: null, fearDie: null, gmDie: null, isSuccess: null, isCritical: null },
      damage: { dice: [], statics: [] },
      other: {},
    },
    action: {
      type: 'trait',
      actorInstanceId,
      targetInstanceIds: [],
      trait: tk,
      range: 'melee',
      effects: [],
      appliedEffects: [],
    },
  };
  const actionConfig = {
    type: 'trait',
    actorInstanceId,
    targetInstanceIds: [],
    traitKey: tk,
    range: 'melee',
  };
  const loop = createActionLoop(gameState, actionConfig, features, {});
  const { mutations } = loop.runPhase('intent');
  return mutations || [];
}

/**
 * Run `hooks.onRest` for every loaded V2 feature (per owner), using a synthetic rest action.
 * Must match the **actual** rest being acknowledged: Short Rest → `shortRest`, Long Rest → `longRest`
 * so registry code that gates on `table.action?.type` (e.g. long-rest-only token refresh) runs correctly.
 *
 * @param {{
 *   activeElements: object[],
 *   srdData: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 *   restDuration?: 'short' | 'long',
 * }} opts
 * @returns {{ updates: { instanceId: string, updates: object }[], skipped: object[] }}
 */
export function runV2RestHooksForTable(opts) {
  const {
    activeElements,
    srdData,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
    restDuration = 'short',
  } = opts || {};
  if (!Array.isArray(activeElements) || !srdData) {
    return { updates: [], skipped: [] };
  }
  const actionType = restDuration === 'long' ? 'longRest' : 'shortRest';
  const registry = buildV2RegistryWithSrdItems(srdData);
  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
  const features = loadAllV2FeaturesForTable(activeForLoader, registry, {
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  const firstPc = activeForLoader.find((e) => e.elementType === 'character');
  const actorId = firstPc?.instanceId ?? '';
  const gameState = {
    fear: fearCount,
    mapConfig,
    activeElements: activeForLoader,
    featureState: mergeV2TableFeatureState(tableFeatureState, activeForLoader),
    rolls: {
      action: { dice: [], statics: [], hopeDie: null, fearDie: null, gmDie: null, isSuccess: null, isCritical: null },
      damage: { dice: [], statics: [] },
      other: {},
    },
    action: {
      type: actionType,
      actorInstanceId: actorId,
      targetInstanceIds: [],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    },
  };
  const actionConfig = {
    type: actionType,
    actorInstanceId: actorId,
    targetInstanceIds: [],
    traitKey: 'Agility',
    range: 'melee',
  };
  const loop = createActionLoop(gameState, actionConfig, features, {});
  const { mutations } = loop.runPhase('intent');
  const { updates, skipped } = applyV2LifecycleMutations(activeForLoader, mutations || [], undefined);
  return { updates, skipped };
}

function buildFireRetaliationPostRoll(roll, activeElements) {
  const targetId = roll?._selectedTargetInstanceId;
  const charEl = activeElements.find((e) => e.instanceId === targetId && e.elementType === 'character');
  const attackerIds = roll?._attackerInstanceIds ?? (roll?._attackerInstanceId ? [roll._attackerInstanceId] : []);
  if (!charEl || !attackerIds.length) return null;
  return {
    rollText: `${charEl.name} Fire Retaliation damage [1d10]`,
    displayName: charEl.name,
    rollMeta: {
      attackerId: charEl.instanceId,
      targetId: attackerIds[0],
    },
  };
}

function tryWaterSplashActionNotification(roll, mutations, activeElements) {
  const targetId = roll?._selectedTargetInstanceId;
  const attackerId = roll?._attackerInstanceId;
  if (!targetId || !attackerId) return null;
  const atk = activeElements.find((e) => e.instanceId === attackerId && e.elementType === 'character');
  const ch = atk?.featureState?.[WARDEN_OF_THE_ELEMENTS_SCOPE_KEY]?.channeledElement;
  if (ch !== 'water') return null;
  const marked = (mutations || []).filter(
    (m) =>
      m?.type === 'markStress' &&
      m.payload?.instanceId &&
      m.payload.instanceId !== targetId,
  );
  if (!marked.length) return null;
  const names = marked
    .map((m) => activeElements.find((e) => e.instanceId === m.payload.instanceId)?.name)
    .filter(Boolean);
  if (!names.length) return null;
  return {
    _action: true,
    rollUser: atk?.name || 'Character',
    actionName: 'Water Retaliation',
    actionText: `Water: ${names.length} nearby adversary/adversaries marked Stress.`,
  };
}

/**
 * After HP damage is applied on the Game Table, run opt-in `onReviewAction` hooks (e.g. Warden
 * elemental splash / retaliation) and return table ops + follow-up rolls.
 *
 * @param {{
 *   roll: object,
 *   activeElements: object[],
 *   srdData: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 *   tableFeatureState?: object,
 *   hpApplied: number,
 * }} ctx
 * @returns {{
 *   elementUpdates: { instanceId: string, updates: object }[],
 *   postRolls: { rollText: string, displayName: string, rollMeta?: object }[],
 *   actionNotifications: object[],
 *   skipped: object[],
 * }}
 */
export function runV2DamageAckReviewActionHooks(ctx) {
  const empty = {
    elementUpdates: [],
    postRolls: [],
    actionNotifications: [],
    skipped: [],
    fearDelta: 0,
  };
  const { roll, activeElements, srdData, fearCount = 0, mapConfig = null, tableFeatureState, hpApplied } = ctx || {};
  if (hpApplied < 1 || !roll || !Array.isArray(activeElements) || !srdData) return empty;

  enrichV2RollIsSuccessFromTarget(roll, activeElements, srdData);
  const registry = buildV2RegistryWithSrdItems(srdData);
  const activeForLoader = expandTableCharactersAncestryForV2Loader(activeElements, srdData);
  const featureOpts = { fearCount, mapConfig, tableFeatureState };
  const allFeatures = loadAllV2FeaturesForTable(activeForLoader, registry, featureOpts);
  const hooksFeatures = allFeatures.filter((f) => f.runOnReviewActionAfterHpApplied === true);
  if (!hooksFeatures.length) return empty;

  const actionConfig = buildActionConfigFromRoll(roll, activeForLoader);
  if (!actionConfig) return empty;

  const gameState = buildV2BannerGameState({
    roll,
    activeElements: activeForLoader,
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  const loop = createActionLoop(gameState, actionConfig, hooksFeatures, {});
  const { mutations } = loop.runPhase('reviewAction');
  const raw = mutations || [];
  const rollDies = raw.filter((m) => m?.type === 'rollDie');
  const nonRoll = raw.filter((m) => m?.type !== 'rollDie');

  // Table-level fear mutations are not element patches — surface as fearDelta for the host.
  let fearDelta = 0;
  const nonRollSansFear = [];
  for (const m of nonRoll) {
    if (m?.type === 'spendFear') {
      fearDelta -= Math.max(0, Math.floor(Number(m.payload?.amount) || 0));
      continue;
    }
    if (m?.type === 'gainFear') {
      fearDelta += Math.max(0, Math.floor(Number(m.payload?.amount) || 0));
      continue;
    }
    nonRollSansFear.push(m);
  }

  const postRolls = [];
  if (rollDies.some((m) => String(m?.payload?.notation || '').toLowerCase() === 'd10')) {
    const pr = buildFireRetaliationPostRoll(roll, activeForLoader);
    if (pr) postRolls.push(pr);
  }

  // Prefer the acting attacker as setFeatureState owner (e.g. Apex Predator clears armed flag).
  const ownerId = roll._attackerInstanceId ?? actionConfig.actorInstanceId ?? undefined;
  const { updates, skipped } = applyV2LifecycleMutations(activeForLoader, nonRollSansFear, ownerId);
  const actionNotifications = [];
  const splash = tryWaterSplashActionNotification(roll, mutations, activeForLoader);
  if (splash) actionNotifications.push(splash);

  return {
    elementUpdates: updates || [],
    postRolls,
    actionNotifications,
    skipped: skipped || [],
    fearDelta,
  };
}

/**
 * Generic preview lines for the damage banner (from `featureState` + map geometry).
 *
 * @param {{
 *   roll: object,
 *   activeElements: object[],
 *   selectedDamageTargetId?: string|null,
 * }} opts
 * @returns {string[]}
 */
export function computeV2DamageBannerAckNotices(opts) {
  const { roll, activeElements, selectedDamageTargetId } = opts || {};
  const notes = [];
  if (!roll || !Array.isArray(activeElements)) return notes;

  if (
    roll._attackerType === 'adversary' &&
    roll._attackRangeFt != null &&
    roll._attackRangeFt <= RANGE_BANDS_FT.MELEE &&
    selectedDamageTargetId
  ) {
    const t = activeElements.find((e) => e.instanceId === selectedDamageTargetId && e.elementType === 'character');
    const ch = t?.featureState?.[WARDEN_OF_THE_ELEMENTS_SCOPE_KEY]?.channeledElement;
    if (ch === 'fire') {
      notes.push(`🔥 Fire: ${t?.name || 'Target'} retaliates 1d10 magic damage.`);
    }
  }

  const hasDamage = (roll.subItems || []).some((s) => /damage/i.test(s.pre || '') && s.input);
  const attackerId = roll._attackerInstanceId;
  if (hasDamage && attackerId && selectedDamageTargetId) {
    const atk = activeElements.find((e) => e.instanceId === attackerId && e.elementType === 'character');
    if (atk?.featureState?.[WARDEN_OF_THE_ELEMENTS_SCOPE_KEY]?.channeledElement === 'water') {
      const advTarget = activeElements.find((e) => e.instanceId === selectedDamageTargetId);
      const isMeleeHit = (() => {
        if (atk.tokenX != null && advTarget?.tokenX != null) {
          return tokenDistanceFtForElements(atk, advTarget) <= RANGE_BANDS_FT.MELEE;
        }
        return true;
      })();
      if (isMeleeHit) {
        const struck = activeElements.find((e) => e.instanceId === selectedDamageTargetId);
        const veryCloseAdvs = [];
        if (
          struck?.tokenX != null &&
          struck?.tokenY != null &&
          (struck.elementType === 'adversary' || struck.type === 'adversary')
        ) {
          for (const el of activeElements) {
            if (el.elementType !== 'adversary' && el.type !== 'adversary') continue;
            if (String(el.instanceId) === String(selectedDamageTargetId)) continue;
            if (el.tokenX == null || el.tokenY == null) continue;
            const d = tokenDistanceFtForElements(struck, el);
            if (distanceFtToRangeBandName(d) === 'Very Close') {
              veryCloseAdvs.push({ instanceId: el.instanceId, name: el.name });
            }
          }
        }
        if (veryCloseAdvs.length > 0) {
          const names = veryCloseAdvs.map((a) => a.name || 'Unknown');
          notes.push(`💧 Water: ${names.join(', ')} will mark Stress.`);
        }
      }
    }
  }

  return notes;
}
