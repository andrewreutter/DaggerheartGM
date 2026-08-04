/**
 * Reference-based memoization with global-key invalidation (Fix 4 — client render costs).
 *
 * `computeWithRefCache` is a pure helper that computes a `Map<instanceId, result>` from an array
 * of elements, caching per-element results by the element's **object reference**. When an element's
 * reference is unchanged (guaranteed by `reconcileElementsById` for elements that didn't actually
 * change) and none of the "global" cross-cutting inputs changed, the previous computed value is
 * reused without calling `computeFn` again.
 *
 * This is used by `GMTableView`'s `characterDisplayByInstanceId` `useMemo`: even though
 * `tableCharacters` gets a new array identity on every `activeElements` change (because it is a
 * `.filter()` call), the individual character element objects inside it are stable references when
 * `reconcileElementsById` determined they didn't change — so an adversary-only op (HP mark, token
 * move, add/remove) causes zero `recomputeCharacter` calls for unchanged PCs.
 *
 * ### Cache contract
 * - `state` must be a plain mutable object (from `useRef().current`) that persists across renders.
 *   It is mutated in place on every call.
 * - `elements` is an iterable of objects, each with an `.instanceId` property.
 * - `globalDeps` is an array whose members are compared by `===` (reference equality). If any
 *   member differs from the previous call the **entire** cache is invalidated before recomputing,
 *   because global deps affect every element's result (e.g. `fearCount`, `srdData`).
 * - `computeFn(el)` is called for each element whose reference changed or whose cached entry was
 *   invalidated by a global-dep change.
 * - Stale entries for elements no longer in `elements` are automatically dropped (the `byRef` Map
 *   is rebuilt each call from only the current elements, so there is no unbounded memory growth).
 */

/**
 * @template T
 * @typedef {object} RefCacheState
 * @property {Array|null} globalDeps - Last seen global deps array (compared by reference per slot).
 * @property {Map<object, T>|null} byRef - Map from element reference → computed result.
 */

/**
 * Compute (or reuse from cache) a `Map<instanceId, result>` for the given elements.
 *
 * @template T
 * @param {RefCacheState<T>} state Mutable cache state (from `useRef().current`). Modified in place.
 * @param {Array<{instanceId: string|number}>} elements Current array of elements.
 * @param {Array<any>} globalDeps Cross-cutting inputs compared by reference; if any changed, all
 *   cached results are discarded and every element is recomputed.
 * @param {function({instanceId: string|number}): T} computeFn Per-element computation.
 * @returns {Map<string|number, T>} Map from `instanceId` to computed result.
 */
export function computeWithRefCache(state, elements, globalDeps, computeFn) {
  const globalChanged =
    !state.globalDeps ||
    state.globalDeps.length !== globalDeps.length ||
    globalDeps.some((dep, i) => dep !== state.globalDeps[i]);

  const prevByRef = globalChanged ? null : state.byRef;
  const nextByRef = new Map();
  const resultMap = new Map();

  for (const el of elements) {
    let result;
    if (!globalChanged && prevByRef !== null && prevByRef.has(el)) {
      result = prevByRef.get(el);
    } else {
      result = computeFn(el);
    }
    nextByRef.set(el, result);
    resultMap.set(el.instanceId, result);
  }

  state.globalDeps = globalDeps;
  state.byRef = nextByRef;

  return resultMap;
}
