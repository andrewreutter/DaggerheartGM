import { when, isActing } from '../engine/when.js';

export const Eruptive = {
  name: "Eruptive",
  description: "On a successful attack against a target within Melee range, all other adversaries within Very Close range must succeed on a reaction roll (14) or take half damage.",
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => table.action?.range === 'melee',
      (table) => {
        const targetId = table.action?.target?.instanceId;
        const dmgEffect = table.action?.effects?.find(
          (e) => e.type === 'damage' && e.target?.instanceId === targetId
        );
        if (!dmgEffect || dmgEffect.amount <= 0) return;

        const halfDmg = Math.ceil(dmgEffect.amount / 2);
        const withinVeryClose = (band) => band === 'melee' || band === 'veryClose';
        const splashTargets = table.adversaries.filter(
          (adv) =>
            adv.instanceId !== targetId &&
            withinVeryClose(adv.rangeFrom(table.action?.target))
        );

        for (const adv of splashTargets) {
          const reaction = table.rollDie('d20');
          if (reaction < 14) {
            table.action.effects.push({
              type: 'damage',
              target: adv,
              amount: halfDmg,
              damageType: dmgEffect.damageType,
            });
            table.action?.addNarration(
              `${adv.name} fails reaction roll (${reaction}) — takes ${halfDmg} splash damage.`
            );
          } else {
            table.action?.addNarration(
              `${adv.name} succeeds reaction roll (${reaction}) — avoids splash damage.`
            );
          }
        }
      }
    ),
  },
};
