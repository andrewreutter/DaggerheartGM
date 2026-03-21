import { when, isActing } from '../engine/when.js';

export const DoubledUp = {
  name: 'Doubled Up',
  description:
    'When you attack with your primary weapon, you can deal damage to another target within Melee range.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: 'Deal damage to another target within Melee range.',
        placements: ['reviewAction'],
        targetSelect: (table) =>
          table.adversaries
            .concat(table.characters.filter((c) => c.instanceId !== table.me?.instanceId))
            .filter(
              (a) =>
                a.instanceId !== table.action?.target?.instanceId &&
                table.me?.rangeFrom(a) === 'melee'
            )
            .map((a) => ({ id: a.instanceId, name: a.name })),
        onUse(table, chip) {
          const targetIds = chip.get('selectedTargetIds') || [];
          const damage = table.me?.primaryWeapon?.damage;
          if (!damage || !targetIds.length) return;
          const target = table.actors.find((a) => a.instanceId === targetIds[0]);
          if (target) {
            table.action.addDamageRoll({
              name: 'Doubled Up',
              dice: damage,
              targets: [target],
            });
          }
        },
      }
    ),
  ],
};
