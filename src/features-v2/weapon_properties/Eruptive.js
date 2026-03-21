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
        const nearbyAdversaries = table.adversaries.filter(
          (adv) =>
            adv.instanceId !== targetId &&
            (table.me.rangeFrom(adv) === 'melee' || table.me.rangeFrom(adv) === 'veryClose')
        );
        if (nearbyAdversaries.length === 0) return;

        const damageDice = table.rolls?.damage?.dice ?? [];
        const damageStatics = table.rolls?.damage?.statics ?? [];
        const rawDamage =
          damageDice.reduce((sum, d) => sum + (d.value ?? 0), 0) +
          damageStatics.reduce((sum, s) => sum + (s.value ?? 0), 0);
        const halfDamage = Math.ceil(rawDamage / 2);

        for (const adv of nearbyAdversaries) {
          const reactionRoll = table.rollDie('d20');
          if (reactionRoll < 14) {
            table.action?.addNarration(
              `Eruptive: ${adv.name} fails reaction roll (${reactionRoll} vs DC 14) — takes ${halfDamage} splash damage.`
            );
          } else {
            table.action?.addNarration(
              `Eruptive: ${adv.name} passes reaction roll (${reactionRoll} vs DC 14) — avoids splash damage.`
            );
          }
        }
      }
    ),
  },
};
