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
        placements: ['resolve'],
        isTargetSelect(table) {
          const primaryTargetId = table.action?.target?.instanceId;
          const selfId = table.me?.instanceId;
          return table.actors.filter((a) => {
            if (a.instanceId === primaryTargetId) return false;
            if (a.instanceId === selfId) return false;
            return table.me.rangeFrom(a) === 'melee';
          });
        },
        onUse(table, chip) {
          const targetId = chip.get('selectedTargetId');
          const target = table.actors.find((a) => a.instanceId === targetId);
          if (!target) return;

          const secDamage = table.me?.secondaryWeapon?.damage ?? 'd6';

          table.action?.addDamageRoll({
            name: 'Doubled Up',
            dice: secDamage,
            targets: [target],
          });
        },
      }
    ),
  ],
};
