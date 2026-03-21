import { when, isActing } from '../engine/when.js';

export const SelfCorrecting = {
  name: "Self-Correcting",
  description: "When you roll a 1 on a damage die, it deals 6 damage instead.",
  hooks: {
    onReviewAction: when(isActing, (table) => table.action?.type === 'attack', (table) => {
      const damageDice = table.rolls?.damage?.dice ?? [];
      const onesCount = damageDice.filter((d) => d.value === 1).length;
      if (onesCount === 0) return;

      const targetId = table.action?.target?.instanceId;
      const dmgEffect = (table.action?.effects ?? []).find((e) => e.type === 'damage' && e.target?.instanceId === targetId);
      if (dmgEffect) {
        // Each die showing 1 deals 6 instead of 1, so add 5 per die
        dmgEffect.amount += onesCount * 5;
      }
    }),
  },
};
