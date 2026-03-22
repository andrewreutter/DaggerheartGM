// Runtime fields that are local to the Game Table and NOT overwritten by library data.
// Used when resolving characters by reference: library base data is merged in, but
// these fields are preserved from the stored activeElement.
// Any _ prefixed key on a character element is also preserved automatically
// (ancestry/class feature state uses _ prefix by convention, e.g. _fearlessToggle).
export const CHARACTER_RUNTIME_KEYS = [
  'instanceId', 'elementType',
  'currentHp', 'currentStress', 'hope', 'currentArmor', 'conditions',
  'tokenX', 'tokenY',
  'assignedPlayerEmail', 'assignedPlayerUid', 'playerName',
  'reinforcedActive',
  'selectedExperienceIndex',  // which experience is selected for the next roll (+2)
  // Feature interaction state
  'featureUsage',      // { [featureKey]: { used: boolean, cycle: 'session'|'rest'|'longRest' } }
  'activeModifiers',   // [{ id, name, dice?, value?, mode?, bonus?, trait?, type, refreshOn }]
  'focusTargetId',     // Ranger's Focus: instanceId of the currently focused adversary
  'rangerFocusOnNextAttack',  // Ranger's Focus: use on next weapon attack (toggle)
  'companion',         // Beastbound: { name, species, evasion, maxStress, currentStress }; table stress preserved
  'activeBeastform',           // Druid: current beastform object or null
  'selectedBeastformAdvantage', // Druid: currently selected beastform advantage label or null
  'activeChanneledElement',   // Warden of the Elements: 'fire'|'earth'|'water'|'air' or null
  'wingsOfLightFlying',        // Winged Sentinel: whether the character is currently flying
  'faerieWingsFlying',        // Faerie Wings: whether the character is currently flying (for Wings chip)
  'retractedActive',           // Galapa Retract: in shell (toggle state for card chip)
  'resistance',                // [{ type, source }] e.g. physical from Galapa Retract
  'disadvantageSources',       // string[] sources that add disadvantage to this character's rolls
  'moveDisabledSources',       // string[] sources that prevent token move (e.g. Retract)
  'lockedOnTargetInstanceId',  // Locked On (weapon): instanceId of target; next primary attack vs them auto-succeeds, cleared on ack
  /**
   * V2 engine: per-character persistent feature bags (`{ [featureKey]: { ... } }`), merged with
   * optional table-level `featureState` in `mergeDeclarativeFeatureState` (see `src/features-v2/engine/feature-loader.js`).
   */
  'featureState',
];

/**
 * Optional top-level keys on the `table_state` JSON document (alongside `elements`, `fearCount`, …)
 * used by the V2 engine for **session-wide** `gameState.featureState` (e.g. Bard **Rally** `partyDice`
 * stored under `featureState.Rally` when the host merges table + character state).
 * The DB stores the full `table_state` blob; these keys are not stripped (only character elements are stripped).
 */
export const TABLE_STATE_V2_ROOT_KEYS = ['featureState'];

export const RUNTIME_KEYS = [
  'instanceId', 'elementType', 'currentHp', 'currentStress', 'conditions', 'hope', 'maxHope',
  'playerName', 'maxHp', 'maxStress', 'name',
  'daggerstackUrl', 'daggerstackEmail', 'daggerstackPassword', 'daggerstackCharacterId',
  'class', 'subclass', 'level', 'pronouns', 'description', 'ancestry', 'community',
  'domains', 'traits', 'evasion', 'armorScore', 'armorName', 'armorThresholds',
  'maxArmor', 'currentArmor', 'weapons', 'gold', 'inventory',
  'classFeatures', 'subclassFeatures', 'ancestryFeatures', 'communityFeatures',
  'experiences', 'spellcastTrait', 'hopeAbility', 'hopeAbilityName', 'companion', 'tier',
  'tokenX', 'tokenY',
  'classId', 'subclassId', 'ancestryIds', 'communityId',
  'armorId', 'primaryWeaponId', 'secondaryWeaponId',
  'abilityIds', 'abilities', 'baseTraits', 'advancements', 'proficiency',
  'background', 'connectionText', 'hopeFeature',
  'weaponMods', 'armorMods',
  'difficultyMod',     // Make a Scene: cumulative difficulty modifier applied by Bard feature
  'vulnerable',        // Retracting Claws (Katari): adversary condition, apply on successful attack
  'focusedBy',         // Ranger's Focus: character name who has this adversary as Focus
];

/**
 * Apply a table operation to GM-side state (pure function).
 * Returns an object containing only the state keys that changed.
 */
export function applyTableOp(op, state) {
  const { activeElements = [], featureCountdowns = {} } = state;
  switch (op.op) {
    case 'update-element':
      return { activeElements: activeElements.map(el => el.instanceId === op.instanceId ? { ...el, ...op.updates } : el) };
    case 'update-elements': {
      // Batch update: op.updates is [{ instanceId, updates }] — all applied atomically in one server round-trip.
      const map = {};
      for (const { instanceId, updates } of (op.updates || [])) {
        map[instanceId] = { ...(map[instanceId] || {}), ...updates };
      }
      return { activeElements: activeElements.map(el => map[el.instanceId] ? { ...el, ...map[el.instanceId] } : el) };
    }
    case 'add-elements':
      return { activeElements: [...activeElements, ...op.elements] };
    case 'remove-element':
      return { activeElements: activeElements.filter(el => el.instanceId !== op.instanceId) };
    case 'clear-table':
      return { activeElements: activeElements.filter(el => el.elementType === 'character'), featureCountdowns: {} };
    case 'set-fear':
      return { fearCount: op.fearCount };
    case 'set-countdown':
      return { featureCountdowns: { ...featureCountdowns, [op.key]: op.value } };
    case 'set-battle-mods':
      return { tableBattleMods: op.tableBattleMods };
    case 'set-player-emails':
      return { playerEmails: op.playerEmails };
    case 'update-base-data': {
      return {
        activeElements: activeElements.map(el => {
          if (el.id !== op.elementId) return el;
          const runtime = {};
          RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
          return { ...op.newBaseData, ...runtime };
        }),
      };
    }
    case 'character-library-update': {
      return {
        activeElements: activeElements.map(el => {
          if (el.elementType !== 'character' || el.id !== op.characterId) return el;
          const runtime = {};
          CHARACTER_RUNTIME_KEYS.forEach(k => {
            if (k === 'companion') return;
            if (k in el) runtime[k] = el[k];
          });
          // Auto-preserve any _ prefixed keys (ancestry/class feature toggle state).
          Object.keys(el).forEach(k => { if (k.startsWith('_') && k in el) runtime[k] = el[k]; });
          const merged = { ...op.newBaseData, ...runtime, elementType: 'character' };
          if (op.newBaseData.companion || el.companion) {
            merged.companion = { ...(op.newBaseData.companion || {}), currentStress: el.companion?.currentStress };
          }
          return merged;
        }),
      };
    }
    case 'set-map':
      return {
        mapConfig: {
          mapImageUrl: op.mapImageUrl ?? null,
          mapDimension: op.mapDimension ?? 'width',
          mapSizeFt: op.mapSizeFt ?? 100,
          mapImageNaturalWidth: op.mapImageNaturalWidth ?? null,
          mapImageNaturalHeight: op.mapImageNaturalHeight ?? null,
        },
        // When image changes, reset all token positions
        ...(op.resetTokenPositions ? {
          activeElements: activeElements.map(el => ({ ...el, tokenX: null, tokenY: null })),
        } : {}),
      };
    case 'set-gm-display-name':
      return { gmDisplayName: op.gmDisplayName };
    case 'set-table-feature-state':
      return { featureState: op.featureState ?? {} };
    case 'set-table-name':
      return { tableName: op.tableName ?? '' };
    case 'life-support-select': {
      const prev = state.lifeSupportSelections || {};
      const key = String(op._rollDbId);
      const value = op.selectedLifeSupportTargetInstanceId;
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return { lifeSupportSelections: next };
    }
    case 'life-support-clear': {
      const prev = state.lifeSupportSelections || {};
      const next = { ...prev };
      delete next[String(op._rollDbId)];
      return { lifeSupportSelections: next };
    }
    case 'rest-move-select': {
      const prev = state.restMovesSelections || {};
      const key = String(op.rollDbId);
      const perRoll = prev[key] ? { ...prev[key] } : {};
      const perChar = perRoll[op.instanceId] ? { ...perRoll[op.instanceId] } : {};
      perChar['move' + op.slot] = op.moveId ?? null;
      if (op.targetInstanceId !== undefined) perChar['move' + op.slot + 'TargetInstanceId'] = op.targetInstanceId ?? null;
      if (op.rollResult !== undefined) perChar['move' + op.slot + 'RollResult'] = op.rollResult ?? null;
      perRoll[op.instanceId] = perChar;
      const next = { ...prev, [key]: perRoll };
      return { restMovesSelections: next };
    }
    case 'rest-move-clear': {
      const prev = state.restMovesSelections || {};
      const next = { ...prev };
      delete next[String(op._rollDbId)];
      return { restMovesSelections: next };
    }
    default:
      return {};
  }
}

/**
 * Apply V2 engine mutations that target **`element.activeModifiers`** (Phase 1 shape) in order.
 * Ignores other mutation types (Hope/Stress, rolls, etc.) — those are handled by the VTT separately.
 *
 * @param {object[]} activeElements — current table elements
 * @param {object[]} mutations — `{ type, payload }[]` from `applyMutations(table)` (V2)
 * @returns {object[]} — new **`activeElements`** array (copied elements; only character rows touched)
 */
export function applyV2ActiveModifierMutations(activeElements, mutations) {
  if (!Array.isArray(activeElements) || !Array.isArray(mutations) || mutations.length === 0) {
    return activeElements;
  }
  const idxByInstance = new Map(activeElements.map((el, i) => [el.instanceId, i]));
  const out = activeElements.map(el => ({ ...el }));

  for (const m of mutations) {
    if (!m?.type || !m?.payload) continue;
    const { type, payload } = m;
    if (type === 'appendActiveModifier') {
      const { instanceId, modifier } = payload;
      if (!instanceId || !modifier?.id || !modifier?.name) continue;
      const i = idxByInstance.get(instanceId);
      if (i === undefined || out[i].elementType !== 'character') continue;
      const el = out[i];
      const cur = [...(el.activeModifiers || [])];
      const ix = cur.findIndex(x => x.id === modifier.id);
      if (ix >= 0) cur[ix] = { ...modifier };
      else cur.push({ ...modifier });
      out[i] = { ...el, activeModifiers: cur };
    } else if (type === 'removeActiveModifier') {
      const { instanceId, id } = payload;
      if (!instanceId || id == null) continue;
      const i = idxByInstance.get(instanceId);
      if (i === undefined || out[i].elementType !== 'character') continue;
      const el = out[i];
      const rid = String(id);
      const next = (el.activeModifiers || []).filter(x => x.id !== rid);
      if (next.length === (el.activeModifiers || []).length) continue;
      out[i] = { ...el, activeModifiers: next };
    }
  }
  return out;
}

/**
 * Apply V2 engine mutations from a banner chip (`activateChip` / `deductChipCosts`) to character
 * (and adversary) rows. Mutations that need server-side dice rolls or banner patches are not applied
 * and are returned in `skipped`.
 *
 * @param {object[]} activeElements — current table elements (read-only basis; caller merges)
 * @param {object[]} mutations — `{ type, payload }[]`
 * @param {string} ownerInstanceId — feature owner (`chip._ownerInstanceId`) for `setFeatureState` rows
 * @returns {{ updates: { instanceId: string, updates: object }[], skipped: object[] }}
 */
export function applyV2BannerMutations(activeElements, mutations, ownerInstanceId) {
  const skipped = [];
  const byId = new Map();
  const getBase = (id) => {
    const patch = byId.get(id);
    const base = activeElements.find((e) => e.instanceId === id);
    return patch ? { ...base, ...patch } : base && { ...base };
  };

  const merge = (instanceId, partial) => {
    if (!instanceId) return;
    const prev = byId.get(instanceId) || {};
    byId.set(instanceId, { ...prev, ...partial });
  };

  const modMuts = [];

  for (const m of mutations || []) {
    if (!m?.type || !m?.payload) continue;
    const { type, payload } = m;

    const skip = () => skipped.push(m);

    if (type === 'appendActiveModifier' || type === 'removeActiveModifier') {
      modMuts.push(m);
      continue;
    }

    switch (type) {
      case 'setFeatureState': {
        const { featureKey, key, value } = payload;
        if (!ownerInstanceId || !featureKey) {
          skip();
          break;
        }
        const el = getBase(ownerInstanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const fs = { ...(el.featureState || {}) };
        const bag = { ...(fs[featureKey] || {}) };
        bag[key] = value;
        fs[featureKey] = bag;
        merge(ownerInstanceId, { featureState: fs });
        break;
      }
      case 'spendHope': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const max = el.maxHope ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const hope = Math.max(0, (el.hope ?? max) - n);
        merge(instanceId, { hope });
        break;
      }
      case 'gainHope': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const max = el.maxHope ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const hope = Math.min(max, (el.hope ?? max) + n);
        merge(instanceId, { hope });
        break;
      }
      case 'markStress': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const maxS = el.maxStress ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentStress = Math.min(maxS, (el.currentStress ?? 0) + n);
        merge(instanceId, { currentStress });
        break;
      }
      case 'clearStress': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentStress = Math.max(0, (el.currentStress ?? 0) - n);
        merge(instanceId, { currentStress });
        break;
      }
      case 'markHP': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        const maxH = el.maxHp ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentHp = Math.max(0, Math.min(maxH, (el.currentHp ?? maxH) - n));
        merge(instanceId, { currentHp });
        break;
      }
      case 'clearHP': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el) {
          skip();
          break;
        }
        const maxH = el.maxHp ?? 6;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentHp = Math.min(maxH, (el.currentHp ?? maxH) + n);
        merge(instanceId, { currentHp });
        break;
      }
      case 'markArmor': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const maxA = el.maxArmor ?? 0;
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentArmor = Math.min(maxA, (el.currentArmor ?? 0) + n);
        merge(instanceId, { currentArmor });
        break;
      }
      case 'clearArmor': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const currentArmor = Math.max(0, (el.currentArmor ?? 0) - n);
        merge(instanceId, { currentArmor });
        break;
      }
      case 'spendGold': {
        const { instanceId, amount } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const n = Math.max(0, Math.floor(Number(amount)) || 0);
        const gold = Math.max(0, (el.gold ?? 0) - n);
        merge(instanceId, { gold });
        break;
      }
      case 'setFocusTarget': {
        const { instanceId, focusTargetInstanceId } = payload;
        merge(instanceId, {
          focusTargetInstanceId: focusTargetInstanceId ?? null,
          focusTargetId: focusTargetInstanceId ?? null,
        });
        break;
      }
      case 'setRangerFocusOnNextAttack': {
        const { instanceId, value } = payload;
        merge(instanceId, { rangerFocusOnNextAttack: value === true });
        break;
      }
      case 'setFocusedBy': {
        const { instanceId, focusedBy } = payload;
        merge(instanceId, { focusedBy: focusedBy ?? null });
        break;
      }
      case 'runtimeStatMod': {
        if (payload.stat === 'difficulty') {
          const el = getBase(payload.instanceId);
          if (!el || el.elementType !== 'adversary') {
            skip();
            break;
          }
          const cur = el.difficultyMod ?? 0;
          const next = cur + (Number(payload.delta) || 0);
          merge(payload.instanceId, { difficultyMod: next });
        } else skip();
        break;
      }
      case 'setPrayerDicePool': {
        const { instanceId, pool } = payload;
        merge(instanceId, { prayerDice: { pool: Array.isArray(pool) ? [...pool] : [] } });
        break;
      }
      case 'removePrayerDieAt': {
        const { instanceId, index } = payload;
        const el = getBase(instanceId);
        if (!el || el.elementType !== 'character') {
          skip();
          break;
        }
        const pool = [...(el.prayerDice?.pool || [])];
        const idx = Math.floor(Number(index));
        if (idx >= 0 && idx < pool.length) pool.splice(idx, 1);
        merge(instanceId, { prayerDice: { pool } });
        break;
      }
      default:
        skip();
    }
  }

  let mergedEls = activeElements.map((el) => {
    const u = byId.get(el.instanceId);
    return u ? { ...el, ...u } : { ...el };
  });
  if (modMuts.length > 0) {
    mergedEls = applyV2ActiveModifierMutations(mergedEls, modMuts);
  }

  const updates = [];
  for (const el of mergedEls) {
    const orig = activeElements.find((e) => e.instanceId === el.instanceId);
    if (!orig) continue;
    const partial = {};
    for (const k of Object.keys(el)) {
      if (el[k] !== orig[k]) partial[k] = el[k];
    }
    if (Object.keys(partial).length > 0) {
      updates.push({ instanceId: el.instanceId, updates: partial });
    }
  }

  return { updates, skipped };
}

/**
 * Mutations that adjust hydrated roll shape only (no `activeElements` patch). The Game Table does not
 * yet persist these onto the pending banner — they are omitted from {@link applyV2BannerMutations} so
 * they do not appear in `skipped` / console warnings.
 */
const V2_ENGINE_ROLL_DISPLAY_MUTATION_TYPES = new Set([
  'addRollStatic',
  'addRollDie',
  'setDie',
  'setRollOutcome',
  'swapHopeFearDice',
  'addAdvantageDie',
  'addDisadvantageDie',
  'removeAdvantageDie',
  'removeDisadvantageDie',
  'removeRollDie',
  'addNarration',
]);

/**
 * Merge adjacent Hope + Fear `rerollDie` mutations (e.g. Faerie **Luckbender** calling both
 * `hopeDie.reroll()` and `fearDie.reroll()`) into one server round-trip via `dieType: 'Duality'`.
 *
 * @param {object[]} mutations
 * @returns {object[]}
 */
export function normalizeV2BannerChipMutations(mutations) {
  if (!Array.isArray(mutations) || mutations.length === 0) return mutations || [];
  const out = [];
  for (let i = 0; i < mutations.length; i++) {
    const a = mutations[i];
    const b = mutations[i + 1];
    if (
      a?.type === 'rerollDie' &&
      b?.type === 'rerollDie'
    ) {
      const dt1 = a.payload?.dieType;
      const dt2 = b.payload?.dieType;
      if (
        (dt1 === 'hopeDie' && dt2 === 'fearDie') ||
        (dt1 === 'fearDie' && dt2 === 'hopeDie')
      ) {
        out.push({
          type: 'rerollDie',
          payload: { dieType: 'dualityDie', _mergedFrom: [a, b] },
        });
        i++;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

/**
 * Split V2 `activateChip` / `applyMutations` output into:
 * - **localMutations** — applied by {@link applyV2BannerMutations} (Hope/Stress, featureState, …)
 * - **serverFollowups** — must use `postBannerAddDamage` / `postBannerRerollDie` (banner dice replacement)
 * - **engineRollDisplayOnly** — roll-shape / narration mutations not persisted on the VTT yet (not an error)
 * - **unsupported** — not representable on the current Game Table APIs (logged for diagnostics)
 *
 * @param {object[]} mutations — `{ type, payload }[]`
 * @returns {{
 *   localMutations: object[],
 *   serverFollowups: object[],
 *   engineRollDisplayOnly: object[],
 *   unsupported: object[]
 * }}
 */
export function partitionV2BannerChipMutations(mutations) {
  const localMutations = [];
  const serverFollowups = [];
  const engineRollDisplayOnly = [];
  const unsupported = [];
  const normalized = normalizeV2BannerChipMutations(mutations || []);

  for (const m of normalized) {
    if (!m?.type) continue;
    const { type, payload } = m;
    if (V2_ENGINE_ROLL_DISPLAY_MUTATION_TYPES.has(type)) {
      engineRollDisplayOnly.push(m);
      continue;
    }
    if (type === 'rerollDie') {
      const dt = payload?.dieType;
      if (dt === 'hopeDie') {
        serverFollowups.push({ kind: 'rerollDie', dieType: 'Hope', mutation: m });
        continue;
      }
      if (dt === 'fearDie') {
        serverFollowups.push({ kind: 'rerollDie', dieType: 'Fear', mutation: m });
        continue;
      }
      if (dt === 'dualityDie') {
        serverFollowups.push({ kind: 'rerollDie', dieType: 'Duality', mutation: m });
        continue;
      }
      unsupported.push(m);
      continue;
    }
    if (type === 'addDamageRoll') {
      serverFollowups.push({ kind: 'addDamage', payload, mutation: m });
      continue;
    }
    localMutations.push(m);
  }
  return { localMutations, serverFollowups, engineRollDisplayOnly, unsupported };
}

function mergeElementUpdatesByInstance(listA, listB) {
  const m = new Map();
  for (const { instanceId, updates } of [...listA, ...listB]) {
    if (!instanceId || !updates) continue;
    m.set(instanceId, { ...(m.get(instanceId) || {}), ...updates });
  }
  return [...m.entries()].map(([instanceId, updates]) => ({ instanceId, updates }));
}

function applyV2ConditionMutations(activeElements, mutations) {
  let working = activeElements.map((e) => ({ ...e }));
  const idx = Object.fromEntries(working.map((e, i) => [e.instanceId, i]));
  for (const m of mutations) {
    if (m.type === 'removeCondition') {
      const i = idx[m.payload.instanceId];
      if (i == null) continue;
      const el = working[i];
      working[i] = {
        ...el,
        conditions: [...(el.conditions || [])].filter((c) => c !== m.payload.condition),
      };
    } else if (m.type === 'addCondition') {
      const i = idx[m.payload.instanceId];
      if (i == null) continue;
      const el = working[i];
      const c = [...(el.conditions || [])];
      if (!c.includes(m.payload.condition)) c.push(m.payload.condition);
      working[i] = { ...el, conditions: c };
    }
  }
  return working;
}

function diffElements(from, to) {
  const updates = [];
  for (const el of to) {
    const orig = from.find((e) => e.instanceId === el.instanceId);
    if (!orig) continue;
    const partial = {};
    for (const k of Object.keys(el)) {
      if (el[k] !== orig[k]) partial[k] = el[k];
    }
    if (Object.keys(partial).length > 0) {
      updates.push({ instanceId: el.instanceId, updates: partial });
    }
  }
  return updates;
}

/**
 * Apply V2 engine mutations from token-move hooks (`dispatchTokenMoveHooks`) and cross-sheet
 * chip activation: conditions, `actionLoop` notifications, and banner-shaped rows.
 *
 * @param {object[]} activeElements
 * @param {object[]} mutations
 * @param {string|undefined} setFeatureStateOwnerId — `chip._ownerInstanceId` for `setFeatureState` rows (e.g. Bard for Rally); omit when none
 * @returns {{ updates: { instanceId: string, updates: object }[], actionLoopNotifications: object[], skipped: object[] }}
 */
export function applyV2LifecycleMutations(activeElements, mutations, setFeatureStateOwnerId) {
  const actionLoopNotifications = [];
  const conditionMuts = [];
  const bannerMuts = [];
  for (const m of mutations || []) {
    if (!m?.type) continue;
    if (m.type === 'actionLoop') {
      actionLoopNotifications.push(m.payload);
    } else if (m.type === 'removeCondition' || m.type === 'addCondition') {
      conditionMuts.push(m);
    } else {
      bannerMuts.push(m);
    }
  }

  const afterConditions = applyV2ConditionMutations(activeElements, conditionMuts);
  const conditionUpdates = diffElements(activeElements, afterConditions);

  const { updates: bannerUpdates, skipped } = applyV2BannerMutations(
    afterConditions,
    bannerMuts,
    setFeatureStateOwnerId
  );

  const updates = mergeElementUpdatesByInstance(conditionUpdates, bannerUpdates);
  return { updates, actionLoopNotifications, skipped };
}

