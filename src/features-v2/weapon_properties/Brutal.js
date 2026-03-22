import { when, isActing } from '../engine/when.js';

export const Brutal = {
  name: "Brutal",
  description: "When you roll the maximum value on a damage die, roll an additional damage die.",
  hooks: {
    onReviewAction: when(isActing, (table) => table.action?.type === 'attack', (table) => {
      const damageDice = table.rolls?.damage?.dice ?? [];
      const effects = table.action?.effects ?? [];

      // Find the primary damage effect targeting the action target
      const targetId = table.action?.target?.instanceId;
      const dmgEffect = effects.find((e) => e.type === 'damage' && e.target?.instanceId === targetId);
      if (!dmgEffect) return;

      let bonus = 0;
      for (const d of damageDice) {
        if (d.value == null || !d.die) continue;
        // Only handle simple single-die notation (e.g. 'd8', 'd10')
        const m = /^d(\d+)$/.exec(d.die);
        if (!m) continue;
        const maxFace = parseInt(m[1], 10);
        if (d.value >= maxFace) {
          bonus += table.rollDie(d.die);
        }
      }

      if (bonus > 0) {
        dmgEffect.amount += bonus;
      }
    }),
  },
};
