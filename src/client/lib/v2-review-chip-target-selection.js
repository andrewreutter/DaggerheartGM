/**
 * Pure helpers for V2 review chip target selection in DiceRoller (Hold Them Off vs primary-in-list chips).
 */

/**
 * @param {Array<{ instanceId?: string, id?: string }>} pickTargets
 * @param {{ needsTargets: boolean, primaryDamageTargetId?: string|null }} opts
 * @returns {string[]}
 */
export function getInitialV2ReviewTargetSelection(pickTargets, opts) {
  const { needsTargets, primaryDamageTargetId } = opts;
  if (!needsTargets) return [];
  const validIds = new Set(
    (pickTargets || []).map((t) => t.instanceId ?? t.id).filter(Boolean)
  );
  if (primaryDamageTargetId && validIds.has(primaryDamageTargetId)) {
    return [primaryDamageTargetId];
  }
  return [];
}

/**
 * True when the banner's primary damage target is one of this chip's selectable targets
 * (so we can seed empty selection when the user picks primary later).
 */
export function primaryDamageTargetIsInPickList(pickTargets, primaryDamageTargetId) {
  if (!primaryDamageTargetId) return false;
  const validIds = new Set(
    (pickTargets || []).map((t) => t.instanceId ?? t.id).filter(Boolean)
  );
  return validIds.has(primaryDamageTargetId);
}
