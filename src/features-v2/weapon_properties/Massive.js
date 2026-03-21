import { when, isActing } from '../engine/when.js';

export const Massive = {
  name: "Massive",
  description: "-1 to Evasion; on a successful attack, roll an additional damage die and discard the lowest result.",
  passiveStatMods: {
    evasion: -1,
  },
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const damageDice = table.rolls?.damage?.dice ?? [];
        const targetId = table.action?.target?.instanceId;
        const dmgEffect = (table.action?.effects ?? []).find(
          (e) => e.type === 'damage' && e.target?.instanceId === targetId
        );
        if (!dmgEffect) return;

        const firstDie = damageDice.find((d) => d.die && d.value != null);
        if (!firstDie) return;

        const extraRoll = table.rollDie(firstDie.die);
        const allValues = damageDice
          .filter((d) => d.value != null)
          .map((d) => d.value)
          .concat(extraRoll);
        const minValue = Math.min(...allValues);

        dmgEffect.amount += extraRoll - minValue;
      }
    ),
  },
};
