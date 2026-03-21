import { when, isActing } from '../engine/when.js';

const RANGE_BANDS = ['melee', 'veryClose', 'close', 'far', 'veryFar'];

function isInRange(rangeBand, maxRange) {
  if (!rangeBand || !maxRange) return false;
  return RANGE_BANDS.indexOf(rangeBand) <= RANGE_BANDS.indexOf(maxRange);
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
        isToggle: true,
        stressCost: (table) => table.feature.get('bounceTargets') ?? 1,
        multiSelect: true,
        isSelectTarget: (table) => {
          const range = table.action?.range;
          const primaryTargetId = table.action?.target?.instanceId;
          return table.adversaries.filter(
            (adv) =>
              adv.instanceId !== primaryTargetId &&
              isInRange(table.me?.rangeFrom(adv), range)
          );
        },
        onUse(table, chip) {
          const ids = chip.get('selectedTargetIds') || [];
          const count = ids.length || 1;
          table.feature.set('bounceTargets', count);

          if (chip.isOn && ids.length > 0) {
            const targets = table.adversaries.filter((a) =>
              ids.includes(a.instanceId)
            );
            for (const t of targets) {
              const damageDice = table.rolls?.damage?.dice ?? [];
              const diceStr = damageDice.map((d) => d.die).join('+') || 'd6';
              table.action?.addDamageRoll({
                name: `Bouncing (${t.name})`,
                dice: diceStr,
                targets: [t],
              });
            }
          }
        },
      }
    ),
  ],
};
