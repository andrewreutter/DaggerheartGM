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
        const target = table.action?.target;
        const others = table.adversaries.filter(
          (adv) =>
            adv.instanceId !== target?.instanceId &&
            (table.me.rangeFrom(adv) === 'melee' || table.me.rangeFrom(adv) === 'veryClose')
        );
        for (const adv of others) {
          adv.actionLoop('Eruptive', 'Must succeed on a reaction roll (14) or take half damage.', {
            trait: 'Instinct',
            difficulty: 14,
          });
        }
      }
    ),
  },
};
