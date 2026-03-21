import { when, isActing } from '../engine/when.js';

export const Paired = {
  name: "Paired",
  description: "+N to primary weapon damage to targets within Melee range (scales with weapon tier).",
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack' && table.action?.range === 'melee',
      (table) => {
        const weapon = table.me?.weapons?.find((w) =>
          (w.features || []).some((f) => f === 'Paired' || f?.name === 'Paired')
        );
        const tier = weapon?.tier ?? 1;
        const bonus = tier + 1;
        table.rolls?.damage?.addStatic({ name: 'Paired', value: bonus });
      }
    ),
  },
};
