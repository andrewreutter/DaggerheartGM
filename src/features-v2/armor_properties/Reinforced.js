import { when, isTargeted, armorUseCommitted } from '../engine/when.js';

/** True when the wearer has exactly one unmarked armor slot (this use marks the last). */
function oneArmorSlotRemaining(table) {
  return (table.me?.armor ?? 0) === 1;
}

/** True when the current mutation batch includes clearArmor for this feature's owner. */
function clearArmorForOwnerInBatch(table) {
  const id = table.me?.instanceId;
  if (!id) return false;
  return table.mutationBatch.some(
    (m) =>
      m.type === 'clearArmor' &&
      m.payload?.instanceId === id &&
      (Number(m.payload?.amount) || 0) > 0
  );
}

function reinforcedActiveIsTrue(table) {
  return table.source?.get?.('reinforcedActive') === true;
}

export const Reinforced = {
  name: 'Reinforced',
  description:
    'When you mark your last Armor Slot, increase your damage thresholds by +2 until you clear at least 1 Armor Slot.',
  passiveStatMods: when(
    (table) => !!table.source?.get?.('reinforcedActive'),
    { majorThreshold: 2, severeThreshold: 2 }
  ),
  hooks: {
    onReviewAction: when(
      isTargeted,
      armorUseCommitted,
      oneArmorSlotRemaining,
      (table) => {
        table.source.set('reinforcedActive', true);
      }
    ),
    onStateChange: when(
      clearArmorForOwnerInBatch,
      reinforcedActiveIsTrue,
      (table) => {
        table.source.set('reinforcedActive', false);
      }
    ),
  },
};
