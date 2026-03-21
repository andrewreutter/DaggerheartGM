import { when, isTargeted, armorUseCommitted } from '../engine/when.js';

/** True when the wearer has exactly one unmarked armor slot (this use would mark the last). */
function wouldMarkLastArmorSlot(table) {
  return (table.me?.armor ?? 0) === 1;
}

function reduceIncomingHpByOneThreshold(table) {
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
function revokeArmorCommitment(table) {
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

export const Resilient = {
  name: 'Resilient',
  description:
    'Before you mark your last Armor Slot, roll a d6. On a result of 6, reduce the severity by one threshold without marking an Armor Slot.',
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      armorUseCommitted,
      wouldMarkLastArmorSlot,
      (table) => {
        const roll = table.rollDie('d6');
        if (roll !== 6) return;
        reduceIncomingHpByOneThreshold(table);
        revokeArmorCommitment(table);
      }
    ),
  },
};
