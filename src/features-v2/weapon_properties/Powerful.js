import { when, isActing } from '../engine/when.js';

export const Powerful = {
  name: 'Powerful',
  description:
    'On a successful attack, roll an additional damage die and discard the lowest result.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const damageDice = table.rolls?.damage?.dice ?? [];
        const weaponDie = damageDice.find((d) => d.name === 'weapon');
        if (!weaponDie?.die || weaponDie.value == null) return;

        const dieMatch = weaponDie.die.match(/d(\d+)/);
        if (!dieMatch) return;

        const dieSize = parseInt(dieMatch[1], 10);
        const extraRoll = table.rollDie(`d${dieSize}`);
        const lowest = Math.min(weaponDie.value, extraRoll);

        const targetId = table.action?.target?.instanceId;
        const dmgEffect = (table.action?.effects ?? []).find(
          (e) => e.type === 'damage' && e.target?.instanceId === targetId
        );
        if (dmgEffect) {
          dmgEffect.amount += extraRoll - lowest;
        }
      }
    ),
  },
};
