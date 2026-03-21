import { when, isActing } from '../engine/when.js';

export const DoubledUp = {
  name: 'Doubled Up',
  description:
    'When you make an attack with your primary weapon, you can deal damage to another target within Melee range.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      {
        description: 'Deal damage to another target within Melee range.',
        placements: ['reviewAction'],
        isToggle: true,
        isSelectTarget: (table) => {
          const primaryTargetId = table.action?.target?.instanceId;
          return table.adversaries.filter(
            (adv) =>
              adv.instanceId !== primaryTargetId &&
              table.me?.rangeFrom(adv) === 'melee'
          );
        },
        onUse(table, chip) {
          const ids = chip.get('selectedTargetIds') || [];
          if (chip.isOn && ids.length > 0) {
            const target = table.adversaries.find(
              (a) => a.instanceId === ids[0]
            );
            if (target) {
              const damageDice = table.rolls?.damage?.dice ?? [];
              const diceStr = damageDice.map((d) => d.die).join('+') || 'd6';
              table.action?.addDamageRoll({
                name: `Doubled Up (${target.name})`,
                dice: diceStr,
                targets: [target],
              });
            }
          }
        },
      }
    ),
  ],
};
