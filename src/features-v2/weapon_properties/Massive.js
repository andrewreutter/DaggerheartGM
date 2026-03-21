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
        const effects = table.action?.effects ?? [];
        const targetId = table.action?.target?.instanceId;
        const dmgEffect = effects.find(
          (e) => e.type === 'damage' && e.target?.instanceId === targetId
        );
        if (!dmgEffect) return;

        // Find the first simple damage die to duplicate
        const primaryDie = damageDice.find((d) => d.die && /^d\d+$/.test(d.die));
        if (!primaryDie) return;

        const extraRoll = table.rollDie(primaryDie.die);
        const lowestOriginal = Math.min(
          ...damageDice.filter((d) => d.value != null).map((d) => d.value)
        );
        const lowest = Math.min(extraRoll, lowestOriginal);
        dmgEffect.amount += extraRoll - lowest;
      }
    ),
  },
};
