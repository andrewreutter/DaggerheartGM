import { when, isActing } from '../engine/when.js';

export const Massive = {
  name: "Massive",
  description: "-1 to Evasion; on a successful attack, roll an additional damage die and discard the lowest result.",
  passiveStatMods: {
    evasion: -1,
  },
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        table.rolls?.damage?.addAdvantageDie('Massive');
      }
    ),
  },
};
