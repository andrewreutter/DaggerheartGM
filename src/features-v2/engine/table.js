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
 *   _previousPositions: object,    // { [instanceId]: { tokenX, tokenY } } — position before last move
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
// Range band ordering
// ---------------------------------------------------------------------------

/**
 * Canonical ordering of Daggerheart range bands from closest to furthest.
 * Used by isRangeWithin() to compare range band strings.
 */
export const RANGE_BAND_ORDER = ['melee', 'veryClose', 'close', 'far', 'veryFar'];

/**
 * Return true when `range` is at most `maxRange` in the Daggerheart range
 * band ordering (melee < veryClose < close < far < veryFar).
 *
 * Case-insensitive: accepts 'Melee', 'melee', 'MELEE', etc.
 * Returns false when either argument is null/undefined or not a recognized band.
 *
 * @param {string|null} range     — the actual range band (e.g. from actor.rangeFrom())
 * @param {string|null} maxRange  — the maximum allowed range band
 * @returns {boolean}
 */
export function isRangeWithin(range, maxRange) {
  if (!range || !maxRange) return false;
  const r = range.toLowerCase();
  const m = maxRange.toLowerCase();
  const ri = RANGE_BAND_ORDER.indexOf(r);
  const mi = RANGE_BAND_ORDER.indexOf(m);
  if (ri === -1 || mi === -1) return false;
  return ri <= mi;
}

// ---------------------------------------------------------------------------
// Die rolling
// ---------------------------------------------------------------------------

/**
 * Parse a die notation string (e.g. 'd6', '2d8') into { count, sides }.
 * Throws if the notation is invalid.
 */
function parseDieNotation(notation) {
  const m = /^(\d+)?d(\d+)$/i.exec(String(notation).trim());
  if (!m) throw new Error(`Invalid die notation: "${notation}"`);
  return { count: m[1] ? parseInt(m[1], 10) : 1, sides: parseInt(m[2], 10) };
}

// ---------------------------------------------------------------------------
// Range helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Euclidean distance (in feet) to a Daggerheart range band name.
 */
function calcRangeBand(dist) {
  if (dist <= 5) return 'melee';
  if (dist <= 10) return 'veryClose';
  if (dist <= 30) return 'close';
  if (dist <= 100) return 'far';
  return 'veryFar';
}

/**
 * Compute range band between two (x, y) coordinate pairs.
 * Returns null if either pair contains a null coordinate.
 */
function rangeBetween(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const dx = x1 - x2;
  const dy = y1 - y2;
  return calcRangeBand(Math.sqrt(dx * dx + dy * dy));
}

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
// Weapon view builder
// ---------------------------------------------------------------------------

/**
 * Build a read-only weapon object from raw weapon data.
 * Applies range overrides when provided (e.g. from Reach's `rangeOverrides`).
 *
 * @param {object} w              — raw weapon object (SRD or virtual)
 * @param {object} [rangeOverrides] — { [sourceRange]: targetRange } map
 */
function buildWeaponView(w, rangeOverrides) {
  if (!w) return null;
  const baseRange = w.range ?? null;
  const featureNames = (Array.isArray(w.feature) ? w.feature : w.feature ? [w.feature] : [])
    .map((f) => (typeof f === 'string' ? f : f.name)).filter(Boolean);
  return {
    id: w.id ?? null,
    name: w.name ?? 'Unknown Weapon',
    tier: parseInt(w.tier) || 1,
    range: (rangeOverrides && baseRange && rangeOverrides[baseRange]) ?? baseRange,
    trait: w.trait ?? null,
    damage: w.damage ?? null,
    features: featureNames,
  };
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

    // Traits (character trait scores: agility, strength, finesse, instinct, presence, knowledge)
    traits: element.traits || {},

    // Proficiency (base 1; increases with advancement picks)
    proficiency: element.proficiency ?? 1,

    // Character level (1–10 in SRD; distinct from proficiency)
    level: element.level ?? 1,

    // Experiences
    experiences: element.experiences || [],

    // Position (for range calculations)
    tokenX: element.tokenX ?? null,
    tokenY: element.tokenY ?? null,

    // Conditions
    conditions: element.conditions || [],
    hasCondition(name) {
      return (element.conditions || []).includes(name);
    },

    // Weapons — read from element; range overrides (from Reach etc.) applied via element._rangeOverrides
    get primaryWeapon() {
      const w = element.primaryWeapon ?? element.weapons?.[0] ?? null;
      return buildWeaponView(w, element._rangeOverrides);
    },
    get secondaryWeapon() {
      const w = element.secondaryWeapon ?? element.weapons?.[1] ?? null;
      return buildWeaponView(w, element._rangeOverrides);
    },
    get weapons() {
      const all = element.weapons
        ? [...element.weapons]
        : [element.primaryWeapon, element.secondaryWeapon].filter(Boolean);
      // Append pre-computed virtual weapons (set by the rendering pipeline)
      for (const vw of element.virtualWeapons ?? []) {
        if (!all.some((w) => w.id != null && w.id === vw.id)) all.push(vw);
      }
      return all.map((w) => buildWeaponView(w, element._rangeOverrides));
    },

    get rangeFromTarget() {
      const targets = gameState.action?.targetInstanceIds || [];
      if (!targets.length) return null;
      const targetEl = gameState.activeElements?.find(
        (e) => (e.instanceId || e.id) === targets[0]
      );
      if (!targetEl) return null;
      return rangeBetween(element.tokenX, element.tokenY, targetEl.tokenX, targetEl.tokenY);
    },

    rangeFrom(otherActor) {
      return rangeBetween(element.tokenX, element.tokenY, otherActor?.tokenX, otherActor?.tokenY);
    },

    /**
     * The actor's position immediately before their most recent `move`.
     * Returns null when no prior position is recorded (actor has not moved,
     * or token positions are unknown). Exposes the same range interface as Actor:
     *   lastPosition.rangeFrom(otherActor) → string | null
     *   lastPosition.rangeFromTarget       → string | null
     */
    get lastPosition() {
      const prev = gameState._previousPositions?.[instanceId];
      if (!prev || prev.tokenX == null) return null;
      return {
        get rangeFromTarget() {
          const targets = gameState.action?.targetInstanceIds || [];
          if (!targets.length) return null;
          const targetEl = gameState.activeElements?.find(
            (e) => (e.instanceId || e.id) === targets[0]
          );
          if (!targetEl) return null;
          return rangeBetween(prev.tokenX, prev.tokenY, targetEl.tokenX, targetEl.tokenY);
        },
        rangeFrom(otherActor) {
          return rangeBetween(prev.tokenX, prev.tokenY, otherActor?.tokenX, otherActor?.tokenY);
        },
      };
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
    addExperienceBonus(experienceId, amount = 1) {
      addMutation(mutations, 'addExperienceBonus', { instanceId, experienceId, amount });
    },
    actionLoop(title, description, opts = {}) {
      const { trait, difficulty } = opts;
      addMutation(mutations, 'actionLoop', { instanceId, title, description, trait, difficulty });
    },

    // Movement: request a conditional repositioning on the battle map.
    // conditionFn(table) => boolean: must return true for the new position to be valid.
    // The engine defers the actual token move to the UI; this queues the request.
    move(conditionFn, description) {
      addMutation(mutations, 'move', { instanceId, conditionFn, description });
    },

    // Movement restriction: prevent this actor's token from being manually moved.
    // reason (optional string) is shown to the player when they try to drag the token.
    // Call allowMovement() to lift the restriction (e.g. when a toggle turns off).
    restrictMovement(reason) {
      addMutation(mutations, 'restrictMovement', { instanceId, reason: reason ?? null });
    },
    allowMovement() {
      addMutation(mutations, 'allowMovement', { instanceId });
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
    get advantageDice() {
      return this.dice.filter((d) => d._advantage);
    },
    get disadvantageDice() {
      return this.dice.filter((d) => d._disadvantage);
    },
    statics: rollData.statics ? [...rollData.statics] : [],
    ...(rollKey === 'action' && {
      hopeDie: rollData.hopeDie
        ? {
            value: rollData.hopeDie.value,
            reroll() {
              addMutation(mutations, 'rerollDie', { rollKey, dieType: 'hopeDie' });
            },
            setDie(die) {
              addMutation(mutations, 'setDie', { rollKey, dieType: 'hopeDie', die });
            },
          }
        : null,
      fearDie: rollData.fearDie
        ? {
            value: rollData.fearDie.value,
            reroll() {
              addMutation(mutations, 'rerollDie', { rollKey, dieType: 'fearDie' });
            },
            setDie(die) {
              addMutation(mutations, 'setDie', { rollKey, dieType: 'fearDie', die });
            },
          }
        : null,
      isSuccess: rollData.isSuccess ?? null,
      isCritical: rollData.isCritical ?? null,
      setOutcome(outcome) {
        addMutation(mutations, 'setRollOutcome', { rollKey, outcome });
      },
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
    addDisadvantageDie(name) {
      addMutation(mutations, 'addDisadvantageDie', { rollKey, name });
      this.dice.push({ name, die: 'd6', _disadvantage: true });
    },
    removeAdvantageDie(name) {
      addMutation(mutations, 'removeAdvantageDie', { rollKey, name });
      this.dice = this.dice.filter((d) => !(d.name === name && d._advantage));
    },
    removeDisadvantageDie(name) {
      addMutation(mutations, 'removeDisadvantageDie', { rollKey, name });
      this.dice = this.dice.filter((d) => !(d.name === name && d._disadvantage));
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
  const rng = gameState._rng ?? Math.random.bind(Math);

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

    /**
     * Roll one or more dice synchronously and return the total.
     *
     * @param {string} notation  — e.g. 'd6', '2d8', '1d20'
     * @returns {number}         — sum of all rolled faces
     *
     * A `rollDie` mutation is queued for logging/auditing.
     * The RNG can be overridden in tests via `gameState._rng`.
     */
    rollDie(notation) {
      const { count, sides } = parseDieNotation(notation);
      const results = [];
      let total = 0;
      for (let i = 0; i < count; i++) {
        const face = Math.floor(rng() * sides) + 1;
        results.push(face);
        total += face;
      }
      addMutation(store, 'rollDie', { notation, results, total });
      return total;
    },

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
