import { when, isActing } from '../engine/when.js';

const RANGE_ORDER = { melee: 0, veryClose: 1, close: 2, far: 3, veryFar: 4 };

function isWithinRange(distance, maxRange) {
  if (!distance || !maxRange) return false;
  return (RANGE_ORDER[distance] ?? 999) <= (RANGE_ORDER[maxRange] ?? -1);
}

export const Bouncing = {
  name: 'Bouncing',
  description:
    'Mark 1 or more Stress to hit that many targets in range of the attack.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: 'Mark Stress to bounce to additional targets in range.',
        placements: ['reviewAction'],
        multiSelect: true,
        selectTargets: (table) => {
          const weaponRange = table.me?.primaryWeapon?.range;
          const currentTargetIds = new Set(
            (table.action?.targets || []).map((t) => t.instanceId)
          );
          return table.adversaries.filter(
            (a) =>
              !currentTargetIds.has(a.instanceId) &&
              isWithinRange(table.me?.rangeFrom(a), weaponRange)
          );
        },
        stressCost: (table) => table.feature.get('bounceTargets') ?? 0,
        onUse(table, chip) {
          const targetIds = chip.get('selectedTargetIds') || [];
          table.feature.set('bounceTargets', targetIds.length);
          const targets = targetIds
            .map((id) => table.actors.find((a) => a.instanceId === id))
            .filter(Boolean);
          const weaponDamage = table.me?.primaryWeapon?.damage || 'd6';
          for (const target of targets) {
            table.action?.addDamageRoll({
              name: 'Bouncing',
              dice: weaponDamage,
              damageType: null,
              targets: [target],
            });
          }
        },
      }
    ),
  ],
};
