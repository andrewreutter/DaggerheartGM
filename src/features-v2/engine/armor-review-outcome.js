/**
 * Shared helpers for armor-related `onReviewOutcome` hooks (Resilient armor,
 * Unyielding beastform, etc.) — mutate pending HP/damage effects and revoke
 * armor commitment when a slot is not consumed.
 */

/** Reduce the wearer's pending incoming HP loss by one threshold step. */
export function reduceIncomingHpByOneThreshold(table) {
  const id = table.me?.instanceId;
  const hp = (table.action?.effects ?? []).find(
    (e) =>
      e.stat === 'currentHP' &&
      e.target?.instanceId === id &&
      e.amount > 0
  );
  if (hp) {
    hp.amount = Math.max(0, hp.amount - 1);
    return;
  }
  const dmg = (table.action?.effects ?? []).find(
    (e) =>
      e.type === 'damage' &&
      e.target?.instanceId === id &&
      (e.amount ?? 0) > 0
  );
  if (dmg) {
    dmg.amount = Math.max(0, dmg.amount - 1);
  }
}

/** Clear banner / VTT armor commitment so `markArmor` is not applied for this hit. */
export function revokeArmorCommitment(table) {
  const id = table.me?.instanceId;
  if (!id) return;
  const u = table.action?.useArmorByTargetId;
  if (u && Object.prototype.hasOwnProperty.call(u, id)) {
    u[id] = false;
  }
  for (const e of table.action?.effects ?? []) {
    if (e.type === 'damage' && e.target?.instanceId === id) {
      e.useArmor = false;
    }
  }
}
