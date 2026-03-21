import { when, isActing } from '../engine/when.js';
import { isRangeWithin } from '../engine/table.js';

export const Bouncing = {
  name: 'Bouncing',
  description:
    'Mark 1 or more Stress to hit that many targets in range of the attack.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: 'Mark Stress to hit additional targets in range.',
        placements: ['reviewAction'],
        stressCost: (table) => (table.feature.get('bounceTargets') || []).length,
        targetSelect: {
          targets: (table) => {
            const range = table.action?.range;
            if (!range) return [];
            return table.adversaries
              .concat(table.characters.filter((c) => c.instanceId !== table.me?.instanceId))
              .filter(
                (a) =>
                  a.instanceId !== table.action?.target?.instanceId &&
                  isRangeWithin(table.me?.rangeFrom(a), range)
              )
              .map((a) => ({ id: a.instanceId, name: a.name }));
          },
          multi: true,
        },
        onUse(table, chip) {
          const targetIds = chip.get('selectedTargetIds') || [];
          table.feature.set('bounceTargets', targetIds);
          const damage = table.me?.primaryWeapon?.damage;
          if (!damage || !targetIds.length) return;
          for (const id of targetIds) {
            const target = table.actors.find((a) => a.instanceId === id);
            if (target) {
              table.action.addDamageRoll({
                name: 'Bouncing',
                dice: damage,
                targets: [target],
              });
            }
          }
        },
      }
    ),
  ],
};
