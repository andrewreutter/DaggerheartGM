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

        const firstDie = damageDice[0];
        if (!firstDie?.die || firstDie.value == null) return;

        const extraRoll = table.rollDie(firstDie.die);

        const allValues = [
          ...damageDice.map((d) => d.value).filter((v) => v != null),
          extraRoll,
        ];

        const lowest = Math.min(...allValues);

        table.rolls?.damage?.addDie({
          name: 'Powerful',
          die: firstDie.die,
          value: extraRoll,
        });

        table.rolls?.damage?.addStatic({
          name: 'Powerful (discard lowest)',
          value: -lowest,
        });
      }
    ),
  },
};
