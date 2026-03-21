import { when, isActing } from '../engine/when.js';

export const Eruptive = {
  name: "Eruptive",
  description: "On a successful attack against a target within Melee range, all other adversaries within Very Close range must succeed on a reaction roll (14) or take half damage.",
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => table.action?.range === 'melee',
      (table) => {
        const targetId = table.action?.target?.instanceId;
        const hpEffect = (table.action?.effects ?? []).find(
          (e) => e.stat === 'currentHP' && e.target?.instanceId === targetId && e.amount > 0
        );
        if (!hpEffect) return;

        const halfDamage = Math.ceil(hpEffect.amount / 2);
        const nearbyAdversaries = table.adversaries.filter(
          (adv) =>
            adv.instanceId !== targetId &&
            table.me.rangeFrom(adv) === 'veryClose'
        );

        for (const adv of nearbyAdversaries) {
          const reactionRoll = table.rollDie('d20');
          if (reactionRoll < 14) {
            adv.markHP(halfDamage);
            table.action.addNarration(
              `${adv.name} failed reaction roll (${reactionRoll} vs 14) — takes ${halfDamage} HP from Eruptive.`
            );
          } else {
            table.action.addNarration(
              `${adv.name} succeeded reaction roll (${reactionRoll} vs 14) — resists Eruptive.`
            );
          }
        }
      }
    ),
  },
};
