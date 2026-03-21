import { when, isActing } from '../engine/when.js';

export const Otherworldly = {
  name: "Otherworldly",
  description: "On a successful attack, you can deal physical or magic damage.",
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        description: "Switch damage to magic instead of physical.",
        placements: ['reviewAction'],
        isToggle: true,
        onUse(table, chip) {
          const targetId = table.action?.target?.instanceId;
          for (const e of table.action?.effects ?? []) {
            if (e.type === 'damage' && e.target?.instanceId === targetId) {
              e.damageType = chip.isOn ? 'magic' : 'physical';
            }
          }
        },
      }
    ),
  ],
};
