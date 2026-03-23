import { when, youSucceedOnAnAttack } from '../engine/when.js';

export const Quick = {
  name: 'Quick',
  description:
    'When you make an attack, you can mark a Stress to target another creature within range.',
  showTag: true,
  interactive: true,
  tagText: 'Stress: damage another target in range',
  chips: [
    when(
      youSucceedOnAnAttack,
      {
        description:
          'Mark 1 Stress to deal your primary weapon damage to another target within range of this attack.',
        placements: ['reviewAction'],
        stressCost: 1,
        selectTargets: (table) => {
          const targetId = table.action?.target?.instanceId;
          const band = table.action?.range;
          if (!band) {
            return table.adversaries.filter((a) => a.instanceId !== targetId);
          }
          return table.adversaries.filter(
            (a) => a.instanceId !== targetId && table.me?.rangeFrom(a) === band
          );
        },
        onUse(table, chip) {
          const selectedIds = chip.get('selectedTargetIds') || [];
          const target = table.adversaries.find((a) => selectedIds.includes(a.instanceId));
          if (!target) return;
          const diceStr =
            table.source?.damage ??
            table.me?.primaryWeapon?.damage ??
            table.rolls?.damage?.dice?.[0]?.die ??
            'd6';
          table.action?.addDamageRoll({
            name: 'Quick',
            dice: diceStr,
            targets: [target],
          });
        },
      }
    ),
  ],
};
