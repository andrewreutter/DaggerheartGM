import { when, isActing } from '../engine/when.js';

export const Bouncing = {
  name: 'Bouncing',
  description: 'Mark 1 or more Stress to hit that many targets in range of the attack.',
  showTag: true,
  interactive: true,
  tagText: 'Mark Stress to hit additional targets in range',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        description: 'Mark Stress to bounce to additional targets in range.',
        placements: ['reviewAction'],
        stressCost: (table) => table.feature.get('bounceTargets') ?? 0,
        multiSelect: true,
        selectTargets: (table) => {
          const targetId = table.action?.target?.instanceId;
          const range = table.action?.range;
          if (!range) return table.adversaries.filter((a) => a.instanceId !== targetId);
          return table.adversaries.filter(
            (a) => a.instanceId !== targetId && table.me?.rangeFrom(a) === range
          );
        },
        onUse(table, chip) {
          const selectedIds = chip.get('selectedTargetIds') || [];
          table.feature.set('bounceTargets', selectedIds.length);
          const targets = table.adversaries.filter((a) => selectedIds.includes(a.instanceId));
          if (targets.length > 0) {
            const dmgDice = table.rolls?.damage?.dice;
            const diceStr = dmgDice?.[0]?.die ?? 'd6';
            table.action?.addDamageRoll({
              name: 'Bouncing',
              dice: diceStr,
              targets,
            });
          }
        },
      }
    ),
  ],
};
