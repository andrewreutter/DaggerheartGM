/**
 * When the V2 pre-roll intent chip "Attempt Ranger's Focus" is selected, the posted roll must
 * include `_rangerFocusAttempt` so {@link GMTableView} can set adversary `focusedBy` on damage ack.
 * Hope is applied in the same pre-roll loop as chip.hopeCost — do not set `_hopeCost` on roll meta
 * or banner ack would deduct again.
 *
 * @param {{ pendingMeta: object, displayName: string, chip: object }} args
 * @returns {{ pendingMeta: object, displayName: string }}
 */
export function applyRangerFocusV2IntentToPending({ pendingMeta, displayName, chip }) {
  const meta = pendingMeta && typeof pendingMeta === 'object' ? pendingMeta : {};
  if (chip?._featureName !== "Ranger's Focus" || !chip.isToggle) {
    return { pendingMeta: meta, displayName };
  }
  const dn = displayName == null ? '' : String(displayName);
  const nextDisplay = /Ranger's Focus attempt/i.test(dn) ? displayName : `${dn.trim()} with Ranger's Focus attempt`;
  return {
    pendingMeta: { ...meta, _rangerFocusAttempt: true },
    displayName: nextDisplay,
  };
}
