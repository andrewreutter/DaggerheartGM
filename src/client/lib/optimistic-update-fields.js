/**
 * Fields that are applied optimistically to `activeElements` before the server's authoritative
 * `table_state` SSE snapshot arrives. This keeps the UI responsive (no visual stutter) for
 * high-frequency interactions like HP/Stress clicks and token drags.
 *
 * The server snapshot confirms or corrects each value via `reconcileElementsById` on the next tick.
 * The set is intentionally broad enough to cover both character and adversary element update sites
 * in `GMTableView` — all of these fields are plain scalars or arrays that survive a shallow merge.
 */
export const OPTIMISTIC_ELEMENT_UPDATE_FIELDS = new Set([
  // Token positions
  'tokenX',
  'tokenY',
  'mapId',
  // Status text (controlled input — must not flicker)
  'conditions',
  // Character resource tracks (also used on adversaries for currentHp / currentStress)
  'currentHp',
  'currentStress',
  'hope',
  'currentArmor',
]);

/**
 * Returns `true` when an `updates` object passed to `sendUpdateActiveElement` /
 * `handlePlayerCharacterUpdate` contains at least one field that should be applied
 * optimistically to local `activeElements` state before the server round-trip completes.
 *
 * @param {object} updates - The partial element update being sent to the server.
 * @returns {boolean}
 */
export function shouldOptimisticallyPatch(updates) {
  for (const key of Object.keys(updates)) {
    if (OPTIMISTIC_ELEMENT_UPDATE_FIELDS.has(key)) return true;
  }
  return false;
}
