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
        if (damageDice.length === 0) return;

        const baseDie = damageDice[0]?.die?.replace(/^\d+/, '') || damageDice[0]?.die;
        if (!baseDie) return;

        const extraRoll = table.rollDie(baseDie);

        const allValues = damageDice
          .map((d) => d.value)
          .filter((v) => v != null)
          .concat(extraRoll);

        const lowest = Math.min(...allValues);
        const improvement = extraRoll - lowest;

        if (improvement > 0) {
          const targetId = table.action?.target?.instanceId;
          const dmg = table.action?.effects?.find(
            (e) => e.type === 'damage' && e.target?.instanceId === targetId
          );
          if (dmg) {
            dmg.amount += improvement;
          }
        }

        table.action?.addNarration(
          `Powerful: rolled extra ${baseDie} = ${extraRoll}, discarded lowest (${lowest}).`
        );
      }
    ),
  },
};
