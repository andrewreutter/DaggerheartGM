/**
 * Id-keyed reconciliation for `table_state` SSE snapshots (game-table-performance-pass Phase 2.8).
 *
 * Every `table_state` SSE event delivers a brand-new `elements` array (freshly deserialized JSON),
 * even when a given op only touched one adversary's `tokenX`/`tokenY` or one character's HP. Passing
 * that straight to `setActiveElements` gives every element in the array a new object identity on
 * every tick, which cascades through `useMemo`/dependency-array equality checks throughout
 * `GMTableView` (`tableCharacters`, `characterDisplayByInstanceId`, `v2ReviewChipsByRollDbId`,
 * damage-target lists, etc.) even for elements nothing changed about.
 *
 * `reconcileElementsById` merges a new snapshot against the previous one by `instanceId`: any
 * element that is deep-equal to its previous counterpart keeps the *previous* object reference. If
 * nothing in the array actually changed, the previous array reference itself is returned so
 * `setActiveElements` becomes a no-op re-render. This doesn't change the wire protocol — the server
 * still sends full snapshots — it just restores reference stability on the client so downstream
 * memoization (including reference-equality-based `useMemo` deps, not just the specialized
 * `PlacedToken`/`TrayToken` field comparators in `BattleMap.jsx`) actually pays off.
 */

/** Generic recursive deep-equal for plain JSON-shaped data (objects/arrays/primitives). */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;
  if (aIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * @param {Array<object>|null|undefined} prevElements Previous `activeElements` state.
 * @param {Array<object>|null|undefined} nextElements New `elements` array from a `table_state` snapshot.
 * @returns {Array<object>|null|undefined} `nextElements` with per-element identities preserved for
 *   any element that is deep-equal to its previous counterpart (matched by `instanceId`); returns
 *   `prevElements` itself when nothing changed at all.
 */
export function reconcileElementsById(prevElements, nextElements) {
  if (!Array.isArray(nextElements)) return nextElements;
  if (!Array.isArray(prevElements) || prevElements.length === 0) return nextElements;

  const prevById = new Map();
  for (const el of prevElements) {
    if (el && el.instanceId != null) prevById.set(el.instanceId, el);
  }

  const reconciled = nextElements.map((nextEl) => {
    if (!nextEl || nextEl.instanceId == null) return nextEl;
    const prevEl = prevById.get(nextEl.instanceId);
    if (!prevEl || prevEl === nextEl) return prevEl || nextEl;
    return deepEqual(prevEl, nextEl) ? prevEl : nextEl;
  });

  if (
    reconciled.length === prevElements.length &&
    reconciled.every((el, i) => el === prevElements[i])
  ) {
    return prevElements;
  }
  return reconciled;
}
