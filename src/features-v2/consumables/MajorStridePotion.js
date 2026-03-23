/**
 * SRD consumable — Major Stride Potion (common roll table 25).
 * daggerheart-srd/consumables/Major Stride Potion.md
 */

import { when } from '../engine/when.js';

const ACTIVE_KEY = 'majorStrideActive';

export const MajorStridePotion = {
  name: 'Major Stride Potion',
  description: 'You gain a +1 bonus to your Agility until your next rest.',
  onUse(table) {
    table.feature.set(ACTIVE_KEY, true);
  },
  passiveStatMods: when((table) => table.feature.get(ACTIVE_KEY) === true, {
    agility: 1,
  }),
  hooks: {
    onRest: when(
      (t) => t.action?.type === 'shortRest' || t.action?.type === 'longRest',
      (table) => {
        table.feature.set(ACTIVE_KEY, false);
      }
    ),
  },
};
