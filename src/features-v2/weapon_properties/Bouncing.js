import { when, isActing } from '../engine/when.js';

const RANGE_ORDER = ['melee', 'veryClose', 'close', 'far', 'veryFar'];

function isWithinRange(actualRange, maxRange) {
  const actualIdx = RANGE_ORDER.indexOf(actualRange);
  const maxIdx = RANGE_ORDER.indexOf(maxRange);
  if (actualIdx === -1 || maxIdx === -1) return false;
  return actualIdx <= maxIdx;
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
        description: 'Mark 1 Stress to hit another target in range.',
        placements: ['resolve'],
        stressCost: 1,
        loop: true,
        isTargetSelect(table) {
          const attackRange = table.action?.range;
          const primaryTargetId = table.action?.target?.instanceId;
          const selfId = table.me?.instanceId;
          return table.actors.filter((a) => {
            if (a.instanceId === primaryTargetId) return false;
            if (a.instanceId === selfId) return false;
            const range = table.me.rangeFrom(a);
            return range != null && isWithinRange(range, attackRange);
          });
        },
        onUse(table, chip) {
          const targetId = chip.get('selectedTargetId');
          const target = table.actors.find((a) => a.instanceId === targetId);
          if (!target) return;

          const weaponDie =
            table.rolls?.damage?.dice?.find((d) => d.name === 'weapon');
          const damageDice = weaponDie?.die ?? 'd6';

          table.action?.addDamageRoll({
            name: 'Bouncing',
            dice: damageDice,
            targets: [target],
          });
        },
      }
    ),
  ],
};
