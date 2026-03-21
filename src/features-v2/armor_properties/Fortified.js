import { when, isTargeted, armorUseCommitted } from '../engine/when.js';

export const Fortified = {
  name: 'Fortified',
  description:
    'When you mark an Armor Slot, you reduce the severity of an attack by two thresholds instead of one.',
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      armorUseCommitted,
      (table) => {
        const id = table.me?.instanceId;
        const hp = (table.action?.effects ?? []).find(
          (e) =>
            e.stat === 'currentHP' &&
            e.target?.instanceId === id &&
            e.amount > 0
        );
        if (hp) {
          hp.amount = Math.max(0, hp.amount - 1);
        }
      }
    ),
  },
};
