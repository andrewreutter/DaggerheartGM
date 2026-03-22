import { when, isActing } from '../engine/when.js';

const isPrimaryWeaponAttack = (table) =>
  Boolean(
    table.action?.weaponId &&
    table.me?.primaryWeapon?.id &&
    table.action.weaponId === table.me.primaryWeapon.id
  );

export const DoubledUp = {
  name: 'Doubled Up',
  description: 'When you attack with your primary weapon, you can deal damage to another target within Melee range.',
  showTag: true,
  interactive: true,
  tagText: 'Deal secondary damage to another Melee target',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      isPrimaryWeaponAttack,
      {
        description: 'Deal secondary weapon damage to another target within Melee range.',
        placements: ['reviewAction'],
        selectTargets: (table) => {
          const targetId = table.action?.target?.instanceId;
          return table.adversaries.filter(
            (a) => a.instanceId !== targetId && table.me?.rangeFrom(a) === 'melee'
          );
        },
        onUse(table, chip) {
          const selectedIds = chip.get('selectedTargetIds') || [];
          const target = table.adversaries.find((a) => selectedIds.includes(a.instanceId));
          if (target) {
            // Secondary damage is always the off-hand weapon; not `table.source` (primary attack).
            const secondary = table.me?.secondaryWeapon;
            const diceStr = secondary?.damage ?? 'd6';
            table.action?.addDamageRoll({
              name: 'Doubled Up',
              dice: diceStr,
              targets: [target],
            });
          }
        },
      }
    ),
  ],
};
