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
        description: 'Deal secondary weapon damage to another Melee target.',
        placements: ['reviewAction'],
        selectTargets: (table) => {
          const currentTargetIds = new Set(
            (table.action?.targets || []).map((t) => t.instanceId)
          );
          return table.adversaries.filter(
            (a) =>
              !currentTargetIds.has(a.instanceId) &&
              table.me?.rangeFrom(a) === 'melee'
          );
        },
        onUse(table, chip) {
          const targetIds = chip.get('selectedTargetIds') || [];
          const target = table.actors.find(
            (a) => a.instanceId === targetIds[0]
          );
          if (!target) return;
          const secondaryDamage =
            table.me?.secondaryWeapon?.damage || 'd6';
          table.action?.addDamageRoll({
            name: 'Doubled Up',
            dice: secondaryDamage,
            damageType: null,
            targets: [target],
          });
        },
      }
    ),
  ],
};
