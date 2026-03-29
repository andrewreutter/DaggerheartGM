/**
 * V2 Feature Engine — Conditional Wrapper System
 *
 * `when(condition1, condition2, ..., value)` wraps any feature property in one
 * or more predicate functions. The engine unwraps the value only when ALL
 * predicates return truthy for the current table snapshot.
 *
 * **Predicate implications (avoid redundant `when()` guards):**
 *
 * - **`youSucceedOnAnAttack`** — Prefer when the SRD says **“successful attack”** (or equivalent) and the
 *   effect does **not** depend on **Minor / Major / Severe** tier. It only checks attack success
 *   (`action.type === 'attack'`, `rolls.action.isSuccess`, you are `table.action.actor`).
 * - **`youDealMinorDamage` / `youDealMajorDamage` / `youDealSevereDamage`** each include
 *   **`youAreTheActor`**. Prefer these when the rider cares about **outgoing threshold tier** after
 *   resolution. In the normal Game Table flow, pending `{ stat: 'currentHP' }` on the primary target
 *   at **`reviewOutcome`** is hydrated after the hit, so these predicates **subsume**
 *   **`youSucceedOnAnAttack`** for **tier-shaped** on-hit effects — do not stack both unless you have
 *   an unusual case (e.g. synthetic effects without a successful attack roll).
 * - **`youDeal*`** does **not** check `table.action.type === 'attack'`. Add an explicit
 *   `(table) => table.action?.type === 'attack'` predicate if the SRD must exclude non-attack
 *   damage sources that could still produce `currentHP` effects.
 * - **`youSucceedOnAnAttack`** also implies **`youAreTheActor`** for attacks; it does **not** imply **`isActing`**
 *   by name, but for the feature owner **`isActing`** and **`youAreTheActor`** coincide when you are the
 *   current actor.
 * - **`anAttackSucceeds`** is from the defender’s perspective (any successful attack); pair with
 *   **`againstYou`** / **`isTargeted`**, not with **`youDeal*`**.
 * - **`youTakeMinorDamage` / `youTakeMajorDamage` / `youTakeSevereDamage`** are for **incoming** HP
 *   loss: any pending `{ stat: 'currentHP' }` whose target is **`table.me`**. They do **not** assert
 *   **`isTargeted`** — compose **`when(isTargeted, youTakeSevereDamage, …)`** when the SRD means a hit
 *   against you. They do **not** imply **`youAreTheActor`** (you are usually the defender).
 */

const WHEN_BRAND = Symbol('when');

/**
 * Wrap any value in a conditional guard. All predicate arguments preceding the
 * final value must return truthy when called with the table snapshot.
 *
 * @param {...Function|*} args  One or more predicates followed by the wrapped value.
 * @returns {object} An opaque "when-wrapper" object.
 */
export function when(...args) {
  if (args.length < 2) {
    throw new Error('when() requires at least one predicate and a value');
  }
  const value = args[args.length - 1];
  const predicates = args.slice(0, -1);

  return {
    [WHEN_BRAND]: true,
    _predicates: predicates,
    _value: value,
  };
}

/**
 * Built-in predicate: true when the feature's owner is the one currently
 * acting in the Action Loop.
 */
export function isActing(table) {
  return table.me?.isActing === true;
}

/**
 * True when the current action is a **Spellcast Roll** for the feature owner:
 * `action.type === 'spellcast'` and the action trait matches `table.me.spellcastTrait` (case-insensitive).
 *
 * The VTT bridge sets `action.type` to `spellcast` only when roll meta includes `_isSpellcastRoll: true`
 * (see `buildActionConfigFromRoll` in `v2-action-loop-bridge.js`). Plain trait rolls keep `type === 'trait'`
 * even when rolling the spellcast trait from the grid.
 */
export function makeASpellcastRoll(table) {
  if (table.action?.type !== 'spellcast') return false;
  const actorTrait = table.action?.trait;
  const sk = table.me?.spellcastTrait;
  if (!actorTrait || !sk) return false;
  return String(actorTrait).toLowerCase() === String(sk).toLowerCase();
}

/**
 * Predicate for use inside {@link when}: the feature owner is the current actor **and** this action
 * is their Spellcast Roll (`action.type === 'spellcast'`) with the spellcast trait die (matches
 * {@link makeASpellcastRoll}). Compose after feature-local toggles, e.g.
 * `when(naturalEnvOn, actingOnASpellcastRollForMe, { placements: ['intent'], ... })`.
 *
 * @param {object} table — {@link buildTableSnapshot} result
 * @returns {boolean}
 */
export function actingOnASpellcastRollForMe(table) {
  return isActing(table) && makeASpellcastRoll(table);
}

/**
 * Built-in predicate: true when the feature's owner is one of the current
 * action's targets.
 */
export function isTargeted(table) {
  return table.action?.targets?.some((t) => t === table.me) === true;
}

/**
 * Built-in predicate: same as {@link isTargeted} — the feature's owner is a target of the
 * current action. Use in `when(...)` to mirror SRD phrasing ("an attack succeeds against you").
 */
export function againstYou(table) {
  return isTargeted(table);
}

/**
 * True when the current action is an attack and its action roll has succeeded (resolve phase).
 * Pairs with {@link againstYou} for "when an attack succeeds against you" style hooks.
 */
export function anAttackSucceeds(table) {
  return table.action?.type === 'attack' && table.rolls?.action?.isSuccess === true;
}

/**
 * True when **you** (the feature owner) are the attacker and your attack roll succeeded.
 * Mirrors SRD phrasing: "when you succeed on an attack…". Prefer this when the rule does **not**
 * depend on Minor/Major/Severe tier; use **`youDeal*Damage`** predicates when it does — see module
 * docblock **Predicate implications**.
 */
export function youSucceedOnAnAttack(table) {
  if (table.action?.type !== 'attack') return false;
  if (table.rolls?.action?.isSuccess !== true) return false;
  const actor = table.action.actor;
  const me = table.me;
  if (!actor?.instanceId || !me?.instanceId) return false;
  return actor.instanceId === me.instanceId;
}

/**
 * True when **you** (the feature owner) are the attacker and your attack roll **failed** (resolve phase).
 * Mirrors SRD phrasing like "when you fail an attack…". Pairs with {@link youSucceedOnAnAttack}.
 */
export function youFailOnAnAttack(table) {
  if (table.action?.type !== 'attack') return false;
  if (table.rolls?.action?.isSuccess === true) return false;
  const actor = table.action.actor;
  const me = table.me;
  if (!actor?.instanceId || !me?.instanceId) return false;
  return actor.instanceId === me.instanceId;
}

// ---------------------------------------------------------------------------
// Map range: attacker ↔ target (via `actor.rangeFrom(target)`)
// ---------------------------------------------------------------------------

/**
 * Daggerheart range bands from closest to farthest — matches {@link calcRangeBand} in `table.js`.
 */
export const RANGE_BAND_ORDER = ['melee', 'veryClose', 'close', 'far', 'veryFar'];

/**
 * @param {string | null | undefined} band
 * @returns {number} Index in {@link RANGE_BAND_ORDER}, or `-1` if unknown.
 */
export function rangeBandIndex(band) {
  if (band == null || typeof band !== 'string') return -1;
  return RANGE_BAND_ORDER.indexOf(band);
}

/**
 * True when `attacker.rangeFrom(target)` resolves to exactly `band` (e.g. **In Very Close**).
 */
export function attackerAndTargetAreInRangeBand(attacker, target, band) {
  if (!attacker || !target) return false;
  const b = attacker.rangeFrom(target);
  if (!b) return false;
  return b === band;
}

/**
 * True when `attacker.rangeFrom(target)` is **at most** `band` — that band or any closer band
 * (**Within Close** includes Melee, Very Close, and Close).
 *
 * For **`onUse` on feature modules**, prefer **`attacker.isWithinRangeBandOf(target, band)`** on the
 * snapshot actor (`buildTableSnapshot`) instead of importing this helper.
 */
export function attackerAndTargetAreWithinRangeBand(attacker, target, band) {
  if (!attacker || !target) return false;
  const b = attacker.rangeFrom(target);
  if (!b) return false;
  const i = rangeBandIndex(b);
  const max = rangeBandIndex(band);
  if (i < 0 || max < 0) return false;
  return i <= max;
}

/**
 * Primary target vs attacker by **map positions** only (`attacker.rangeFrom(target)`).
 * When positions are unknown, returns false — features that need an off-map fallback (e.g. weapon
 * range from the bridge) should OR in a separate predicate locally.
 */
function makeAgainstTargetRangePredicate(band, within) {
  return function againstTargetRange(table) {
    const attacker = table.action?.actor;
    const target = table.action?.target;
    if (!attacker || !target) return false;
    return within
      ? attackerAndTargetAreWithinRangeBand(attacker, target, band)
      : attackerAndTargetAreInRangeBand(attacker, target, band);
  };
}

/** Primary target is exactly **Melee** map distance from the attacker. */
export const againstATargetInMeleeRange = makeAgainstTargetRangePredicate('melee', false);
/** Primary target is **within Melee** map distance (same as {@link againstATargetInMeleeRange} — nothing is closer than Melee). */
export const againstATargetWithinMeleeRange = makeAgainstTargetRangePredicate('melee', true);

export const againstATargetInVeryCloseRange = makeAgainstTargetRangePredicate('veryClose', false);
export const againstATargetWithinVeryCloseRange = makeAgainstTargetRangePredicate('veryClose', true);

export const againstATargetInCloseRange = makeAgainstTargetRangePredicate('close', false);
export const againstATargetWithinCloseRange = makeAgainstTargetRangePredicate('close', true);

export const againstATargetInFarRange = makeAgainstTargetRangePredicate('far', false);
export const againstATargetWithinFarRange = makeAgainstTargetRangePredicate('far', true);

export const againstATargetInVeryFarRange = makeAgainstTargetRangePredicate('veryFar', false);
/** Primary target is at any resolved map band (distance within the **Very Far** maximum). */
export const againstATargetWithinVeryFarRange = makeAgainstTargetRangePredicate('veryFar', true);

/**
 * Built-in predicate: true when the feature's owner has committed to mark an
 * Armor Slot for this action (banner / VTT). Uses `table.action.useArmorByTargetId`
 * and `useArmor` on pending `{ type: 'damage' }` effects — see Feature Authoring
 * Guide §C.3 (armor commitment).
 */
export function armorUseCommitted(table) {
  const id = table.me?.instanceId;
  if (!id) return false;
  if (table.action?.useArmorByTargetId?.[id] === true) return true;
  return (table.action?.effects ?? []).some(
    (e) =>
      e.type === 'damage' &&
      e.target?.instanceId === id &&
      (e.amount ?? 0) > 0 &&
      e.useArmor === true
  );
}

/**
 * Built-in predicate: true when there is a pending damage effect targeting
 * the feature's owner with a positive amount.
 */
export function hasDamage(table) {
  return table.action?.effects?.some(
    (e) =>
      e.type === 'damage' &&
      e.target?.instanceId === table.me?.instanceId &&
      e.amount > 0
  ) === true;
}

/**
 * Built-in predicate: true when there is a pending *physical* damage effect
 * targeting the feature's owner with a positive amount.
 */
export function hasPhysicalDamage(table) {
  return table.action?.effects?.some(
    (e) =>
      e.type === 'damage' &&
      e.target?.instanceId === table.me?.instanceId &&
      e.damageType === 'physical' &&
      e.amount > 0
  ) === true;
}

/**
 * Built-in predicate: true when there is pending *magic* damage targeting
 * the feature's owner with a positive amount.
 */
export function hasMagicDamage(table) {
  return table.action?.effects?.some(
    (e) =>
      e.type === 'damage' &&
      e.target?.instanceId === table.me?.instanceId &&
      e.damageType === 'magic' &&
      e.amount > 0
  ) === true;
}

// ---------------------------------------------------------------------------
// Outgoing HP loss: "you deal Minor / Major / Severe damage" (primary target)
// ---------------------------------------------------------------------------

function effectTargetInstanceId(e) {
  const t = e?.target;
  if (t == null) return null;
  if (typeof t === 'string') return t;
  return t.instanceId ?? t.id ?? null;
}

/**
 * First pending `{ stat: 'currentHP' }` effect on the action’s **primary** target (positive amount).
 * Matches VTT-hydrated `action.effects` (resolved threshold HP marks on the primary target).
 *
 * @param {object} table
 * @returns {object|null}
 */
export function pendingHpLossToPrimaryTargetEffect(table) {
  const tgt = table.action?.target;
  if (!tgt?.instanceId) return null;
  const tid = tgt.instanceId;
  for (const e of table.action?.effects ?? []) {
    if (e.stat !== 'currentHP') continue;
    if (effectTargetInstanceId(e) !== tid) continue;
    if (typeof e.amount === 'number' && e.amount > 0) return e;
  }
  return null;
}

/**
 * Severe pending HP marks: VTT may set `damageTier` / `thresholdTier`, or tests use `amount >= 3`
 * when tiers are absent (see {@link computeHpLoss} in client helpers).
 */
export function isSeverePendingHpLossEffect(e) {
  if (!e || e.stat !== 'currentHP' || !(e.amount > 0)) return false;
  const amt = e.amount;
  return (
    e.damageTier === 'severe' ||
    e.thresholdTier === 'severe' ||
    (e.damageTier == null && e.thresholdTier == null && amt >= 3)
  );
}

/** Major (2 HP) when tiers are absent; `damageTier`/`thresholdTier` **major** when set. */
export function isMajorPendingHpLossEffect(e) {
  if (!e || e.stat !== 'currentHP' || !(e.amount > 0)) return false;
  if (e.damageTier === 'severe' || e.thresholdTier === 'severe') return false;
  if (e.damageTier === 'major' || e.thresholdTier === 'major') return true;
  if (e.damageTier != null || e.thresholdTier != null) return false;
  return e.amount === 2;
}

/** Minor (1 HP) when tiers are absent; `damageTier`/`thresholdTier` **minor** when set. */
export function isMinorPendingHpLossEffect(e) {
  if (!e || e.stat !== 'currentHP' || !(e.amount > 0)) return false;
  if (e.damageTier === 'severe' || e.thresholdTier === 'severe') return false;
  if (e.damageTier === 'major' || e.thresholdTier === 'major') return false;
  if (e.damageTier === 'minor' || e.thresholdTier === 'minor') return true;
  if (e.damageTier != null || e.thresholdTier != null) return false;
  return e.amount === 1;
}

/**
 * True when the feature owner is the current action’s **actor** (the one taking the action).
 * Use with attack predicates when you need “you” without requiring `type === 'attack'`.
 */
export function youAreTheActor(table) {
  const actor = table.action?.actor;
  const me = table.me;
  if (!actor?.instanceId || !me?.instanceId) return false;
  return actor.instanceId === me.instanceId;
}

/**
 * You are the actor and the primary target has pending Severe-tier HP loss (≥3 marks, or tier tags).
 * Subsumes **`youSucceedOnAnAttack`** in the usual post-hit / `reviewOutcome` flow — see module
 * docblock **Predicate implications**.
 */
export function youDealSevereDamage(table) {
  if (!youAreTheActor(table)) return false;
  const e = pendingHpLossToPrimaryTargetEffect(table);
  return e != null && isSeverePendingHpLossEffect(e);
}

/**
 * You are the actor and the primary target has pending Major-tier HP loss (2 marks, or tier tags).
 * See **`youDealSevereDamage`** / module docblock **Predicate implications** (same redundancy rules).
 */
export function youDealMajorDamage(table) {
  if (!youAreTheActor(table)) return false;
  const e = pendingHpLossToPrimaryTargetEffect(table);
  return e != null && isMajorPendingHpLossEffect(e);
}

/**
 * You are the actor and the primary target has pending Minor-tier HP loss (1 mark, or tier tags).
 * See **`youDealSevereDamage`** / module docblock **Predicate implications** (same redundancy rules).
 */
export function youDealMinorDamage(table) {
  if (!youAreTheActor(table)) return false;
  const e = pendingHpLossToPrimaryTargetEffect(table);
  return e != null && isMinorPendingHpLossEffect(e);
}

// ---------------------------------------------------------------------------
// Incoming HP loss: "you take Minor / Major / Severe damage" (effects targeting table.me)
// ---------------------------------------------------------------------------

/**
 * True when `e` is a positive `{ stat: 'currentHP' }` effect on the feature owner.
 *
 * @param {object} e
 * @param {object} table
 */
export function effectTargetsMe(e, table) {
  const mid = table.me?.instanceId;
  if (!mid || !e || e.stat !== 'currentHP' || !(e.amount > 0)) return false;
  return effectTargetInstanceId(e) === mid;
}

function somePendingHpLossToMe(table, classify) {
  const mid = table.me?.instanceId;
  if (!mid) return false;
  return (table.action?.effects ?? []).some(
    (e) => effectTargetsMe(e, table) && classify(e)
  );
}

/** Pending incoming Severe-tier HP loss to you (any matching effect line). */
export function youTakeSevereDamage(table) {
  return somePendingHpLossToMe(table, isSeverePendingHpLossEffect);
}

/** Pending incoming Major-tier HP loss to you (any matching effect line). */
export function youTakeMajorDamage(table) {
  return somePendingHpLossToMe(table, isMajorPendingHpLossEffect);
}

/** Pending incoming Minor-tier HP loss to you (any matching effect line). */
export function youTakeMinorDamage(table) {
  return somePendingHpLossToMe(table, isMinorPendingHpLossEffect);
}

/**
 * True when `otherActor` is within **Far** range of the feature owner — i.e. any range band except
 * `veryFar` (distance ≤ 100'). Returns false when positions are unknown (`rangeFrom` is null).
 */
export function isWithinFarRangeOfMe(table, otherActor) {
  if (!table.me || !otherActor) return false;
  const b = table.me.rangeFrom(otherActor);
  if (!b) return false;
  return b !== 'veryFar';
}

/** True when the character has at least one Prayer Die remaining in the session pool. */
export function isPrayerDicePoolNonEmpty(table) {
  return (table.me?.prayerDice?.pool ?? []).length > 0;
}

/**
 * True when there is pending `{ type: 'damage' }` with positive `amount` targeting the feature owner
 * or another **character** ally within Far range (Seraph **Prayer Dice**).
 */
export function hasPrayerDiceAidableDamage(table) {
  const me = table.me;
  if (!me?.instanceId) return false;
  return (
    table.action?.effects?.some((e) => {
      if (e.type !== 'damage' || !(e.amount > 0)) return false;
      const tid = e.target?.instanceId;
      if (!tid) return false;
      if (tid === me.instanceId) return true;
      const other = table.characters.find((c) => c.instanceId === tid);
      if (!other) return false;
      return isWithinFarRangeOfMe(table, other);
    }) === true
  );
}

/**
 * True when there is an action or damage roll in progress and the feature owner may spend Prayer Dice
 * for the **actor** — themselves, or an ally PC within Far range.
 */
export function prayerDiceAidRollEligible(table) {
  if (!table.rolls?.action && !table.rolls?.damage) return false;
  const actor = table.action?.actor;
  if (!actor || !table.me) return false;
  if (actor.instanceId === table.me.instanceId) return true;
  if (actor.isCharacter && isWithinFarRangeOfMe(table, actor)) return true;
  return false;
}

/**
 * Test whether a value is a when-wrapper.
 */
export function isWhen(value) {
  return value !== null && typeof value === 'object' && value[WHEN_BRAND] === true;
}

/**
 * Resolve a potentially-wrapped value against the current table snapshot.
 * - If value is a when-wrapper: evaluate predicates; return the inner value if
 *   ALL pass, undefined otherwise.
 * - Otherwise: return value as-is.
 *
 * @param {*} value
 * @param {object} table  Current Game Table Snapshot.
 * @returns {*}
 */
export function unwrap(value, table) {
  if (!isWhen(value)) return value;

  for (const pred of value._predicates) {
    if (!pred(table)) return undefined;
  }

  return value._value;
}

/**
 * Unwrap only a leading chain of `when()` wrappers. Chip descriptors may embed plain
 * objects in `placements` (e.g. declarative shape anchors) — {@link unwrapAll} would
 * recurse into them and break reference identity.
 *
 * @param {*} value
 * @param {object} table
 * @returns {*}
 */
export function unwrapTopLevelWhenChain(value, table) {
  let node = value;
  while (isWhen(node)) {
    const r = unwrap(node, table);
    if (r === undefined || r === null) return undefined;
    node = r;
  }
  return node;
}

/**
 * Deeply unwrap an object, array, or primitive, resolving all when()-wrappers
 * found anywhere in the tree. Non-wrapper primitives are returned as-is.
 *
 * Rules:
 * - A when()-wrapper at the top level is resolved; if falsey → undefined.
 * - Array elements that resolve to undefined are filtered out.
 * - Object values that resolve to undefined are omitted from the result.
 * - Recurses into plain objects and arrays.
 *
 * @param {*} value
 * @param {object} table
 * @returns {*}
 */
export function unwrapAll(value, table) {
  // Top-level wrapper
  if (isWhen(value)) {
    const resolved = unwrap(value, table);
    if (resolved === undefined) return undefined;
    return unwrapAll(resolved, table);
  }

  // Array: recurse into elements, filter undefineds
  if (Array.isArray(value)) {
    return value
      .map((item) => unwrapAll(item, table))
      .filter((item) => item !== undefined);
  }

  // Plain object: recurse into values, omit undefined entries
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      const unwrapped = unwrapAll(value[key], table);
      if (unwrapped !== undefined) {
        result[key] = unwrapped;
      }
    }
    return result;
  }

  // Primitive or function — return as-is
  return value;
}
