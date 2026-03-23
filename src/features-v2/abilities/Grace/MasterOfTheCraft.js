/**
 * Grace domain — Master of the Craft (level 9 spell card)
 * SRD: Gain a permanent +2 bonus to two of your Experiences or a permanent +3 bonus to one of your Experiences.
 */

import { when } from '../../engine/when.js';

const MODE_TWO_PLUS_TWO = 'twoPlusTwo';
const MODE_ONE_PLUS_THREE = 'onePlusThree';

export const MasterOfTheCraft = {
  name: 'Master of the Craft',
  description:
    'Gain a permanent +2 bonus to two of your Experiences or a permanent +3 bonus to one of your Experiences. Then place this card in your vault permanently.',
  chips: [
    when(
      (table) => !table.feature.get('motcMode'),
      {
        name: 'Master of the Craft — layout',
        description: 'Choose +2 to two different Experiences, or +3 to one Experience.',
        placements: ['create'],
        isSelect: () => [
          {
            id: MODE_TWO_PLUS_TWO,
            name: '+2 to two Experiences',
            description: 'Permanent +2 to each of two different Experiences.',
          },
          {
            id: MODE_ONE_PLUS_THREE,
            name: '+3 to one Experience',
            description: 'Permanent +3 to a single Experience.',
          },
        ],
        onUse(table, chip) {
          const id = chip.get('selectedId');
          if (id === MODE_TWO_PLUS_TWO || id === MODE_ONE_PLUS_THREE) {
            table.feature.set('motcMode', id);
          }
        },
      }
    ),
    when(
      (table) =>
        table.feature.get('motcMode') === MODE_TWO_PLUS_TWO && !table.feature.get('motcDone'),
      {
        name: 'Master of the Craft — two Experiences',
        description: 'Choose two different Experiences; each gains a permanent +2 bonus.',
        placements: ['create'],
        multiSelect: true,
        maxSelections: 2,
        isSelect: (table) =>
          (table.me?.experiences || []).map((e) => ({ id: e.id, name: e.name })),
        onUse(table, chip) {
          const ids = chip.get('selectedIds') || [];
          if (ids.length !== 2 || ids[0] === ids[1]) return;
          for (const experienceId of ids) {
            table.me?.addExperienceBonus(experienceId, 2);
          }
          table.feature.set('motcDone', true);
        },
      }
    ),
    when(
      (table) =>
        table.feature.get('motcMode') === MODE_ONE_PLUS_THREE && !table.feature.get('motcDone'),
      {
        name: 'Master of the Craft — one Experience',
        description: 'Choose one Experience to gain a permanent +3 bonus.',
        placements: ['create'],
        isSelect: (table) =>
          (table.me?.experiences || []).map((e) => ({ id: e.id, name: e.name })),
        onUse(table, chip) {
          const selectedId = chip.get('selectedId');
          if (!selectedId) return;
          table.me?.addExperienceBonus(selectedId, 3);
          table.feature.set('motcDone', true);
        },
      }
    ),
  ],
};
