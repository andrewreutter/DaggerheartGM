/**
 * V2 Feature Engine — Game Table Snapshot
 *
 * `buildTableSnapshot(gameState)` constructs the frozen `table` object that is
 * passed to every hook, chip.onUse, and when() predicate. Write methods queue
 * mutations into an internal list instead of mutating state directly; call
 * `applyMutations(table)` to retrieve the list.
 *
 * gameState shape (all optional):
 * {
 *   fear: number,
 *   mapConfig: object,
 *   activeElements: array,         // characters + adversaries on the table
 *   currentActorInstanceId: string,
 *   action: {
 *     type: string,                // 'action'|'trait'|'attack'|'spellcast'|'reaction'|'damage'|'free'|'shortRest'|'longRest'|'sessionStart'
 *     actorInstanceId: string,
 *     targetInstanceIds: string[],
 *     trait: string,
 *     range: string,
 *     effects: object[],           // mutable array shared between snapshot and caller
 *     rollText: string,
 *   },
 *   rolls: {
 *     action: object,              // { hopeDie, fearDie, dice, statics, isSuccess, isCritical }
 *     damage: object,              // { dice, statics }
 *     other: object,               // dynamic extra rolls keyed by name
 *   },
 *   featureState: object,          // { [featureKey]: { [key]: value } }  persistent feature state
 *   _ownerInstanceId: string,      // set by engine before iterating: feature owner
 * }
 */

const MUTATIONS_KEY = Symbol('mutations');

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

function makeMutation(type, payload) {
  return { type, payload, timestamp: Date.now() };
}

function addMutation(store, type, payload) {
  store[MUTATIONS_KEY].push(makeMutation(type, payload));
}

export function queueInternalMutation(table, type, payload) {
  addMutation(table._store, type, payload);
}

// ---------------------------------------------------------------------------
// Actor builder
// ---------------------------------------------------------------------------

function buildActor(element, gameState, mutations) {
  if (!element) return null;

  const instanceId = element.instanceId || element.id;
  const isChar = element.elementType === 'character';
  const isAdversary = !isChar;

  return {
    name: element.name || 'Unknown',
    instanceId,
    isCharacter: isChar,
    isAdversary,
    isActing: instanceId === (gameState.action?.actorInstanceId),

    // Resources
    currentHP: element.currentHp ?? element.currentHP ?? null,
    maxHP: element.maxHp ?? element.maxHP ?? null,
    currentStress: element.currentStress ?? null,
    maxStress: element.maxStress ?? null,
    hope: element.hope ?? null,
    maxHope: element.maxHope ?? null,
    armor: element.currentArmor ?? null,
    maxArmor: element.maxArmor ?? null,

    // Traits
    stats: element.traits || {},

    // Position (for range calculations)
    tokenX: element.tokenX ?? null,
    tokenY: element.tokenY ?? null,

    // Conditions
    conditions: element.conditions || [],
    hasCondition(name) {
      return (element.conditions || []).includes(name);
    },

    get rangeFromTarget() {
      const targets = gameState.action?.targetInstanceIds || [];
      if (!targets.length) return null;
      const targetEl = gameState.activeElements?.find(
        (e) => (e.instanceId || e.id) === targets[0]
      );
      if (!targetEl || element.tokenX == null || targetEl.tokenX == null) return null;
      const dx = element.tokenX - targetEl.tokenX;
      const dy = element.tokenY - targetEl.tokenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 5) return 'melee';
      if (dist <= 10) return 'veryClose';
      if (dist <= 30) return 'close';
      if (dist <= 100) return 'far';
      return 'veryFar';
    },

    rangeFrom(otherActor) {
      if (element.tokenX == null || otherActor?.tokenX == null) return null;
      const dx = element.tokenX - otherActor.tokenX;
      const dy = element.tokenY - otherActor.tokenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 5) return 'melee';
      if (dist <= 10) return 'veryClose';
      if (dist <= 30) return 'close';
      if (dist <= 100) return 'far';
      return 'veryFar';
    },

    // Write methods — queue mutations
    markStress(amount) {
      addMutation(mutations, 'markStress', { instanceId, amount });
    },
    clearStress(amount) {
      addMutation(mutations, 'clearStress', { instanceId, amount });
    },
    markHP(amount) {
      addMutation(mutations, 'markHP', { instanceId, amount });
    },
    clearHP(amount) {
      addMutation(mutations, 'clearHP', { instanceId, amount });
    },
    spendHope(amount) {
      addMutation(mutations, 'spendHope', { instanceId, amount });
    },
    gainHope(amount) {
      addMutation(mutations, 'gainHope', { instanceId, amount });
    },
    markArmor(amount) {
      addMutation(mutations, 'markArmor', { instanceId, amount });
    },
    clearArmor(amount) {
      addMutation(mutations, 'clearArmor', { instanceId, amount });
    },
    addCondition(conditionName) {
      addMutation(mutations, 'addCondition', { instanceId, condition: conditionName });
    },
    removeCondition(conditionName) {
      addMutation(mutations, 'removeCondition', { instanceId, condition: conditionName });
    },
    addRestAction() {
      addMutation(mutations, 'addRestAction', { instanceId });
    },
    actionLoop(title, description) {
      addMutation(mutations, 'actionLoop', { instanceId, title, description });
    },

    // Movement: request a conditional repositioning on the battle map.
    // conditionFn(table) => boolean: must return true for the new position to be valid.
    // The engine defers the actual token move to the UI; this queues the request.
    move(conditionFn, description) {
      addMutation(mutations, 'move', { instanceId, conditionFn, description });
    },

    // Inventory and loadout mutations
    inventory: {
      add(itemObject) {
        addMutation(mutations, 'inventoryAdd', { instanceId, item: itemObject });
      },
      remove(itemName) {
        addMutation(mutations, 'inventoryRemove', { instanceId, itemName });
      },
    },

    loadout: {
      swapCard(currentCardId, newCardId) {
        addMutation(mutations, 'loadoutSwapCard', { instanceId, currentCardId, newCardId });
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Roll builder
// ---------------------------------------------------------------------------

function buildRollObject(rollData, mutations, rollKey) {
  if (!rollData) return null;

  const obj = {
    dice: rollData.dice ? [...rollData.dice] : [],
    statics: rollData.statics ? [...rollData.statics] : [],
    ...(rollKey === 'action' && {
      hopeDie: rollData.hopeDie
        ? {
            value: rollData.hopeDie.value,
            reroll() {
              addMutation(mutations, 'rerollDie', { rollKey, dieType: 'hopeDie' });
            },
          }
        : null,
      fearDie: rollData.fearDie
        ? {
            value: rollData.fearDie.value,
            reroll() {
              addMutation(mutations, 'rerollDie', { rollKey, dieType: 'fearDie' });
            },
          }
        : null,
      isSuccess: rollData.isSuccess ?? null,
      isCritical: rollData.isCritical ?? null,
    }),

    addStatic({ name, value }) {
      addMutation(mutations, 'addRollStatic', { rollKey, name, value });
      this.statics.push({ name, value });
    },
    addDie({ name, die, value }) {
      addMutation(mutations, 'addRollDie', { rollKey, name, die, value });
      this.dice.push({ name, die, value });
    },
    addAdvantageDie(name) {
      addMutation(mutations, 'addAdvantageDie', { rollKey, name });
      this.dice.push({ name, die: 'd6', _advantage: true });
    },
    removeDie(name) {
      addMutation(mutations, 'removeRollDie', { rollKey, name });
      this.dice = this.dice.filter((d) => d.name !== name);
    },
  };

  return obj;
}

// ---------------------------------------------------------------------------
// Feature-state store
// ---------------------------------------------------------------------------

function buildFeatureStore(featureKey, featureState, mutations) {
  const state = featureState?.[featureKey] ?? {};

  return {
    get(key) {
      return state[key];
    },
    set(key, value) {
      state[key] = value;
      addMutation(mutations, 'setFeatureState', { featureKey, key, value });
    },
  };
}

// ---------------------------------------------------------------------------
// Action context builder
// ---------------------------------------------------------------------------

function buildActionContext(gameState, actorMap, mutations) {
  const actionData = gameState.action;
  if (!actionData) return undefined;

  const actor = actorMap.get(actionData.actorInstanceId) || null;
  const targets = (actionData.targetInstanceIds || [])
    .map((id) => actorMap.get(id))
    .filter(Boolean);

  const type = actionData.type;

  // Types that use duality dice (hope + fear d12s)
  const DUALITY_TYPES = new Set(['action', 'trait', 'attack', 'spellcast', 'reaction']);
  // Types that generate Hope/Fear and can move the spotlight
  const HOPE_FEAR_TYPES = new Set(['action', 'trait', 'attack', 'spellcast']);
  // Types where the trait is locked in (cannot be mutated by features)
  const TRAIT_FINAL_TYPES = new Set(['trait', 'attack', 'spellcast', 'reaction']);

  const ctx = {
    type,
    actor,
    targets,
    get target() {
      return targets[0] || null;
    },
    attacker: type === 'attack' ? actor : undefined,
    trait: actionData.trait,
    range: actionData.range,
    restType: actionData.restType,
    effects: actionData.effects || [],
    pendingEffects: actionData.effects || [],   // alias used during onReviewOutcome
    appliedEffects: actionData.appliedEffects || [], // populated after resolution

    // ── Helper booleans ────────────────────────────────────────────────────
    /** True for any roll that uses duality (Hope + Fear) dice. */
    get isDualityRoll() { return DUALITY_TYPES.has(type); },
    /** True when the roll can generate Hope/Fear and move the spotlight. */
    get generatesHopeFear() { return HOPE_FEAR_TYPES.has(type); },
    /** True when this roll is a reaction (no Hope/Fear, no spotlight). */
    get isReaction() { return type === 'reaction'; },
    /** True when the trait die is locked; false for 'action' where the trait can still change. */
    get traitIsFinal() { return TRAIT_FINAL_TYPES.has(type); },

    addNarration(text) {
      addMutation(mutations, 'addNarration', { text });
    },

    addDamageRoll({ name, dice, damageType, targets: rollTargets }) {
      addMutation(mutations, 'addDamageRoll', {
        name,
        dice,
        damageType: damageType || null,
        sourceInstanceId: gameState._ownerInstanceId,
        targetInstanceIds: (rollTargets || []).map((t) => t.instanceId),
      });
    },
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the frozen Game Table Snapshot from raw game state.
 *
 * @param {object} gameState
 * @returns {object} table  — the snapshot object passed to all hooks.
 */
export function buildTableSnapshot(gameState = {}) {
  const store = { [MUTATIONS_KEY]: [] };

  // Build actor map keyed by instanceId
  const elements = gameState.activeElements || [];
  const actorMap = new Map();
  for (const el of elements) {
    const id = el.instanceId || el.id;
    if (id) actorMap.set(id, buildActor(el, gameState, store));
  }

  // Determine "me" — the feature owner (set by engine during iteration)
  const ownerActor = actorMap.get(gameState._ownerInstanceId) || null;

  // Build roll objects
  const rollsRaw = gameState.rolls || {};
  const rolls = {
    action: buildRollObject(rollsRaw.action, store, 'action'),
    damage: buildRollObject(rollsRaw.damage, store, 'damage'),
    other: rollsRaw.other || {},
  };

  // Build action context
  const actionCtx = buildActionContext(gameState, actorMap, store);

  // Feature state store (keyed by feature name; set by engine before calling hooks)
  const featureKey = gameState._featureKey || '__unknown__';
  const featureStore = buildFeatureStore(featureKey, gameState.featureState, store);

  const table = {
    // Global state
    top: {
      fear: gameState.fear ?? 0,
      map: gameState.mapConfig || null,
      shortRest: gameState.shortRest || null,
      longRest: gameState.longRest || null,
      broadcast(message) {
        addMutation(store, 'broadcast', { message });
      },
      gainFear(amount) {
        addMutation(store, 'gainFear', { amount });
      },
      spendFear(amount) {
        addMutation(store, 'spendFear', { amount });
      },
    },

    // The feature owner (engine sets _ownerInstanceId before each feature)
    get me() {
      return ownerActor;
    },

    // Action context (undefined outside of an action loop)
    action: actionCtx,

    // Dice & rolls (undefined when no roll is in progress)
    rolls: (rollsRaw.action || rollsRaw.damage) ? rolls : undefined,

    // Board queries
    actors: [...actorMap.values()],
    get characters() {
      return [...actorMap.values()].filter((a) => a.isCharacter);
    },
    get adversaries() {
      return [...actorMap.values()].filter((a) => a.isAdversary);
    },

    // Per-feature persistent state
    feature: featureStore,

    // Internal access for the engine
    _store: store,
    _actorMap: actorMap,
  };

  return table;
}

/**
 * Return and clear the list of queued mutations from a table snapshot.
 *
 * @param {object} table  — produced by buildTableSnapshot()
 * @returns {object[]}    — array of mutation descriptors
 */
export function applyMutations(table) {
  const mutations = table._store[MUTATIONS_KEY];
  // Return a copy and clear
  const result = [...mutations];
  mutations.length = 0;
  return result;
}
