/**
 * V2 Feature Engine — Conditional Wrapper System
 *
 * `when(condition1, condition2, ..., value)` wraps any feature property in one
 * or more predicate functions. The engine unwraps the value only when ALL
 * predicates return truthy for the current table snapshot.
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
 * Built-in predicate: true when the feature's owner is one of the current
 * action's targets.
 */
export function isTargeted(table) {
  return table.action?.targets?.some((t) => t === table.me) === true;
}

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
