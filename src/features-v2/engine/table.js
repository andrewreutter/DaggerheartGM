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
 *     appliedEffects: object[],    // after resolution (optional)
 *     useArmorByTargetId: object,  // { [targetInstanceId]: boolean } — VTT/banner: committed to spend armor on that target for this hit
 *     rollText: string,
 *     // In effects[], entries with type 'damage' may include useArmor: boolean (mirrors useArmorByTargetId for that target).
 *     // Reaction context (optional): when type === 'reaction', the VTT sets this so features know *why* the reaction fired.
 *     // leaveMelee — a foe is attempting to leave your Melee range (Attack of Opportunity, etc.).
 *     reactionContext: { kind: 'leaveMelee', moverInstanceId: string } | undefined,
 *     // Tag Team (co-op): initiator is `actorInstanceId`; partner is named explicitly for Hope-cost math.
 *     tagTeamPartnerInstanceId: string | undefined,
 *   },
 *   rolls: {
 *     action: object,              // { hopeDie, fearDie, gmDie, dice, statics, isSuccess, isCritical }; swapHopeFear() → swapHopeFearDice mutation
 *     damage: object,              // { dice, statics }
 *     other: object,               // dynamic extra rolls keyed by name
 *   },
 *   featureState: object,          // { [featureKey]: { [key]: value } }  persistent feature state
 *   _ownerInstanceId: string,      // set by engine before iterating: feature owner
 *   _mutationBatch: object[],      // optional; read-only description of the last applied mutation
 *                                   // batch (e.g. from dispatchStateChangeHooks). Exposed on the
 *                                   // snapshot as table.mutationBatch (empty array when absent).
 *   _tokenMove: { moverInstanceId: string },  // set only during dispatchTokenMoveHooks — which token
 *                                               // just moved (post-move positions on elements;
 *                                               // _previousPositions[moverId] = prior coords for lastPosition)
 *   registry: object,          // optional V2 registry (read-only); e.g. `registry.beastforms` for Druid picks
 *   _rollDbId: number|string|null, // optional; pending dice_rolls id so `move()` mutations bind to a banner
 * }
 */

import { SRD_CLASS_DRUID_SCOPE_KEY } from './feature-scope-keys.js';
import { normalizeConditionsToList } from '../../client/lib/conditions-utils.js';

const MUTATIONS_KEY = Symbol('mutations');

/** One SRD “handful” of gold in the character’s integer `gold` field (base‑9 inventory). */
export const GOLD_COINS_PER_HANDFUL = 9;

/** Core rules: each PC may initiate a Tag Team Roll this many times per session before features add extras. */
export const DEFAULT_TAG_TEAM_INITIATIONS_PER_SESSION = 1;

/** Core rules: Hope spent by the initiator to start a Tag Team Roll (before partner discounts like **Camaraderie**). */
export const DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST = 3;

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

/** Half-width of a standard 5×5' map token in feet (matches `map-range.js` / BattleMap). */
const TOKEN_HALF_FT = 2.5;

/**
 * Compute range band between two token **top-left** positions (feet).
 * Uses the same nearest-edge distance as `tokenDistanceFt` (`map-range.js`) so engine
 * `actor.rangeFrom(other)` matches BattleMap range highlights and VTT pending-move checks (e.g. Faun Kick).
 */
function rangeBetween(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const dx = x1 + TOKEN_HALF_FT - (x2 + TOKEN_HALF_FT);
  const dy = y1 + TOKEN_HALF_FT - (y2 + TOKEN_HALF_FT);
  const centerDist = Math.sqrt(dx * dx + dy * dy);
  const dist = Math.max(0, centerDist - TOKEN_HALF_FT);
  return calcRangeBand(dist);
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
 * @param {object} [weaponRenderHints] — { [weaponId]: { isDisabled?, disabledReason?, range? } } from `applyDeclarativeFeatures` (`range` overrides merged `rangeOverrides` for that weapon)
 */
function buildWeaponView(w, rangeOverrides, weaponRenderHints) {
  if (!w) return null;
  const baseRange = w.range ?? null;
  const featureNames = (Array.isArray(w.feature) ? w.feature : w.feature ? [w.feature] : [])
    .map((f) => (typeof f === 'string' ? f : f.name)).filter(Boolean);
  const id = w.id ?? null;
  const hint = id != null && weaponRenderHints ? weaponRenderHints[id] : undefined;
  let effectiveRange = baseRange;
  if (rangeOverrides && baseRange && rangeOverrides[baseRange]) {
    effectiveRange = rangeOverrides[baseRange];
  }
  if (hint?.range) {
    effectiveRange = hint.range;
  }
  const out = {
    id,
    name: w.name ?? 'Unknown Weapon',
    tier: parseInt(w.tier) || 1,
    /** Band from the weapon item before `rangeOverrides` (Reach, Spirit Weapon, etc.). */
    baseRange: baseRange,
    range: effectiveRange,
    trait: w.trait ?? null,
    damage: w.damage ?? null,
    features: featureNames,
  };
  if (hint && typeof hint === 'object') {
    if (typeof hint.isDisabled === 'boolean') out.isDisabled = hint.isDisabled;
    if (hint.disabledReason) out.disabledReason = hint.disabledReason;
  }
  return out;
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

    /** Total Armor Score from gear (distinct from current marked armor slots `armor`). */
    armorScore: element.armorScore ?? 0,

    /**
     * When true, this actor may pay Hope costs by marking armor slots instead (`spendHope` with
     * `{ armorInstead: true }`). Set during character rendering from declarative feature data
     * (`substituteArmorForHope` on features → merged onto the element); the engine does not
     * look up SRD feature names (see CONV-029).
     */
    substituteArmorForHope: element.substituteArmorForHope === true,

    /**
     * From weapon property **`onRender`** hooks (merge **`weaponRenderHints`** from `applyDeclarativeFeatures` onto the element).
     * The UI should disable weapon interactions when `primaryWeapon` / `weapons[]` show `isDisabled: true`.
     */
    get weaponRenderHints() {
      return element.weaponRenderHints && typeof element.weaponRenderHints === 'object'
        ? { ...element.weaponRenderHints }
        : {};
    },

    /**
     * When true, domain spell cards in loadout should not be cast (Druid **Beastform** — merged from
     * `applyDeclarativeFeatures` → `domainLoadoutDisabled`).
     */
    domainLoadoutDisabled: isChar ? element.domainLoadoutDisabled === true : false,

    /** Gold carried (coins); used by spendGold / Greedy et al. */
    gold: element.gold ?? 0,

    /**
     * Read-only copy of **`element.featureUsage`** (exhausted once/rest or once/session features).
     * Used by e.g. Splendor **Invigoration** to list refreshable features on you or an ally.
     */
    get featureUsage() {
      if (!isChar) return {};
      const fu = element.featureUsage;
      return fu && typeof fu === 'object' ? { ...fu } : {};
    },

    /**
     * True while this character has an active beastform (`element.activeBeastform`, Druid scoped
     * bag, or legacy `Beastform` / `Evolution` featureState keys).
     */
    get inBeastform() {
      if (!isChar) return false;
      const ab = element.activeBeastform;
      if (ab && typeof ab === 'object' && (ab.id || ab.beastformId)) return true;
      const efs = element.featureState;
      if (efs?.[SRD_CLASS_DRUID_SCOPE_KEY]?.activeBeastform?.beastformId) return true;
      if (efs?.Beastform?.activeBeastform?.beastformId || efs?.Evolution?.activeBeastform?.beastformId) {
        return true;
      }
      const fs = gameState.featureState;
      return !!(
        fs?.[SRD_CLASS_DRUID_SCOPE_KEY]?.activeBeastform?.beastformId ||
        fs?.Beastform?.activeBeastform?.beastformId ||
        fs?.Evolution?.activeBeastform?.beastformId
      );
    },

    /**
     * Display name of the beastform currently active (Druid), for UI labels.
     */
    get activeBeastformDisplayName() {
      if (!isChar) return null;
      const legacy = element.activeBeastform;
      if (legacy && typeof legacy === 'object' && legacy.name) return String(legacy.name);
      const id =
        element.featureState?.[SRD_CLASS_DRUID_SCOPE_KEY]?.activeBeastform?.beastformId ||
        element.featureState?.Beastform?.activeBeastform?.beastformId ||
        element.featureState?.Evolution?.activeBeastform?.beastformId ||
        gameState.featureState?.[SRD_CLASS_DRUID_SCOPE_KEY]?.activeBeastform?.beastformId ||
        gameState.featureState?.Beastform?.activeBeastform?.beastformId ||
        gameState.featureState?.Evolution?.activeBeastform?.beastformId ||
        (legacy && typeof legacy === 'object' ? legacy.beastformId || legacy.id : null);
      if (!id) return null;
      const beasts = gameState.registry?.beastforms;
      if (beasts && typeof beasts === 'object') {
        const row = beasts[id] ?? Object.values(beasts).find((o) => o && o.id === id);
        if (row?.name) return String(row.name);
      }
      return null;
    },

    // Character level (1–10 in SRD; distinct from proficiency)
    level: element.level ?? 1,

    /**
     * Character tier (1–4), used for Beastform eligibility and similar. Falls back from `level`
     * when `tier` is absent: L1 → T1, L2–4 → T2, L5–7 → T3, L8+ → T4.
     */
    tier:
      element.tier != null
        ? Number(element.tier) || 1
        : (() => {
            const lv = Number(element.level) || 1;
            if (lv >= 8) return 4;
            if (lv >= 5) return 3;
            if (lv >= 2) return 2;
            return 1;
          })(),

    /** SRD class id (e.g. `srd-cls-bard`) when present on the character element. */
    classId: isChar ? element.classId ?? null : null,

    /** SRD armor item id when equipped; `null` when unarmored (Valor **Bare Bones**, etc.). */
    armorId: isChar ? element.armorId ?? null : null,

    /** Pre-ability Major / Severe thresholds from the character element (damage tiers). */
    armorThresholdMajor: isChar ? element.armorThresholds?.major ?? null : null,
    armorThresholdSevere: isChar ? element.armorThresholds?.severe ?? null : null,

    /** SRD subclass id (e.g. `srd-sub-wordsmith`) when present on the character element. */
    subclassId: isChar ? element.subclassId ?? null : null,

    /**
     * Which trait key is this character's **Spellcast** trait for their subclass (e.g. `'presence'`).
     * Used with `traits[spellcastTrait]` for mechanics that roll or count Spellcast dice (e.g. Seraph **Prayer Dice**).
     */
    spellcastTrait: isChar ? element.spellcastTrait ?? null : null,

    /**
     * **Contacts Everywhere** session cap (merged from `applyDeclarativeFeatures`; **Reliable Backup** → 3).
     * Drives `frequencyMaxUses` on that feature’s card chip.
     */
    contactsEverywhereSessionUses: isChar ? Math.max(1, Math.floor(Number(element.contactsEverywhereSessionUses)) || 1) : 1,

    /**
     * When true, **Nightwalker** **Shadow Stepper** uses Very Far range (from **Fleeting Shadow** via `applyDeclarativeFeatures` / `mergeV2DeclarativeSheetOverlay`).
     */
    shadowStepperVeryFarUnlocked: isChar ? element.shadowStepperVeryFarUnlocked === true : false,

    // Experiences
    experiences: element.experiences || [],

    /**
     * **Runtime modifier tokens** (Phase 1 parity): `element.activeModifiers` is an array of
     * `{ id, name, dice?, value?, mode?, bonus?, trait?, type?, refreshOn? }` — the same shape the
     * Game Table persists ([`CHARACTER_RUNTIME_KEYS`](/src/client/lib/table-ops.js)). Use
     * `addActiveModifier` / `removeActiveModifier` to queue mutations; the host merges onto the element.
     */
    get activeModifiers() {
      if (!isChar) return [];
      const arr = element.activeModifiers;
      return Array.isArray(arr) ? arr.map((m) => (m && typeof m === 'object' ? { ...m } : m)) : [];
    },

    /**
     * Append one modifier token for this character (queues `appendActiveModifier`).
     * @param {object} mod — must include **`id`** and **`name`** (e.g. `{ id, name: 'Prayer Die', dice: 'd4', ... }`).
     */
    addActiveModifier(mod) {
      if (!isChar) return;
      if (!mod || typeof mod !== 'object' || mod.id == null || mod.name == null) {
        throw new Error('addActiveModifier requires a modifier object with id and name');
      }
      addMutation(mutations, 'appendActiveModifier', { instanceId, modifier: { ...mod } });
    },

    /**
     * Remove a modifier by **`id`** (queues `removeActiveModifier`).
     */
    removeActiveModifier(modifierId) {
      if (!isChar) return;
      if (modifierId == null || modifierId === '') return;
      addMutation(mutations, 'removeActiveModifier', { instanceId, id: String(modifierId) });
    },

    /**
     * **Seraph — Prayer Dice** (session pool of d4 face values). Host persists `element.prayerDice.pool`.
     */
    get prayerDice() {
      if (!isChar) return null;
      const p = element.prayerDice;
      const pool = p && typeof p === 'object' && Array.isArray(p.pool) ? [...p.pool] : [];
      return { pool };
    },

    /**
     * Replace the Prayer Dice pool (queues `setPrayerDicePool`). Call from `onSessionStart` after rolling.
     */
    setPrayerDicePool(pool) {
      if (!isChar) return;
      const arr = Array.isArray(pool) ? pool.map((x) => Math.round(Number(x)) || 0) : [];
      addMutation(mutations, 'setPrayerDicePool', { instanceId, pool: arr });
    },

    /**
     * Remove one die from the pool by index after spending (queues `removePrayerDieAt`).
     */
    removePrayerDieAt(index) {
      if (!isChar) return;
      addMutation(mutations, 'removePrayerDieAt', { instanceId, index: Math.floor(Number(index)) });
    },

    /** Clear the pool at session end (queues `setPrayerDicePool` with an empty array). */
    clearPrayerDicePool() {
      if (!isChar) return;
      addMutation(mutations, 'setPrayerDicePool', { instanceId, pool: [] });
    },

    /**
     * Extra Tag Team initiations per session from declarative features (e.g. **Camaraderie** +1).
     * Host merges from `applyDeclarativeFeatures` onto the character element.
     */
    extraTagTeamInitiationsPerSession: isChar
      ? Math.max(0, Math.floor(Number(element.extraTagTeamInitiationsPerSession) || 0))
      : 0,

    /**
     * When an **ally** initiates a Tag Team Roll **with you**, reduce their Hope cost by this amount
     * (e.g. Camaraderie `1` → ally pays 2 Hope instead of 3). Merged from declarative features.
     */
    tagTeamPartnerHopeDiscount: isChar
      ? Math.max(0, Math.floor(Number(element.tagTeamPartnerHopeDiscount) || 0))
      : 0,

    /**
     * Total Tag Team initiations available this session (core allowance + `extraTagTeamInitiationsPerSession`).
     */
    get tagTeamInitiationsBudget() {
      if (!isChar) return 0;
      return DEFAULT_TAG_TEAM_INITIATIONS_PER_SESSION + this.extraTagTeamInitiationsPerSession;
    },

    /**
     * Initiations already used this session. Host persists `tagTeamInitiationsUsedThisSession` on the element.
     */
    get tagTeamInitiationsUsedThisSession() {
      if (!isChar) return 0;
      return Math.max(0, Math.floor(Number(element.tagTeamInitiationsUsedThisSession) || 0));
    },

    get tagTeamInitiationsRemaining() {
      if (!isChar) return 0;
      return Math.max(0, this.tagTeamInitiationsBudget - this.tagTeamInitiationsUsedThisSession);
    },

    /**
     * Spend one initiation slot (queues `setTagTeamInitiationsUsed`). Throws when none remain.
     */
    consumeTagTeamInitiation() {
      if (!isChar) return;
      const next = this.tagTeamInitiationsUsedThisSession + 1;
      if (next > this.tagTeamInitiationsBudget) {
        throw new Error('No Tag Team initiations remaining this session');
      }
      addMutation(mutations, 'setTagTeamInitiationsUsed', { instanceId, value: next });
    },

    /**
     * Reset session counter (queues `setTagTeamInitiationsUsed` with 0). Call from session-start handling.
     */
    resetTagTeamInitiationsForSession() {
      if (!isChar) return;
      addMutation(mutations, 'setTagTeamInitiationsUsed', { instanceId, value: 0 });
    },

    /** Adversary Difficulty (reaction rolls vs this stat block). Characters use `evasion` for defense instead. */
    difficulty: element.difficulty ?? null,

    /**
     * Runtime modifier to base Difficulty (merged from **`runtimeStatMod`** mutations with `stat: 'difficulty'`).
     * **Adversaries only** — `null` on characters. Hosts persist `difficultyMod` on the element;
     * reaction rolls should compare against **`effectiveDifficulty`**, not raw `difficulty` alone.
     */
    difficultyMod: isAdversary ? element.difficultyMod ?? 0 : null,

    /**
     * **Adversaries only** — base `difficulty` + `difficultyMod`. Use for DC checks vs this stat block.
     * `null` on characters.
     */
    get effectiveDifficulty() {
      if (!isAdversary) return null;
      const b = element.difficulty != null ? Number(element.difficulty) : 0;
      const m = element.difficultyMod != null ? Number(element.difficultyMod) : 0;
      return b + m;
    },

    // Position (for range calculations)
    tokenX: element.tokenX ?? null,
    tokenY: element.tokenY ?? null,

    // Conditions (persisted as comma-separated text or legacy string[]; normalize for reads)
    get conditions() {
      return normalizeConditionsToList(element.conditions);
    },
    hasCondition(name) {
      return normalizeConditionsToList(element.conditions).includes(name);
    },

    /**
     * Instance id of this actor's **Focus** target (e.g. Ranger's Focus), if any.
     * Reads `element.focusTargetInstanceId` or legacy `element.focusTargetId`.
     */
    focusTargetInstanceId: element.focusTargetInstanceId ?? element.focusTargetId ?? null,

    /**
     * True when `otherActor` is this actor's current Focus target.
     */
    isFocusTarget(otherActor) {
      const fid = element.focusTargetInstanceId ?? element.focusTargetId ?? null;
      if (fid == null || !otherActor) return false;
      return otherActor.instanceId === fid;
    },

    /**
     * When true, the next weapon attack should spend 1 Hope for a Ranger's Focus attempt (table parity with v1
     * `rangerFocusOnNextAttack` on the character element).
     */
    rangerFocusOnNextAttack: element.rangerFocusOnNextAttack === true,

    /**
     * **Adversaries:** name of the character who currently has this creature as Ranger's Focus (v1 `focusedBy`).
     */
    focusedBy: element.focusedBy ?? null,

    // Weapons — read from element; range overrides (from Reach etc.) applied via element._rangeOverrides
    get primaryWeapon() {
      const w = element.primaryWeapon ?? element.weapons?.[0] ?? null;
      return buildWeaponView(w, element._rangeOverrides, element.weaponRenderHints);
    },
    get secondaryWeapon() {
      const w = element.secondaryWeapon ?? element.weapons?.[1] ?? null;
      return buildWeaponView(w, element._rangeOverrides, element.weaponRenderHints);
    },
    get weapons() {
      const all = element.weapons
        ? [...element.weapons]
        : [element.primaryWeapon, element.secondaryWeapon].filter(Boolean);
      // Append pre-computed virtual weapons (set by the rendering pipeline)
      for (const vw of element.virtualWeapons ?? []) {
        if (!all.some((w) => w.id != null && w.id === vw.id)) all.push(vw);
      }
      return all.map((w) => buildWeaponView(w, element._rangeOverrides, element.weaponRenderHints));
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
    /**
     * @param {number} amount
     * @param {{ armorInstead?: boolean, payWithArmorSlot?: boolean }} [opts] — When `armorInstead` or
     *   `payWithArmorSlot` is true, queues `markArmor` for the same slot count instead of spending Hope.
     *   Requires `element.substituteArmorForHope` (from declarative armor features) and enough armor slots.
     */
    spendHope(amount, opts = {}) {
      const n = Number(amount) || 0;
      if (n <= 0) return;
      const useArmor = opts?.armorInstead === true || opts?.payWithArmorSlot === true;
      if (useArmor) {
        if (element.substituteArmorForHope !== true) {
          throw new Error(
            'Armor-for-Hope substitution requires substituteArmorForHope on the element (merge from applyDeclarativeFeatures)'
          );
        }
        const avail = element.currentArmor ?? 0;
        if (avail < n) {
          throw new Error('Not enough available armor slots for Hope substitution');
        }
        addMutation(mutations, 'markArmor', { instanceId, amount: n });
        return;
      }
      addMutation(mutations, 'spendHope', { instanceId, amount: n });
    },
    spendGold(amount) {
      addMutation(mutations, 'spendGold', { instanceId, amount });
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

    /**
     * Clear a Phase-1 **`featureUsage`** entry so a once/session or once/rest feature can be used again.
     * Queues **`clearFeatureUsageKey`** — host removes that key from `element.featureUsage` on this character.
     *
     * @param {string} featureKey — same key as `featureUsage` on the element (typically the SRD feature `name`)
     */
    refreshExhaustedFeature(featureKey) {
      if (!isChar) return;
      const k = featureKey != null ? String(featureKey).trim() : '';
      if (!k) return;
      addMutation(mutations, 'clearFeatureUsageKey', { instanceId, featureKey: k });
    },

    /**
     * Queue a **runtime** additive change to a named stat on **this** actor (session / encounter modifiers).
     * Queues `runtimeStatMod` — the host merges `delta` into the right element field for `stat`.
     *
     * Supported `stat` keys:
     * - **`difficulty`** — adversaries only; host adds `delta` to `element.difficultyMod` (e.g. Bard **Make a Scene**).
     * Additional keys can be added later without new method names.
     *
     * @param {string} stat
     * @param {number} delta
     */
    applyStatMod(stat, delta) {
      const key = String(stat);
      const d = Number(delta);
      if (!Number.isFinite(d) || d === 0) return;
      if (key === 'difficulty') {
        if (!isAdversary) {
          throw new Error('applyStatMod("difficulty"): only adversaries have Difficulty');
        }
        addMutation(mutations, 'runtimeStatMod', { instanceId, stat: 'difficulty', delta: d });
        return;
      }
      throw new Error(`applyStatMod: unsupported stat "${key}"`);
    },

    /**
     * Set or clear this actor's Focus target (cross-action persistent state on the element).
     * Queues `setFocusTarget` — hosts should persist `focusTargetInstanceId` on the element
     * (and may mirror to legacy `focusTargetId` for table state).
     */
    setFocusTarget(targetInstanceId) {
      const v = targetInstanceId == null ? null : String(targetInstanceId);
      addMutation(mutations, 'setFocusTarget', { instanceId, focusTargetInstanceId: v });
    },

    /**
     * Arm or disarm the next weapon attack as a Ranger's Focus attempt (queues `setRangerFocusOnNextAttack`).
     */
    setRangerFocusOnNextAttack(value) {
      addMutation(mutations, 'setRangerFocusOnNextAttack', {
        instanceId,
        value: value === true,
      });
    },

    /**
     * **Adversaries:** set who has this creature as Focus (`focusedBy` string or null). Host applies to adversary elements.
     */
    setFocusedBy(nameOrNull) {
      const v = nameOrNull == null || nameOrNull === '' ? null : String(nameOrNull);
      addMutation(mutations, 'setFocusedBy', { instanceId, focusedBy: v });
    },

    actionLoop(title, description, opts = {}) {
      const { trait, difficulty } = opts;
      addMutation(mutations, 'actionLoop', { instanceId, title, description, trait, difficulty });
    },

    // Movement: request a conditional repositioning on the battle map.
    // conditionFn(table) => boolean: must return true for the new position to be valid.
    // desiredCondition — short human-readable statement of what the map must satisfy (tooltips / blocking copy).
    // description — optional longer guidance; omit by passing '' or using move(fn, desiredCondition, opts).
    // The engine defers the actual token move to the UI; this queues the request.
    // Optional `opts`: `freezeOtherInstanceId` + `freezeReason` — host locks that actor's token
    // (same as `restrictMovement`) until the pending map move banner is acked/cancelled.
    move(conditionFn, desiredCondition, descriptionOrOpts = '', maybeOpts) {
      let description = '';
      let opts = {};
      if (descriptionOrOpts != null && typeof descriptionOrOpts === 'object' && !Array.isArray(descriptionOrOpts)) {
        opts = descriptionOrOpts;
      } else {
        description = descriptionOrOpts != null ? String(descriptionOrOpts) : '';
        opts = maybeOpts && typeof maybeOpts === 'object' ? maybeOpts : {};
      }
      const dc = (desiredCondition != null ? String(desiredCondition) : '').trim();
      const desc = String(description).trim();
      const o = opts && typeof opts === 'object' ? opts : {};
      const fid = o.freezeOtherInstanceId;
      const rk = o.rehydrateKey;
      addMutation(mutations, 'move', {
        instanceId,
        conditionFn,
        desiredCondition: dc,
        description: desc,
        rollDbId: gameState._rollDbId ?? null,
        freezeOtherInstanceId:
          fid != null && fid !== '' ? String(fid) : null,
        freezeReason:
          o.freezeReason != null && String(o.freezeReason).trim() !== ''
            ? String(o.freezeReason).trim()
            : null,
        /** Persisted on `v2PendingMove` so the client can restore `conditionFn` after full reload. */
        rehydrateKey:
          rk != null && String(rk).trim() !== '' ? String(rk).trim() : null,
      });
    },

    // Movement restriction: prevent this actor's token from being manually moved.
    // reason (optional string) is shown to the player when they try to drag the token.
    // Call allowMovement(reason?) with the same string to lift one restriction.
    restrictMovement(reason) {
      addMutation(mutations, 'restrictMovement', { instanceId, reason: reason ?? null });
    },
    allowMovement(reason) {
      addMutation(mutations, 'allowMovement', {
        instanceId,
        reason: reason != null && reason !== '' ? String(reason) : null,
      });
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

    /**
     * Domain spell cards in the character's **loadout** (active). Read-only; use `moveDomainCardToVault`.
     * Each entry should include `id` and `level` (or `tier`) for mechanics that depend on card level.
     */
    get domainLoadout() {
      const raw = element.domainLoadout;
      return Array.isArray(raw) ? raw.map((c) => (c && typeof c === 'object' ? { ...c } : c)) : [];
    },

    /**
     * Domain spell cards in the **vault** (inactive). Read-only; host moves cards here with
     * `domainCardMoveToVault` mutations.
     */
    get domainVault() {
      const raw = element.domainVault;
      return Array.isArray(raw) ? raw.map((c) => (c && typeof c === 'object' ? { ...c } : c)) : [];
    },

    /**
     * Queue moving one domain card from loadout to vault by `id`. The VTT applies the structural
     * change to the character element's `domainLoadout` / `domainVault` arrays.
     */
    moveDomainCardToVault(cardId) {
      if (cardId == null || cardId === '') return;
      addMutation(mutations, 'domainCardMoveToVault', { instanceId, cardId: String(cardId) });
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
            get value() {
              return rollData.hopeDie.value;
            },
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
            get value() {
              return rollData.fearDie.value;
            },
            reroll() {
              addMutation(mutations, 'rerollDie', { rollKey, dieType: 'fearDie' });
            },
            setDie(die) {
              addMutation(mutations, 'setDie', { rollKey, dieType: 'fearDie', die });
            },
          }
        : null,
      /** GM / adversary attack roll die (d20 + trait vs Evasion — no Hope/Fear). */
      gmDie: rollData.gmDie
        ? {
            value: rollData.gmDie.value,
            reroll() {
              addMutation(mutations, 'rerollDie', { rollKey, dieType: 'gmDie' });
            },
            setDie(die) {
              addMutation(mutations, 'setDie', { rollKey, dieType: 'gmDie', die });
            },
          }
        : null,
      get isSuccess() {
        return rollData.isSuccess ?? null;
      },
      get isCritical() {
        return rollData.isCritical ?? null;
      },
      setOutcome(outcome) {
        addMutation(mutations, 'setRollOutcome', { rollKey, outcome });
      },
      /** Force hit/miss for the action roll (e.g. Bone **Bone-Touched**). Queues `setActionRollSuccess`. */
      setActionSuccess(success) {
        const b = success === true;
        addMutation(mutations, 'setActionRollSuccess', { rollKey, isSuccess: b });
        rollData.isSuccess = b;
      },
      /** Force critical / non-critical for the action roll (e.g. **Homet's Secret Potion**). Queues `setActionRollCritical`. */
      setActionCritical(critical) {
        const b = critical === true;
        addMutation(mutations, 'setActionRollCritical', { rollKey, isCritical: b });
        rollData.isCritical = b;
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

  if (rollKey === 'action') {
    /**
     * Swap Hope and Fear d12 **face values** after the roll (e.g. Vengeance **Nemesis**).
     * Queues `swapHopeFearDice` for the host/banner to persist; updates backing `rolls.action` so
     * subsequent reads in the same snapshot see swapped values.
     */
    obj.swapHopeFear = function swapHopeFear() {
      const h = rollData.hopeDie;
      const f = rollData.fearDie;
      if (!h || !f || h.value == null || f.value == null) return;
      addMutation(mutations, 'swapHopeFearDice', { rollKey });
      const tmp = h.value;
      h.value = f.value;
      f.value = tmp;
    };
  }

  if (rollKey === 'damage') {
    obj.rerollAllDice = function rerollAllDice() {
      for (const d of this.dice) {
        if (d?.name != null) {
          addMutation(mutations, 'rerollDie', { rollKey, dieType: 'damageDie', dieName: d.name });
        }
      }
    };
    /** Queue a reroll for each damage die whose face value is strictly less than `maxExclusive` (e.g. Proficiency). */
    obj.rerollDiceBelow = function rerollDiceBelow(maxExclusive) {
      const cap = Number(maxExclusive);
      if (!(cap > 0)) return;
      for (const d of this.dice) {
        if (d?.name != null && d.value != null && d.value < cap) {
          addMutation(mutations, 'rerollDie', { rollKey, dieType: 'damageDie', dieName: d.name });
        }
      }
    };
  }

  return obj;
}

// ---------------------------------------------------------------------------
// Feature-state store
// ---------------------------------------------------------------------------

function buildFeatureStore(featureKey, featureState, mutations) {
  if (!featureState) {
    return {
      get() {
        return undefined;
      },
      set() {},
    };
  }
  if (!featureState[featureKey]) {
    featureState[featureKey] = {};
  }
  const state = featureState[featureKey];

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

  const actor =
    actionData.actorInstanceId != null && actionData.actorInstanceId !== ''
      ? actorMap.get(String(actionData.actorInstanceId)) || null
      : null;
  const targets = (actionData.targetInstanceIds || [])
    .map((id) => actorMap.get(String(id)))
    .filter(Boolean);

  const type = actionData.type;

  // Types that use duality dice (hope + fear d12s)
  const DUALITY_TYPES = new Set(['action', 'trait', 'attack', 'spellcast', 'reaction', 'tagTeam']);
  // Types that generate Hope/Fear and can move the spotlight
  const HOPE_FEAR_TYPES = new Set(['action', 'trait', 'attack', 'spellcast', 'tagTeam']);
  // Types where the trait is locked in (cannot be mutated by features)
  const TRAIT_FINAL_TYPES = new Set(['trait', 'attack', 'spellcast', 'reaction', 'tagTeam']);

  const ctx = {
    type,
    actor,
    targets,
    /** Declared target instance IDs from `gameState.action` (length may exceed {@link #targets} if some IDs do not resolve). */
    targetInstanceIds: actionData.targetInstanceIds ? [...actionData.targetInstanceIds] : [],
    get target() {
      return targets[0] || null;
    },
    attacker: type === 'attack' ? actor : undefined,
    trait: actionData.trait,
    range: actionData.range,
    /** Which weapon the actor is using for this attack (primary vs secondary). */
    weaponId: actionData.weaponId ?? null,
    /** Domain spell / ability card id when casting (e.g. `srd-abl-healing-field`). Host sets on Spellcast rolls. */
    abilityId: actionData.abilityId ?? null,
    restType: actionData.restType,
    effects: actionData.effects || [],
    pendingEffects: actionData.effects || [],   // alias used during onReviewOutcome
    appliedEffects: actionData.appliedEffects || [], // populated after resolution
    /** Per-target armor commitment for this action (banner sync). Missing key = not committed. */
    useArmorByTargetId: actionData.useArmorByTargetId,

    /**
     * Why this reaction was triggered. Set by the VTT when the player declares
     * a reaction (e.g. `kind: 'leaveMelee'` when a foe leaves Melee).
     * `moverInstanceId` should match the adversary target (usually `targetInstanceIds[0]`).
     */
    reactionContext: actionData.reactionContext,

    // Tag Team (co-op): partner instance id for initiator Hope cost (see `tagTeamInitiatorHopeCost`)
    tagTeamPartnerInstanceId: actionData.tagTeamPartnerInstanceId ?? null,

    // ── Helper booleans ────────────────────────────────────────────────────
    /** True for any roll that uses duality (Hope + Fear) dice. */
    get isDualityRoll() { return DUALITY_TYPES.has(type); },
    /** True when the roll can generate Hope/Fear and move the spotlight. */
    get generatesHopeFear() { return HOPE_FEAR_TYPES.has(type); },
    /** True when this roll is a reaction (no Hope/Fear, no spotlight). */
    get isReaction() { return type === 'reaction'; },
    /** True when the reaction is an interrupt because a foe left Melee range. */
    get isLeaveMeleeReaction() {
      return type === 'reaction' && actionData.reactionContext?.kind === 'leaveMelee';
    },
    /** True when the trait die is locked; false for 'action' where the trait can still change. */
    get traitIsFinal() { return TRAIT_FINAL_TYPES.has(type); },

    /**
     * Hope the **initiator** pays to start a Tag Team Roll with `tagTeamPartnerInstanceId`.
     * Core cost is {@link DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST} (3); reduced when the partner has
     * `tagTeamPartnerHopeDiscount` on their element (e.g. **Camaraderie**).
     */
    get tagTeamInitiatorHopeCost() {
      if (type !== 'tagTeam') return DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST;
      const pid = actionData.tagTeamPartnerInstanceId;
      if (pid == null || pid === '') return DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST;
      const partner = actorMap.get(String(pid));
      if (!partner) return DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST;
      const disc = partner.tagTeamPartnerHopeDiscount ?? 0;
      return Math.max(0, DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST - disc);
    },

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

    /**
     * Reduce incoming **physical** damage by a number of HP steps (one threshold
     * step per point). Mutates pending `{ type: 'damage' }` effects in place.
     *
     * Only effects whose `target.instanceId` equals `gameState._ownerInstanceId`
     * are updated — use from hooks while `isTargeted` (the feature owner is the
     * damage recipient).
     */
    reduceIncomingPhysicalSeverityBySteps(steps = 1) {
      const n = Math.max(0, Math.floor(Number(steps)) || 0);
      if (n <= 0) return;
      const id = gameState._ownerInstanceId;
      if (!id) return;
      const list = actionData.effects || [];
      for (const e of list) {
        if (
          e.type === 'damage' &&
          e.target?.instanceId === id &&
          e.damageType === 'physical' &&
          typeof e.amount === 'number' &&
          e.amount > 0
        ) {
          e.amount = Math.max(0, e.amount - n);
        }
      }
    },

    /**
     * Mutates the first pending `{ type: 'damage' }` effect for `targetInstanceId`, subtracting
     * `amount` from its numeric `amount` (floored, clamped to ≥ 0). No-op if no matching effect.
     *
     * If `targetInstanceId` is not the feature owner (`gameState._ownerInstanceId`), the target must be
     * **within Far range** of the owner (any band except `veryFar` — i.e. distance ≤ 100').
     */
    reducePendingDamageForTarget(targetInstanceId, amount) {
      const n = Math.max(0, Math.floor(Number(amount)) || 0);
      if (n <= 0) return;
      const owner =
        gameState._ownerInstanceId != null && gameState._ownerInstanceId !== ''
          ? actorMap.get(String(gameState._ownerInstanceId))
          : null;
      if (!owner) return;
      const tid = targetInstanceId != null ? String(targetInstanceId) : '';
      if (!tid) return;
      const targetActor = actorMap.get(tid);
      if (!targetActor) return;
      if (tid !== owner.instanceId) {
        const band = owner.rangeFrom(targetActor);
        if (!band || band === 'veryFar') return;
      }
      const list = actionData.effects || [];
      for (const e of list) {
        if (
          e.type === 'damage' &&
          e.target?.instanceId === tid &&
          typeof e.amount === 'number' &&
          e.amount > 0
        ) {
          e.amount = Math.max(0, e.amount - n);
          break;
        }
      }
    },

    /**
     * **Grace-Touched:** Clears the feature owner’s pending `currentStress` loss for
     * this resolution and queues `markArmor` for the same number of slots. No-op if
     * there is no matching effect. Use from `reviewOutcome` only.
     */
    redeemSelfPendingStressWithArmorMarks() {
      const id = gameState._ownerInstanceId;
      if (!id) return;
      const list = actionData.effects || [];
      const stressEffect = list.find(
        (e) =>
          e.stat === 'currentStress' &&
          e.target?.instanceId === id &&
          e.amount > 0
      );
      if (!stressEffect) return;
      const n = stressEffect.amount;
      stressEffect.amount = 0;
      addMutation(mutations, 'markArmor', { instanceId: id, amount: n });
    },

    /**
     * **Grace-Touched:** Replaces pending `currentHP` loss on `targetInstanceId`
     * with the same amount of `currentStress` loss (reviewOutcome). No-op if no
     * pending HP loss on that target.
     */
    convertPendingHpLossToStressOnTarget(targetInstanceId) {
      const tid = targetInstanceId != null ? String(targetInstanceId) : '';
      if (!tid) return;
      const list = actionData.effects || [];
      const hpEffect = list.find(
        (e) => e.stat === 'currentHP' && e.target?.instanceId === tid && e.amount > 0
      );
      if (!hpEffect) return;
      const n = hpEffect.amount;
      hpEffect.amount = 0;
      const existing = list.find(
        (e) => e.stat === 'currentStress' && e.target?.instanceId === tid
      );
      if (existing) {
        existing.amount = (existing.amount ?? 0) + n;
      } else {
        list.push({
          stat: 'currentStress',
          target: hpEffect.target,
          amount: n,
        });
      }
    },
  };

  return ctx;
}

/**
 * Option row (class/subclass/ancestry/…) plus `get`/`set` for **shared** runtime state
 * keyed under `featureState[sourceScopeKey]` — same bag for every feature from that option.
 * Backed by `setFeatureState` mutations; does not mutate the registry object.
 *
 * @param {object|null} sourceObject — registry row (`_sourceObject`), or null
 * @param {string|null} sourceScopeKey — from registry `sourceScopeKey` or `activeFeature._sourceScopeKey`
 * @param {object} gameState
 * @param {object} store — mutation store
 */
function buildSourceFacade(sourceObject, sourceScopeKey, gameState, store) {
  if (!sourceScopeKey) return sourceObject;

  if (!gameState.featureState) gameState.featureState = {};

  const base =
    sourceObject && typeof sourceObject === 'object' ? { ...sourceObject } : {};

  return {
    ...base,
    get(key) {
      return gameState.featureState[sourceScopeKey]?.[key];
    },
    set(key, value) {
      if (!gameState.featureState[sourceScopeKey]) gameState.featureState[sourceScopeKey] = {};
      gameState.featureState[sourceScopeKey][key] = value;
      addMutation(store, 'setFeatureState', { featureKey: sourceScopeKey, key, value });
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * `actorMap` registers each element under both `instanceId` and library `id` when both are set.
 * Map.prototype.values() yields one entry per key, so the same actor can appear twice.
 */
function dedupeActorsByInstanceId(actorList) {
  const seen = new Set();
  const out = [];
  for (const a of actorList) {
    const id = a?.instanceId;
    if (id != null && id !== '') {
      const k = String(id);
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.push(a);
  }
  return out;
}

/**
 * Build the frozen Game Table Snapshot from raw game state.
 *
 * @param {object} gameState
 * @returns {object} table  — the snapshot object passed to all hooks.
 */
export function buildTableSnapshot(gameState = {}) {
  const store = { [MUTATIONS_KEY]: [] };
  const rng = gameState._rng ?? Math.random.bind(Math);

  // Build actor map keyed by instanceId / id. Callers may set `_ownerInstanceId` to the
  // table runtime id or the library character id; register both keys when present so
  // `table.me` resolves (avoids null `table.me` and `table.me.rangeFrom` crashes).
  const elements = gameState.activeElements || [];
  const actorMap = new Map();
  for (const el of elements) {
    const actor = buildActor(el, gameState, store);
    const inst = el.instanceId;
    const libId = el.id;
    const keys = new Set();
    if (inst != null && inst !== '') keys.add(String(inst));
    if (libId != null && libId !== '') keys.add(String(libId));
    for (const k of keys) actorMap.set(k, actor);
  }

  // Determine "me" — the feature owner (set by engine during iteration)
  const ownerKey =
    gameState._ownerInstanceId != null && gameState._ownerInstanceId !== ''
      ? String(gameState._ownerInstanceId)
      : null;
  const ownerActor = ownerKey ? actorMap.get(ownerKey) || null : null;

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

  const activeFeature = gameState._activeFeature ?? null;
  const sourceObject =
    gameState._sourceObject ?? activeFeature?._sourceObject ?? null;

  const sourceScopeKey =
    activeFeature?._sourceScopeKey ??
    (sourceObject && sourceObject.sourceScopeKey) ??
    null;

  /** One facade per snapshot so `onRender` can assign `table.source.isDisabled` and a later read sees it. */
  const sourceFacade = buildSourceFacade(sourceObject, sourceScopeKey, gameState, store);

  const registryRaw = gameState.registry;
  const registryFacade =
    registryRaw && typeof registryRaw === 'object' ? registryRaw : { beastforms: {} };

  const table = {
    /**
     * V2 registry (read-only reference). Host passes the same object used for `loadCharacterFeatures`
     * so features can read e.g. **`registry.beastforms`** without Druid-specific fields on elements.
     */
    registry: registryFacade,

    /** Feature object for the current hook/chip (set by action loop / tests). */
    get activeFeature() {
      return activeFeature;
    },

    /**
     * Source row (class, subclass, weapon, …) for the active feature when applicable.
     * When the registry option defines `sourceScopeKey` (or the feature sets `_sourceScopeKey`),
     * this object also has **`get(key)`** / **`set(key, value)`** for shared option-level state
     * (`featureState[sourceScopeKey]`), so subclass features can share one bag without
     * `queueInternalMutation(..., 'setFeatureState', { featureKey: ... })` boilerplate.
     */
    get source() {
      return sourceFacade;
    },

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

    // Board queries (dedupe: see dedupeActorsByInstanceId)
    actors: dedupeActorsByInstanceId([...actorMap.values()]),
    get characters() {
      return dedupeActorsByInstanceId([...actorMap.values()].filter((a) => a.isCharacter));
    },
    get adversaries() {
      return dedupeActorsByInstanceId([...actorMap.values()].filter((a) => a.isAdversary));
    },

    // Per-feature persistent state
    feature: featureStore,

    /**
     * Read-only view of `gameState.featureState` for merging into declarative
     * character rendering (`applyDeclarativeFeatures`). Same reference as the
     * live game state bag; do not mutate — use `table.feature.set` at runtime.
     */
    featureState: gameState.featureState ?? {},

    /**
     * Descriptors for the mutation batch being processed (e.g. `clearArmor`,
     * `markArmor`). Populated when `gameState._mutationBatch` is set — typically
     * by `dispatchStateChangeHooks`. Otherwise an empty array. Each entry matches
     * the shapes produced by Actor write methods / `applyMutations` (`type` + `payload`).
     */
    get mutationBatch() {
      const b = gameState._mutationBatch;
      return Array.isArray(b) ? [...b] : [];
    },

    /**
     * Set only while `hooks.onTokenMove` runs (`dispatchTokenMoveHooks`). **`table.me` is always the
     * feature owner** — use `tokenMove.mover` for the actor whose token moved.
     */
    get tokenMove() {
      const tm = gameState._tokenMove;
      if (!tm || typeof tm !== 'object' || !tm.moverInstanceId) return undefined;
      const mid = tm.moverInstanceId;
      return {
        moverInstanceId: mid,
        get mover() {
          return actorMap.get(String(mid)) || null;
        },
      };
    },

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
