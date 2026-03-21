import { when, isActing } from '../engine/when.js';

export const Sharp = {
  name: 'Sharp',
  description:
    'On a successful attack against a target within Melee range, add a d4 to the damage roll.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => table.me?.rangeFrom(table.action?.target) === 'melee',
      (table) => {
        const targetId = table.action?.target?.instanceId;
        const dmgEffect = table.action?.effects?.find(
          (e) => e.type === 'damage' && e.target?.instanceId === targetId
        );
        if (!dmgEffect) return;
        const bonus = table.rollDie('d4');
        dmgEffect.amount += bonus;
      }
    ),
  },
};
