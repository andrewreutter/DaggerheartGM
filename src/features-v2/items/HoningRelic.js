/**
 * SRD item — Honing Relic (roll table 47).
 */

import { when } from '../engine/when.js';

export const HoningRelic = {
  name: 'Honing Relic',
  description:
    'You gain a +1 bonus to an Experience of your choice. You can only carry one relic.',
  chips: [
    when(
      (table) => (table.me?.experiences || []).length > 0,
      (table) => !table.feature.get('experienceChosen'),
      {
        name: 'Honing Relic — Experience',
        description: 'Choose an Experience to gain a permanent +1 bonus.',
        placements: ['create'],
        isSelect: (table) =>
          (table.me?.experiences || []).map((e) => ({ id: e.id, name: e.name })),
        onUse(table, chip) {
          const selectedId = chip.get('selectedId');
          if (!selectedId) return;
          table.me?.addExperienceBonus(selectedId, 1);
          table.feature.set('experienceChosen', true);
        },
      }
    ),
  ],
};
