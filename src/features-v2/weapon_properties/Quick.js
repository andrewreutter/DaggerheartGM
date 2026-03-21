import { when, isActing } from '../engine/when.js';

export const Quick = {
  name: 'Quick',
  description:
    'When you make an attack, you can mark a Stress to target another creature within range.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: 'Mark a Stress to deal weapon damage to another target within range.',
        placements: ['reviewAction'],
        stressCost: 1,
        onUse(table) {
          const weaponDie = (table.rolls?.damage?.dice ?? []).find((d) => d.name === 'weapon');
          const damageDie = weaponDie?.die ?? 'd6';
          const primaryTargetId = table.action?.target?.instanceId;
          const range = table.action?.range;

          const extraTargets = table.adversaries.filter((adv) => {
            if (adv.instanceId === primaryTargetId) return false;
            if (!range) return true;
            const dist = table.me?.rangeFrom?.(adv);
            return dist === range || dist === 'melee' || dist === 'veryClose';
          });

          if (extraTargets.length > 0) {
            table.action?.addDamageRoll({
              name: 'Quick',
              dice: damageDie,
              targets: extraTargets,
            });
          }
        },
      }
    ),
  ],
};
