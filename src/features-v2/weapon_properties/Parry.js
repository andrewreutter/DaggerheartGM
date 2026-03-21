import { when, isTargeted } from '../engine/when.js';

export const Parry = {
  name: 'Parry',
  description:
    "When you are attacked, roll this weapon's damage dice. If any of the attacker's damage dice rolled the same value as your dice, the matching results are discarded from the attacker's damage dice before the damage you take is totaled.",
  hooks: {
    onReviewAction: when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      (table) => {
        const parryWeapon = table.me?.weapons?.find(
          (w) => (w.features || []).includes('Parry')
        );
        const dieMatch = parryWeapon?.damage?.match(/d\d+/);
        if (!dieMatch) return;

        const parryResult = table.rollDie(dieMatch[0]);

        const dmg = table.action?.effects?.find(
          (e) =>
            e.type === 'damage' &&
            e.target?.instanceId === table.me?.instanceId &&
            e.amount > 0
        );
        if (!dmg) return;

        let reduction = 0;
        for (const d of table.rolls?.damage?.dice ?? []) {
          if (d.value != null && d.value === parryResult) {
            reduction += d.value;
          }
        }

        if (reduction > 0) {
          dmg.amount = Math.max(0, dmg.amount - reduction);
          table.action?.addNarration(
            `Parry! Rolled ${parryResult} — cancelled ${reduction} damage.`
          );
        }
      }
    ),
  },
};
