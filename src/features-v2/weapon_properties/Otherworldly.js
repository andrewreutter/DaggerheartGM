import { when, isActing } from '../engine/when.js';

export const Otherworldly = {
  name: "Otherworldly",
  description: "On a successful attack, you can deal physical or magic damage.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        description: "Switch damage to magic.",
        placements: ['reviewAction'],
        isToggle: true,
      }
    ),
  ],
  hooks: {
    onReviewAction: (table) => {
      const targetId = table.action?.target?.instanceId;
      const dmgEffect = (table.action?.effects ?? []).find(
        (e) => e.type === 'damage' && e.target?.instanceId === targetId
      );
      if (dmgEffect) {
        dmgEffect.damageType = 'magic';
      }
    },
  },
};
