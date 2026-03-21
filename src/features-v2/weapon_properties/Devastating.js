import { when, isActing } from '../engine/when.js';

export const Devastating = {
  name: 'Devastating',
  description:
    'Before you make an attack roll, you can mark a Stress to use a d20 as your damage die.',
  chips: [
    when(isActing, {
      description: 'Mark a Stress to use a d20 as your damage die.',
      placements: ['intent'],
      stressCost: 1,
      isToggle: true,
      onUse(table, chip) {
        const dmg = table.rolls?.damage;
        if (!dmg) return;
        if (chip.isOn) {
          const snapshot = (dmg.dice || []).map((d) => ({ name: d.name, die: d.die }));
          table.feature.set('_devastatingDice', snapshot);
          [...(dmg.dice || [])].forEach((d) => dmg.removeDie(d.name));
          dmg.addDie({ name: 'weapon', die: 'd20' });
        } else {
          const snapshot = table.feature.get('_devastatingDice');
          [...(dmg.dice || [])].forEach((d) => dmg.removeDie(d.name));
          table.feature.set('_devastatingDice', undefined);
          if (snapshot?.length) {
            for (const d of snapshot) {
              dmg.addDie({ name: d.name, die: d.die });
            }
          }
        }
      },
    }),
  ],
};
